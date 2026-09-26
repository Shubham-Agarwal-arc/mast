import { readFile } from "node:fs/promises";
import * as ort from "onnxruntime-node";

import type {
  ClassificationResult,
  KcMappingEntry,
  MasteryUpdateResult,
  ModelMetadata,
  SerializedDktState,
} from "./types.js";
import { DKT_HIDDEN_SIZE, DKT_KC_COUNT, DKT_LAYERS, DKT_STATE_SHAPE } from "./types.js";
import type { ModelPaths } from "./modelPaths.js";

const classifierInputName = "error_text";
const classifierLabelOutputName = "label";
const classifierScoresOutputName = "probabilities";
const dktInputNames = ["interaction_ids", "h0", "c0"] as const;
const dktOutputNames = ["mastery", "hn", "cn"] as const;

function requireNames(actual: readonly string[], required: readonly string[], kind: string): void {
  const missing = required.filter((name) => !actual.includes(name));
  if (missing.length > 0) {
    throw new Error(`${kind} ONNX model is missing expected names: ${missing.join(", ")}`);
  }
}

function readKcMapping(metadata: ModelMetadata): KcMappingEntry[] {
  if (
    metadata.n_kcs !== DKT_KC_COUNT ||
    metadata.dkt_hidden_size !== DKT_HIDDEN_SIZE ||
    metadata.dkt_num_layers !== DKT_LAYERS ||
    metadata.kc_mapping.length !== DKT_KC_COUNT
  ) {
    throw new Error("Model metadata does not match the Block 4 DKT contract");
  }
  return metadata.kc_mapping;
}

