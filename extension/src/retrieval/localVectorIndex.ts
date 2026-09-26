import type { ReferenceDocument } from "./portableCorpus.js";

export interface MasteryVector {
  [kcId: string]: number;
}

export interface RetrievalOptions {
  topK?: number;
  difficultyProximityWeight?: number;
}

export interface RetrievalResult {
  document: ReferenceDocument;
  similarity: number;
  difficultyProximity: number;
  score: number;
}

interface IndexedDocument {
  document: ReferenceDocument;
  vector: Float32Array;
}

export const DEFAULT_DIFFICULTY_PROXIMITY_WEIGHT = 0.2;

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error("Embedding vectors must have the same non-zero dimension");
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) {
    throw new Error("Embedding vectors must have non-zero magnitude");
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export class LocalVectorIndex {
  private readonly entries: IndexedDocument[];
  private readonly embeddingDimension: number;

  constructor(documents: readonly ReferenceDocument[], vectors: readonly Float32Array[]) {
    if (documents.length !== vectors.length) {
      throw new Error("Each reference document must have exactly one embedding vector");
    }
    const ids = new Set<string>();
    let dimension = 0;
    this.entries = documents.map((document, index) => {
      const vector = vectors[index];
      if (vector.length === 0 || !Array.from(vector).every(Number.isFinite)) {
        throw new Error(`Document ${document.id} has an invalid embedding vector`);
      }
      if (dimension === 0) {
        dimension = vector.length;
      } else if (vector.length !== dimension) {
        throw new Error("All corpus vectors must have the same dimension");
      }
      if (ids.has(document.id)) {
        throw new Error(`Duplicate reference document ID: ${document.id}`);
      }
      ids.add(document.id);
      return { document: { ...document }, vector: new Float32Array(vector) };
    });
    this.embeddingDimension = dimension;
  }

  search(queryVector: Float32Array, masteryByKc: MasteryVector, options: RetrievalOptions = {}): RetrievalResult[] {
    if (this.entries.length === 0) {
      return [];
    }
    if (queryVector.length !== this.embeddingDimension || this.embeddingDimension === 0) {
      throw new Error(`Query vector must have dimension ${this.embeddingDimension}`);
    }
    if (!Array.from(queryVector).every(Number.isFinite)) {
      throw new Error("Query vector must contain only finite numbers");
    }
    const topK = options.topK ?? 5;
    const proximityWeight = options.difficultyProximityWeight ?? DEFAULT_DIFFICULTY_PROXIMITY_WEIGHT;
    if (!Number.isInteger(topK) || topK < 1) {
      throw new Error("topK must be a positive integer");
    }
    if (!Number.isFinite(proximityWeight) || proximityWeight < 0 || proximityWeight > 1) {
      throw new Error("difficultyProximityWeight must be between 0 and 1");
    }

    const results: RetrievalResult[] = [];
    for (const entry of this.entries) {
      const mastery = masteryByKc[entry.document.kcId] ?? 0;
      if (!Number.isFinite(mastery) || mastery < 0 || mastery > 1) {
        throw new Error(`Mastery for ${entry.document.kcId} must be between 0 and 1`);
      }
      const difficultyCeiling = 0.4 + mastery * 0.6;
      if (entry.document.difficulty > difficultyCeiling) {
        continue;
      }

      const similarity = cosineSimilarity(queryVector, entry.vector);
      const difficultyProximity = 1 - Math.abs(entry.document.difficulty - mastery);
      const score = similarity * (1 - proximityWeight) + difficultyProximity * proximityWeight;
      results.push({ document: entry.document, similarity, difficultyProximity, score });
    }

    results.sort(
      (left, right) =>
        right.score - left.score ||
        right.similarity - left.similarity ||
        left.document.id.localeCompare(right.document.id),
    );
    return results.slice(0, topK);
  }
}