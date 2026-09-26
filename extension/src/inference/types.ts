export const DKT_LAYERS = 2;
export const DKT_HIDDEN_SIZE = 256;
export const DKT_KC_COUNT = 30;
export const DKT_STATE_SHAPE = [DKT_LAYERS, 1, DKT_HIDDEN_SIZE] as const;

export interface KcMappingEntry {
  kc_id: string;
  cluster_id: string;
  prerequisite: string | null;
}

export interface ModelMetadata {
  provenance: string;
  random_seed: number;
  classifier_classes: string[];
  n_kcs: number;
  dkt_hidden_size: number;
  dkt_embedding_size: number;
  dkt_num_layers: number;
  kc_mapping: KcMappingEntry[];
}

export interface SerializedDktState {
  modelVersion: string;
  dtype: "float32-le";
  shape: [2, 1, 256];
  h: string;
  c: string;
}

export interface ClassificationResult {
  label: string;
  confidence: number;
  scores: Record<string, number>;
  provenance: string;
}

export interface MasteryUpdateResult {
  masteryByKc: Record<string, number>;
  state: SerializedDktState;
  provenance: string;
}