import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import test from "node:test";

import { LocalRetrieval } from "../src/retrieval/localRetrieval.js";
import { LocalVectorIndex } from "../src/retrieval/localVectorIndex.js";
import { loadPortableCorpus, validatePortableCorpus } from "../src/retrieval/portableCorpus.js";
import type { MasteryVector } from "../src/retrieval/localVectorIndex.js";
import type { PortableCorpus } from "../src/retrieval/portableCorpus.js";

const testDirectory = path.resolve(process.cwd(), "test");
const fixturePath = path.join(testDirectory, "fixtures", "reference-documents.synthetic.json");

const unitVectors = new Map<string, Float32Array>([
  ["synthetic-kc00-foundation", new Float32Array([1, 0])],
  ["synthetic-kc00-intermediate", new Float32Array([0.8, 0.6])],
  ["synthetic-kc00-advanced", new Float32Array([0.6, 0.8])],
  ["synthetic-kc01-basic", new Float32Array([0.99, 0.1])],
  ["synthetic-kc01-advanced", new Float32Array([0.1, 0.99])],
  ["synthetic-kc02-middle", new Float32Array([0.7, 0.7])],
]);

async function loadFixture(): Promise<PortableCorpus> {
  return loadPortableCorpus(fixturePath);
}

function makeIndex(corpus: PortableCorpus): LocalVectorIndex {
  return new LocalVectorIndex(
    corpus.documents,
    corpus.documents.map((document) => unitVectors.get(document.id)!),
  );
}

test("corpus file and fixture are explicitly portable and synthetic", async () => {
  const corpus = await loadFixture();
  assert.equal(corpus.provenance, "synthetic_test_fixture");
  assert.equal(corpus.documents.length, 6);
  assert.equal(validatePortableCorpus(corpus).schemaVersion, 1);

  const productionCorpus = JSON.parse(
    await readFile(path.resolve(testDirectory, "..", "data", "reference-documents.v1.json"), "utf8"),
  ) as PortableCorpus;
  assert.equal(productionCorpus.provenance, "source_not_provided");
  assert.deepEqual(productionCorpus.documents, []);
});

test("difficulty ceiling filters documents at low, middle, and high mastery", async () => {
  const corpus = await loadFixture();
  const kc00Corpus = {
    ...corpus,
    documents: corpus.documents.filter((document) => document.kcId === "KC_00"),
  };
  const index = makeIndex(kc00Corpus);
  const query = new Float32Array([1, 0]);

  const lowMastery = index.search(query, { KC_00: 0 }, { topK: 10 });
  assert.deepEqual(
    lowMastery.map((result) => result.document.id).sort(),
    ["synthetic-kc00-foundation"],
  );

  const middleMastery = index.search(query, { KC_00: 0.5 }, { topK: 10 });
  assert.deepEqual(
    middleMastery.map((result) => result.document.id).sort(),
    ["synthetic-kc00-foundation", "synthetic-kc00-intermediate"],
  );

  const highMastery = index.search(query, { KC_00: 1 }, { topK: 10 });
  assert.equal(highMastery.length, 3);
  assert.deepEqual(
    highMastery.map((result) => result.document.id).sort(),
    ["synthetic-kc00-advanced", "synthetic-kc00-foundation", "synthetic-kc00-intermediate"],
  );
});

test("eligible results rank by similarity adjusted for difficulty proximity", async () => {
  const corpus = await loadFixture();
  const index = makeIndex(corpus);
  const results = index.search(new Float32Array([1, 0]), { KC_00: 0.5 }, { topK: 10 });

  assert.equal(results[0].document.id, "synthetic-kc00-foundation");
  assert.ok(results[0].score > results[1].score);
  assert.ok(results.every((result) => result.document.difficulty <= 0.4 + 0.5 * 0.6));
});

test("index copies vectors and returns deterministic tie ordering", () => {
  const corpus = validatePortableCorpus({
    schemaVersion: 1,
    provenance: "synthetic_test_fixture",
    documents: [
      { id: "synthetic-tie-b", kcId: "KC_00", difficulty: 0.4, text: "fixture b" },
      { id: "synthetic-tie-a", kcId: "KC_00", difficulty: 0.4, text: "fixture a" },
    ],
  });
  const sourceVectors = [new Float32Array([1, 0]), new Float32Array([1, 0])];
  const index = new LocalVectorIndex(corpus.documents, sourceVectors);
  sourceVectors[0][0] = 0;

  const first = index.search(new Float32Array([1, 0]), { KC_00: 0.5 }, { topK: 2 });
  const second = index.search(new Float32Array([1, 0]), { KC_00: 0.5 }, { topK: 2 });
  assert.deepEqual(first.map((result) => result.document.id), ["synthetic-tie-a", "synthetic-tie-b"]);
  assert.deepEqual(first, second);
});

test("an empty production corpus returns no fabricated retrieval results", () => {
  const emptyIndex = new LocalVectorIndex([], []);
  assert.deepEqual(emptyIndex.search(new Float32Array([1, 0]), {}, { topK: 5 }), []);
});

test("index rejects duplicate documents and malformed embeddings", () => {
  const document = { id: "same", kcId: "KC_00", difficulty: 0.2, text: "fixture" };
  assert.throws(
    () => new LocalVectorIndex([document, document], [new Float32Array([1]), new Float32Array([1])]),
    /Duplicate reference document ID/,
  );
  assert.throws(
    () => new LocalVectorIndex([document], [new Float32Array([Number.NaN])]),
    /invalid embedding vector/,
  );
});

test("bundled MiniLM model embeds and retrieves locally with fetch disabled", async (t) => {
  const extensionPath = path.resolve(testDirectory, "..");
  const retrieval = await LocalRetrieval.load(extensionPath, fixturePath);
  const mastery: MasteryVector = { KC_00: 0.5, KC_01: 0.5, KC_02: 0.5 };
  try {
    const first = await retrieval.retrieve("tensor shapes and broadcasting", mastery, { topK: 4 });
    assert.equal(retrieval.provenance, "synthetic_test_fixture");
    assert.ok(first.length > 0);
    assert.ok(first.every((result) => result.document.difficulty <= 0.4 + mastery[result.document.kcId] * 0.6));
    assert.ok(first.every((result) => Number.isFinite(result.similarity) && Number.isFinite(result.score)));

    for (let index = 0; index < 5; index += 1) {
      await retrieval.retrieve("tensor shapes and broadcasting", mastery, { topK: 4 });
    }
    const samples: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const started = performance.now();
      await retrieval.retrieve("tensor shapes and broadcasting", mastery, { topK: 4 });
      samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    const medianMs = samples[Math.floor(samples.length * 0.5)];
    const p95Ms = samples[Math.floor(samples.length * 0.95)];
    t.diagnostic(`local MiniLM retrieval latency: median=${medianMs.toFixed(3)}ms p95=${p95Ms.toFixed(3)}ms (n=30)`);
  } finally {
    await retrieval.dispose();
  }
});