import path from "node:path";

import { env, pipeline } from "@xenova/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSION = 384;

interface FeatureExtractor {
  model?: {
    dispose?: () => void | Promise<void>;
  };
  (texts: string[], options: { pooling: "mean"; normalize: true }): Promise<{
    dims: number[];
    data: Float32Array;
  }>;
}

export function resolveMiniLmModelRoot(extensionPath: string): string {
  return path.resolve(extensionPath, "models");
}

export class MiniLmEmbedder {
  private constructor(private readonly extractor: FeatureExtractor) {}

  static async load(extensionPath: string): Promise<MiniLmEmbedder> {
    env.localModelPath = resolveMiniLmModelRoot(extensionPath);
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    env.backends.onnx.wasm.numThreads = 1;

    const extractor = await pipeline("feature-extraction", MODEL_ID, { quantized: true }) as unknown as FeatureExtractor;
    return new MiniLmEmbedder(extractor);
  }

  async embed(texts: readonly string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }
    if (texts.some((text) => !text.trim())) {
      throw new Error("Embedding input text must not be empty");
    }
    const output = await this.extractor([...texts], { pooling: "mean", normalize: true });
    if (
      output.dims.length !== 2 ||
      output.dims[0] !== texts.length ||
      output.dims[1] !== EMBEDDING_DIMENSION ||
      output.data.length !== texts.length * EMBEDDING_DIMENSION
    ) {
      throw new Error("all-MiniLM-L6-v2 returned an unexpected embedding shape");
    }

    return texts.map((_, index) => {
      const start = index * EMBEDDING_DIMENSION;
      return output.data.slice(start, start + EMBEDDING_DIMENSION);
    });
  }

  async dispose(): Promise<void> {
    await this.extractor.model?.dispose?.();
  }
}