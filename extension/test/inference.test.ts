import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import path from "node:path";
import test, { after } from "node:test";

import { LocalInference } from "../src/inference/localInference.js";
import { resolveModelPaths } from "../src/inference/modelPaths.js";
import type { SerializedDktState } from "../src/inference/types.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Network access is disabled in the extension inference tests");
};
after(() => {
  globalThis.fetch = originalFetch;
});

const repositoryRoot = path.resolve(process.cwd(), "..");
const paths = resolveModelPaths(path.join(repositoryRoot, "extension"));

test("model directory resolves to the packaged synthetic assets", () => {
  assert.equal(paths.directory, path.join(repositoryRoot, "extension", "models", "MAST-Synthetic"));
  assert.equal(paths.classifier, path.join(paths.directory, "error_classifier.synthetic.onnx"));
  assert.equal(paths.dkt, path.join(paths.directory, "dkt.synthetic.onnx"));
});

test("configured model directory takes precedence over packaged artifacts", () => {
  const configured = resolveModelPaths(path.join(repositoryRoot, "extension"), "custom-models");
  assert.equal(configured.directory, path.join(repositoryRoot, "extension", "custom-models"));
});

test("classifier returns one of the eight labels and confidence from local ONNX inference", async () => {
  const inference = await LocalInference.load(paths);
  try {
    const result = await inference.classifyError("RuntimeError: tensor shapes cannot be multiplied");
    assert.ok(result.label.length > 0);
    assert.equal(Object.keys(result.scores).length, 8);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.equal(result.confidence, Math.max(...Object.values(result.scores)));
    assert.equal(result.provenance, "SYNTHETIC_BOOTSTRAP_NOT_RESEARCH_MODEL");
    await assert.rejects(inference.classifyError("   "), /must not be empty/);
  } finally {
    await inference.dispose();
  }
});

test("DKT update returns 30 KCs and round-trippable serialized recurrent state", async () => {
  const inference = await LocalInference.load(paths);
  try {
    const first = await inference.updateMastery("KC_00", true);
    assert.equal(Object.keys(first.masteryByKc).length, 30);
    assert.ok(Object.values(first.masteryByKc).every((value) => value >= 0 && value <= 1));
    assert.deepEqual(first.state.shape, [2, 1, 256]);
    assert.equal(first.state.dtype, "float32-le");
    assert.equal(Buffer.from(first.state.h, "base64").byteLength, 2 * 256 * 4);
    assert.equal(Buffer.from(first.state.c, "base64").byteLength, 2 * 256 * 4);

    const second = await inference.updateMastery("KC_01", false, first.state);
    assert.equal(Object.keys(second.masteryByKc).length, 30);
    assert.notEqual(second.state.h, first.state.h);
    assert.notEqual(second.state.c, first.state.c);
    await assert.rejects(inference.updateMastery("KC_UNKNOWN", true), /Unknown KC id/);
    await assert.rejects(
      inference.updateMastery("KC_01", true, { ...first.state, modelVersion: "other-model" }),
      /different model version/,
    );
  } finally {
    await inference.dispose();
  }
});

test("classifier warm inference latency is measured locally", async (t) => {
  const inference = await LocalInference.load(paths);
  try {
    const input = "ValueError: operands could not be broadcast together";
    for (let index = 0; index < 10; index += 1) {
      await inference.classifyError(input);
    }
    const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      await inference.classifyError(input);
      samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    const medianMs = samples[Math.floor(samples.length * 0.5)];
    const p95Ms = samples[Math.floor(samples.length * 0.95)];
    t.diagnostic(`warm local classifier latency: median=${medianMs.toFixed(3)}ms p95=${p95Ms.toFixed(3)}ms (n=100)`);
    assert.ok(p95Ms < 100, "local classifier p95 should remain comfortably below 100ms");
  } finally {
    await inference.dispose();
  }
});