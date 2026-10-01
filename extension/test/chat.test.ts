import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { GatewayApiClient, GatewayApiError } from "../src/auth/gatewayClient.js";
import { ChatWorkflow, isChatPanelMessage } from "../src/chat/chatWorkflow.js";
import type { ChatWorkflowOptions } from "../src/chat/chatWorkflow.js";
import { createChatHtml } from "../src/chat/chatView.js";
import type { ClassificationResult, MasteryUpdateResult, SerializedDktState } from "../src/inference/types.js";
import type { RetrievalResult } from "../src/retrieval/localVectorIndex.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const classification: ClassificationResult = {
  label: "shape_mismatch",
  confidence: 0.82,
  scores: { shape_mismatch: 0.82 },
  provenance: "SYNTHETIC_TEST_CLASSIFIER",
};
const retrievalResults: RetrievalResult[] = [
  {
    document: { id: "fixture-doc", kcId: "KC_03", difficulty: 0.4, text: "Tensor dimensions align from the right." },
    similarity: 0.9,
    difficultyProximity: 0.9,
    score: 0.9,
  },
];

function makeWorkflow(overrides: Partial<ChatWorkflowOptions> = {}) {
  const calls: {
    classified: string[];
    retrieved: Array<{ query: string; mastery: Record<string, number> }>;
    gateway: Array<{ token: string; payload: Parameters<ChatWorkflowOptions["gateway"]["chat"]>[1] }>;
    updates: Array<{ kcId: string; resolved: boolean }>;
    savedStates: unknown[];
    feedback: Array<{ interaction_id: string; resolved: boolean; mastery_delta?: number }>;
  } = { classified: [], retrieved: [], gateway: [], updates: [], savedStates: [], feedback: [] };
  let token: { access_token: string; refresh_token: string } | undefined = {
    access_token: "secret-mast-access-token",
    refresh_token: "secret-mast-refresh-token",
  };
  const state = { marker: "previous-state" } as unknown as SerializedDktState;
  const updatedState = { marker: "next-state" } as unknown as MasteryUpdateResult["state"];
  const defaultOptions: ChatWorkflowOptions = {
    inference: {
      classifyError: async (text) => {
        calls.classified.push(text);
        return classification;
      },
      updateMastery: async (kcId, resolved) => {
        calls.updates.push({ kcId, resolved });
        return {
          masteryByKc: { KC_03: 0.72 },
          state: updatedState,
          provenance: "SYNTHETIC_TEST_CLASSIFIER",
        };
      },
      getKnowledgeComponents: () => ["KC_03", "KC_04"],
    },
    retrieval: {
      retrieve: async (query, mastery) => {
        calls.retrieved.push({ query, mastery });
        return retrievalResults;
      },
    },
    gateway: {
      chat: async (accessToken, payload) => {
        calls.gateway.push({ token: accessToken, payload });
        return { response: "What do the trailing dimensions imply?", interactionId: "interaction-test-id" };
      },
      feedback: async (_accessToken, payload) => { calls.feedback.push(payload); },
    },
    tokens: { get: async () => token },
    getDktState: () => state,
    saveDktState: async (next) => { calls.savedStates.push(next); },
  };
  const workflow = new ChatWorkflow({ ...defaultOptions, ...overrides });
  return {
    workflow,
    calls,
    setToken(value: typeof token) { token = value; },
    updatedState,
  };
}

test("Gateway chat uses bearer auth, bounded request contract, and validates response", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const client = new GatewayApiClient("https://gateway.example.test/", async (input, init) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({ response: "Which axis is broadcast?" }), { status: 200 });
  });
  const payload = {
    message: "shape issue",
    error_text: "ValueError: shape mismatch",
    error_category: "shape_mismatch",
    mastery_by_kc: { KC_03: 0.5 },
    retrieved_context: ["Tensor dimensions align from the right."],
    hint_depth: 0,
  };

  assert.deepEqual(await client.chat("mast-access-token", payload), { response: "Which axis is broadcast?" });
  assert.equal(captured?.url, "https://gateway.example.test/v1/chat");
  assert.equal(captured?.init?.method, "POST");
  assert.equal((captured?.init?.headers as Record<string, string>).Authorization, "Bearer mast-access-token");
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), payload);
});

