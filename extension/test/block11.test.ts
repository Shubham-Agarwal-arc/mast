import assert from "node:assert/strict";
import test from "node:test";

import { ChatWorkflow } from "../src/chat/chatWorkflow.js";
import { capturedErrorText, runActivePythonFile } from "../src/execution/runPythonFile.js";
import { buildKnowledgeMap, getKnowledgeBand, KNOWLEDGE_COMPONENT_COUNT } from "../src/knowledge/knowledgeMapModel.js";
import { createKnowledgeMapHtml } from "../src/knowledge/knowledgeMapTemplate.js";
import type { ClassificationResult, SerializedDktState } from "../src/inference/types.js";
import type { RetrievalResult } from "../src/retrieval/localVectorIndex.js";

const classification: ClassificationResult = {
  label: "shape_mismatch",
  confidence: 0.91,
  scores: { shape_mismatch: 0.91 },
  provenance: "SYNTHETIC_BOOTSTRAP_NOT_RESEARCH_MODEL",
};
const retrieval: RetrievalResult[] = [{
  document: { id: "mapped", kcId: "KC_07", difficulty: 0.4, text: "Synthetic mapped KC context." },
  similarity: 1,
  difficultyProximity: 1,
  score: 1,
}];

test("Knowledge Map renders all 30 synthetic KCs without inventing threshold bands", () => {
  const kcIds = Array.from({ length: KNOWLEDGE_COMPONENT_COUNT }, (_, index) => `KC_${String(index).padStart(2, "0")}`);
  const map = buildKnowledgeMap(kcIds, { KC_00: 0, KC_01: 0.3, KC_02: 0.7, KC_29: 1 });

  assert.equal(map.length, 30);
  assert.deepEqual(map.slice(0, 4).map((component) => component.mastery), [0, 0.3, 0.5, 0.5]);
  assert.ok(map.every((component) => component.band === "thresholds-unavailable"));
  assert.equal(getKnowledgeBand(0), "thresholds-unavailable");
  assert.equal(getKnowledgeBand(0.5), "thresholds-unavailable");
  assert.equal(getKnowledgeBand(1), "thresholds-unavailable");
});

test("Knowledge Map HTML states missing source and uses a nonce CSP", () => {
  const html = createKnowledgeMapHtml("vscode-webview://unit", "unit/map.js", "unit/map.css", "unit-nonce");

  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'nonce-unit-nonce'/);
  assert.match(html, /threshold source unavailable/);
  assert.match(html, /no color band is inferred/);
  assert.match(html, /application\/json/);
});

test("active Python execution passes safe args, workspace cwd, and captures stderr", async () => {
  let call: { command: string; args: readonly string[]; cwd: string; timeoutMs: number } | undefined;
  const result = await runActivePythonFile(
    { fileName: "D:\\workspace\\lesson.py", languageId: "python" },
    { workspaceRoot: "D:\\workspace", pythonCommand: "python" },
    {
      run: async (command, args, cwd, timeoutMs) => {
        call = { command, args, cwd, timeoutMs };
        return { exitCode: 1, stdout: "", stderr: "ValueError: synthetic failure" };
      },
    },
  );

  assert.deepEqual(call, {
    command: "python",
    args: ["D:\\workspace\\lesson.py"],
    cwd: "D:\\workspace",
    timeoutMs: 120_000,
  });
  assert.equal(capturedErrorText(result), "ValueError: synthetic failure");
});

test("active Python execution rejects non-Python and out-of-workspace files", async () => {
  const runner = { run: async () => ({ exitCode: 0, stdout: "", stderr: "" }) };
  await assert.rejects(
    runActivePythonFile({ fileName: "D:\\workspace\\lesson.txt", languageId: "plaintext" }, { workspaceRoot: "D:\\workspace", pythonCommand: "python" }, runner),
    /Open a Python file/,
  );
  await assert.rejects(
    runActivePythonFile({ fileName: "D:\\other\\lesson.py", languageId: "python" }, { workspaceRoot: "D:\\workspace", pythonCommand: "python" }, runner),
    /inside the current workspace/,
  );
});

test("captured stderr routes through the existing ChatWorkflow and resolves the mapped KC", async () => {
  const updates: string[] = [];
  const savedStates: SerializedDktState[] = [];
  const state = {} as SerializedDktState;
  const workflow = new ChatWorkflow({
    inference: {
      classifyError: async (text) => {
        assert.equal(text, "RuntimeError: synthetic failure");
        return classification;
      },
      updateMastery: async (kcId) => {
        updates.push(kcId);
        return { masteryByKc: { KC_07: 0.8 }, state, provenance: "SYNTHETIC" };
      },
      getKnowledgeComponents: () => ["KC_07"],
    },
    retrieval: { retrieve: async () => retrieval },
    tokens: { get: async () => ({ access_token: "mock-access", refresh_token: "mock-refresh" }) },
    gateway: { chat: async (_token, payload) => ({ response: `Socratic: ${payload.error_text}` }) },
    getDktState: () => state,
    saveDktState: async (next) => { savedStates.push(next); },
  });

  const result = await workflow.send(capturedErrorText({ exitCode: 1, stdout: "", stderr: "RuntimeError: synthetic failure" })!);
  assert.match(result.response, /RuntimeError: synthetic failure/);
  assert.equal(await workflow.resolve(), 80);
  assert.deepEqual(updates, ["KC_07"]);
  assert.deepEqual(savedStates, [state]);
});

test("successful Python execution produces no captured error", () => {
  assert.equal(capturedErrorText({ exitCode: 0, stdout: "ok", stderr: "" }), undefined);
});