function decodeFloat32Le(value: string, expectedCount: number): Float32Array {
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength !== expectedCount * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error(`Serialized DKT tensor must contain ${expectedCount} float32 values`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Float32Array(expectedCount);
  for (let index = 0; index < expectedCount; index += 1) {
    values[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
  }
  return values;
}

function encodeFloat32Le(values: Float32Array): string {
  const bytes = Buffer.allocUnsafe(values.length * Float32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < values.length; index += 1) {
    view.setFloat32(index * Float32Array.BYTES_PER_ELEMENT, values[index], true);
  }
  return bytes.toString("base64");
}

export class LocalInference {
  private constructor(
    private readonly classifier: ort.InferenceSession,
    private readonly dkt: ort.InferenceSession,
    private readonly metadata: ModelMetadata,
    private readonly kcMapping: KcMappingEntry[],
  ) {
    requireNames(this.classifier.inputNames, [classifierInputName], "Classifier");
    requireNames(
      this.classifier.outputNames,
      [classifierLabelOutputName, classifierScoresOutputName],
      "Classifier",
    );
    requireNames(this.dkt.inputNames, dktInputNames, "DKT");
    requireNames(this.dkt.outputNames, dktOutputNames, "DKT");
    if (metadata.classifier_classes.length !== 8) {
      throw new Error("Classifier metadata must contain exactly eight labels");
    }
  }

  static async load(paths: ModelPaths): Promise<LocalInference> {
    const metadata = JSON.parse(await readFile(paths.metadata, "utf8")) as ModelMetadata;
    const kcMapping = readKcMapping(metadata);
    const [classifier, dkt] = await Promise.all([
      ort.InferenceSession.create(paths.classifier),
      ort.InferenceSession.create(paths.dkt),
    ]);
    try {
      return new LocalInference(classifier, dkt, metadata, kcMapping);
    } catch (error) {
      await Promise.all([classifier.release(), dkt.release()]);
      throw error;
    }
  }

  async classifyError(errorText: string): Promise<ClassificationResult> {
    if (!errorText.trim()) {
      throw new Error("Error text must not be empty");
    }
    const input = new ort.Tensor("string", [errorText], [1, 1]);
    const result = await this.classifier.run({ [classifierInputName]: input });
    const label = result[classifierLabelOutputName];
    const probabilities = result[classifierScoresOutputName];
    if (!(label?.data instanceof Array) || !(probabilities?.data instanceof Float32Array)) {
      throw new Error("Classifier returned unexpected ONNX output tensor types");
    }
    if (label.dims[0] !== 1 || probabilities.dims[0] !== 1 || probabilities.dims[1] !== 8) {
      throw new Error("Classifier returned unexpected ONNX output dimensions");
    }

    const scores: Record<string, number> = {};
    for (let index = 0; index < this.metadata.classifier_classes.length; index += 1) {
      scores[this.metadata.classifier_classes[index]] = probabilities.data[index];
    }
    const labelValue = label.data[0];
    if (typeof labelValue !== "string") {
      throw new Error("Classifier returned a non-string label");
    }
    const predictedLabel = labelValue;
    const confidence = scores[predictedLabel];
    if (confidence === undefined) {
      throw new Error(`Classifier returned unknown label: ${predictedLabel}`);
    }
    return {
      label: predictedLabel,
      confidence,
      scores,
      provenance: this.metadata.provenance,
    };
  }

  async updateMastery(
    kcId: string,
    resolved: boolean,
    previousState?: SerializedDktState,
  ): Promise<MasteryUpdateResult> {
    const kcIndex = this.kcMapping.findIndex((entry) => entry.kc_id === kcId);
    if (kcIndex < 0) {
      throw new Error(`Unknown KC id: ${kcId}`);
    }

    const modelVersion = `${this.metadata.provenance}:${this.metadata.random_seed}`;
    if (previousState && previousState.modelVersion !== modelVersion) {
      throw new Error("Serialized DKT state belongs to a different model version");
    }
    if (
      previousState &&
      (previousState.dtype !== "float32-le" || previousState.shape.join(",") !== DKT_STATE_SHAPE.join(","))
    ) {
      throw new Error("Serialized DKT state has an incompatible dtype or shape");
    }

    const stateValueCount = DKT_LAYERS * DKT_HIDDEN_SIZE;
    const h0 = previousState ? decodeFloat32Le(previousState.h, stateValueCount) : new Float32Array(stateValueCount);
    const c0 = previousState ? decodeFloat32Le(previousState.c, stateValueCount) : new Float32Array(stateValueCount);
    const token = BigInt(kcIndex * 2 + Number(resolved));
    const result = await this.dkt.run({
      interaction_ids: new ort.Tensor("int64", BigInt64Array.of(token), [1, 1]),
      h0: new ort.Tensor("float32", h0, [...DKT_STATE_SHAPE]),
      c0: new ort.Tensor("float32", c0, [...DKT_STATE_SHAPE]),
    });

    const mastery = result.mastery;
    const hn = result.hn;
    const cn = result.cn;
    if (
      !(mastery?.data instanceof Float32Array) ||
      !(hn?.data instanceof Float32Array) ||
      !(cn?.data instanceof Float32Array)
    ) {
      throw new Error("DKT returned unexpected ONNX output tensor types");
    }
    if (
      mastery.dims.join(",") !== `1,1,${DKT_KC_COUNT}` ||
      hn.dims.join(",") !== DKT_STATE_SHAPE.join(",") ||
      cn.dims.join(",") !== DKT_STATE_SHAPE.join(",")
    ) {
      throw new Error("DKT returned unexpected ONNX output dimensions");
    }

    const masteryByKc: Record<string, number> = {};
    for (let index = 0; index < this.kcMapping.length; index += 1) {
      masteryByKc[this.kcMapping[index].kc_id] = mastery.data[index];
    }
    return {
      masteryByKc,
      state: {
        modelVersion,
        dtype: "float32-le",
        shape: [...DKT_STATE_SHAPE],
        h: encodeFloat32Le(hn.data),
        c: encodeFloat32Le(cn.data),
      },
      provenance: this.metadata.provenance,
    };
  }

  getKnowledgeComponents(): string[] {
    return this.kcMapping.map((entry) => entry.kc_id);
  }

  async dispose(): Promise<void> {
    await Promise.all([this.classifier.release(), this.dkt.release()]);
  }
}