test("Gateway chat reads the interaction header and feedback sends metadata only", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const client = new GatewayApiClient("https://gateway.example.test", async (input, init) => {
    requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return String(input).endsWith("/v1/chat")
      ? new Response(JSON.stringify({ response: "Which axis is broadcast?" }), {
        status: 200,
        headers: { "X-MAST-Interaction-ID": "interaction-42" },
      })
      : new Response(null, { status: 204 });
  });

  const result = await client.chat("mast-token", {
    message: "private message",
    error_text: "private traceback",
    mastery_by_kc: {},
    retrieved_context: [],
    hint_depth: 0,
    classification_confidence: 0.82,
    kc_ids: ["KC_03"],
  });
  await client.feedback("mast-token", {
    interaction_id: result.interactionId!,
    resolved: true,
    mastery_delta: 0.08,
  });

  assert.equal(result.interactionId, "interaction-42");
  assert.equal(requests[1].url, "https://gateway.example.test/v1/feedback");
  assert.deepEqual(requests[1].body, {
    interaction_id: "interaction-42",
    resolved: true,
    mastery_delta: 0.08,
  });
  assert.doesNotMatch(JSON.stringify(requests[1].body), /private message|private traceback/);
});

test("Gateway chat failures discard server bodies and preserve safe status", async () => {
  const client = new GatewayApiClient("https://gateway.example.test", async () =>
    new Response("private provider exception and credential", { status: 429 }),
  );
  await assert.rejects(
    client.chat("mast-access-token", {
      message: "question",
      mastery_by_kc: {},
      retrieved_context: [],
      hint_depth: 0,
    }),
    (error: unknown) => {
      assert.ok(error instanceof GatewayApiError);
      assert.equal(error.statusCode, 429);
      assert.match(error.message, /draft is still here/);
      assert.doesNotMatch(error.message, /private provider|credential/);
      return true;
    },
  );
});

test("workflow classifies and retrieves locally before sending authenticated Gateway payload", async () => {
  const { workflow, calls } = makeWorkflow();
  const result = await workflow.send("RuntimeError: tensor dimensions do not match");

  assert.deepEqual(calls.classified, ["RuntimeError: tensor dimensions do not match"]);
  assert.match(calls.retrieved[0].query, /shape_mismatch/);
  assert.deepEqual(calls.retrieved[0].mastery, { KC_03: 0.5, KC_04: 0.5 });
  assert.equal(calls.gateway[0].token, "secret-mast-access-token");
  assert.equal(calls.gateway[0].payload.error_category, "shape_mismatch");
  assert.equal("classification_confidence" in calls.gateway[0].payload, false);
  assert.equal("kc_ids" in calls.gateway[0].payload, false);
  assert.deepEqual(calls.gateway[0].payload.retrieved_context, ["Tensor dimensions align from the right."]);
  assert.equal(result.response, "What do the trailing dimensions imply?");
  assert.equal(result.masteryPercent, 50);
  assert.equal(result.suggestions.length, 2);
  assert.equal(workflow.isInteractionActive, true);
});

test("follow-up keeps the original error context and Resolved updates local mastery state", async () => {
  const { workflow, calls, updatedState } = makeWorkflow();
  await workflow.send("RuntimeError: mismatched tensor shapes");
  await workflow.followUp("Can you give me a smaller hint?");

  assert.equal(calls.gateway[1].payload.message, "Can you give me a smaller hint?");
  assert.equal(calls.gateway[1].payload.error_text, "RuntimeError: mismatched tensor shapes");
  assert.deepEqual(calls.classified, ["RuntimeError: mismatched tensor shapes", "RuntimeError: mismatched tensor shapes"]);
  assert.equal(await workflow.resolve(), 72);
  assert.deepEqual(calls.updates, [{ kcId: "KC_03", resolved: true }]);
  assert.deepEqual(calls.savedStates, [updatedState]);
  assert.equal(workflow.isInteractionActive, false);
});

test("opt-in telemetry sends derived metadata and content-free resolution feedback", async () => {
  const { workflow, calls } = makeWorkflow({ telemetryEnabled: true });
  await workflow.send("RuntimeError: tensor dimensions do not match");

  assert.equal(calls.gateway[0].payload.classification_confidence, 0.82);
  assert.deepEqual(calls.gateway[0].payload.kc_ids, ["KC_03"]);
  await workflow.resolve();

  assert.equal(calls.feedback.length, 1);
  assert.equal(calls.feedback[0].interaction_id, "interaction-test-id");
  assert.equal(calls.feedback[0].resolved, true);
  assert.ok(Math.abs((calls.feedback[0].mastery_delta ?? 0) - 0.22) < 1e-12);
  assert.doesNotMatch(JSON.stringify(calls.feedback[0]), /RuntimeError|tensor dimensions/);
});

test("first-question walkthrough completion is recorded only after a successful chat turn", async () => {
  let completions = 0;
  const { workflow } = makeWorkflow({ onFirstSocraticQuestion: () => { completions += 1; } });

  await workflow.send("shape error");
  await workflow.followUp("Can you give me a smaller hint?");

  assert.equal(completions, 1);
});

test("missing sign-in and transport failures keep the interaction inactive", async () => {
  const { workflow } = makeWorkflow({ tokens: { get: async () => undefined } });
  await assert.rejects(workflow.send("shape error"), /Sign in with GitHub/);
  assert.equal(workflow.isInteractionActive, false);

  const failed = makeWorkflow({ gateway: { chat: async () => { throw new Error("untrusted response body"); } } });
  await assert.rejects(failed.workflow.send("shape error"), /untrusted response body/);
  assert.equal(failed.workflow.isInteractionActive, false);
});

test("webview accepts only the narrow message command schema", () => {
  assert.equal(isChatPanelMessage({ type: "submit", text: "question" }), true);
  assert.equal(isChatPanelMessage({ type: "followUp", text: "hint" }), true);
  assert.equal(isChatPanelMessage({ type: "resolved" }), true);
  assert.equal(isChatPanelMessage({ type: "resolved", text: "extra" }), false);
  assert.equal(isChatPanelMessage({ type: "submit", text: "" }), false);
  assert.equal(isChatPanelMessage({ type: "submit", text: "x".repeat(4001) }), false);
  assert.equal(isChatPanelMessage({ type: "runCommand", command: "workbench.action" }), false);
  assert.equal(isChatPanelMessage(null), false);
});

test("Chat Panel HTML uses a nonce CSP and the client renders untrusted content as text", async () => {
  const html = createChatHtml("vscode-webview://unit", "vscode-webview://unit/chat.js", "vscode-webview://unit/chat.css", "test-nonce");
  const clientScript = await readFile(path.resolve(testDirectory, "../../media/chat.js"), "utf8");

  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'nonce-test-nonce' vscode-webview:\/\/unit/);
  assert.match(html, /<script nonce="test-nonce" src=/);
  assert.doesNotMatch(html, /unsafe-inline/);
  assert.match(clientScript, /body\.textContent = text/);
  assert.match(clientScript, /input\.value = ""/);
  const assistantHandler = clientScript.slice(clientScript.indexOf('message.type === "assistant"'), clientScript.indexOf('message.type === "error"'));
  const errorHandler = clientScript.slice(clientScript.indexOf('message.type === "error"'), clientScript.indexOf('message.type === "resolved"'));
  assert.match(assistantHandler, /input\.value = ""/);
  assert.doesNotMatch(errorHandler, /input\.value\s*=/);
  assert.match(clientScript, /type: "resolved"/);
});
