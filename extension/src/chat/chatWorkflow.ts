import type { GatewayChatRequest, GatewayChatResponse } from "../auth/gatewayClient.js";
import type { StoredTokens } from "../auth/types.js";
import type { ClassificationResult, MasteryUpdateResult, SerializedDktState } from "../inference/types.js";
import type { RetrievalResult } from "../retrieval/localVectorIndex.js";

export interface ChatInference {
  classifyError(errorText: string): Promise<ClassificationResult>;
  updateMastery(kcId: string, resolved: boolean, previousState?: SerializedDktState): Promise<MasteryUpdateResult>;
  getKnowledgeComponents(): string[];
}

export interface ChatRetrieval {
  retrieve(query: string, masteryByKc: Record<string, number>, options?: { topK?: number }): Promise<RetrievalResult[]>;
}

export interface ChatGateway {
  chat(accessToken: string, payload: GatewayChatRequest): Promise<GatewayChatResponse>;
  feedback?(accessToken: string, payload: {
    interaction_id: string;
    resolved: boolean;
    mastery_delta?: number;
  }): PromiseLike<void>;
}

export interface ChatTokenStore {
  get(): Promise<StoredTokens | undefined>;
}

export interface ChatWorkflowOptions {
  inference: ChatInference;
  retrieval: ChatRetrieval;
  gateway: ChatGateway;
  tokens: ChatTokenStore;
  getDktState(): SerializedDktState | undefined;
  saveDktState(state: SerializedDktState): Promise<void>;
  telemetryEnabled?: boolean;
  onFirstSocraticQuestion?(): void;
}

export interface ChatTurnResult {
  response: string;
  category: string;
  confidence: number;
  masteryPercent: number;
  suggestions: [string, string];
}

const INITIAL_MASTERY = 0.5;
function createFollowUpSuggestions(category: string): [string, string] {
  const readableCategory = category.replaceAll("_", " ");
  return [
    `What clues point to this ${readableCategory} error?`,
    "Can you give me a smaller hint?",
  ];
}

function averageMastery(values: Record<string, number>): number {
  const scores = Object.values(values);
  return scores.length === 0 ? INITIAL_MASTERY : scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

export class ChatWorkflow {
  private masteryByKc: Record<string, number>;
  private lastRelevantKcId: string | undefined;
  private activeErrorText: string | undefined;
  private interactionActive = false;
  private hintDepth = 0;
  private activeInteractionId: string | undefined;
  private recordedFirstQuestion = false;

  constructor(private readonly options: ChatWorkflowOptions) {
    this.masteryByKc = Object.fromEntries(
      options.inference.getKnowledgeComponents().map((kcId) => [kcId, INITIAL_MASTERY]),
    );
  }

  get masteryPercent(): number {
    return Math.round(averageMastery(this.masteryByKc) * 100);
  }

  get isInteractionActive(): boolean {
    return this.interactionActive;
  }

  get masterySnapshot(): Record<string, number> {
    return { ...this.masteryByKc };
  }

  async send(text: string): Promise<ChatTurnResult> {
    return this.runTurn(text, false);
  }

  async followUp(text: string): Promise<ChatTurnResult> {
    return this.runTurn(text, true);
  }

  private async runTurn(text: string, isFollowUp: boolean): Promise<ChatTurnResult> {
    const message = text.trim();
    if (!message) {
      throw new Error("Enter an error or question before sending.");
    }
    if (message.length > 4_000) {
      throw new Error("Keep your message under 4,000 characters.");
    }

    const errorText = isFollowUp && this.activeErrorText ? this.activeErrorText : message;
    const classification = await this.options.inference.classifyError(errorText);
    const retrieved = await this.options.retrieval.retrieve(
      `${message}\n${errorText}\n${classification.label}`,
      this.masteryByKc,
      { topK: 4 },
    );
    this.lastRelevantKcId = retrieved[0]?.document.kcId;

    const tokens = await this.options.tokens.get();
    if (!tokens?.access_token) {
      throw new Error("Sign in with GitHub before starting a MAST chat.");
    }

    const payload: GatewayChatRequest = {
      message,
      error_text: errorText,
      error_category: classification.label,
      mastery_by_kc: this.masteryByKc,
      retrieved_context: retrieved.map((result) => result.document.text.slice(0, 2_000)),
      hint_depth: this.hintDepth,
    };
    if (this.options.telemetryEnabled) {
      payload.classification_confidence = classification.confidence;
      payload.kc_ids = [...new Set(retrieved.map((result) => result.document.kcId))];
    }
    const result = await this.options.gateway.chat(tokens.access_token, payload);
    if (!this.recordedFirstQuestion) {
      this.recordedFirstQuestion = true;
      this.options.onFirstSocraticQuestion?.();
    }
    this.activeInteractionId = result.interactionId;
    this.activeErrorText = errorText;
    this.interactionActive = true;
    this.hintDepth += 1;

    return {
      response: result.response,
      category: classification.label,
      confidence: classification.confidence,
      masteryPercent: this.masteryPercent,
      suggestions: createFollowUpSuggestions(classification.label),
    };
  }

  async resolve(): Promise<number> {
    if (!this.interactionActive) {
      throw new Error("There is no active MAST interaction to resolve.");
    }

    if (this.lastRelevantKcId) {
      const previousMastery = this.masteryByKc[this.lastRelevantKcId];
      const update = await this.options.inference.updateMastery(
        this.lastRelevantKcId,
        true,
        this.options.getDktState(),
      );
      this.masteryByKc = update.masteryByKc;
      await this.options.saveDktState(update.state);
      const currentMastery = this.masteryByKc[this.lastRelevantKcId];
      const tokens = await this.options.tokens.get();
      if (
        this.options.telemetryEnabled &&
        this.activeInteractionId &&
        tokens?.access_token &&
        this.options.gateway.feedback
      ) {
        try {
          await this.options.gateway.feedback(tokens.access_token, {
            interaction_id: this.activeInteractionId,
            resolved: true,
            ...(previousMastery !== undefined && currentMastery !== undefined
              ? { mastery_delta: currentMastery - previousMastery }
              : {}),
          });
        } catch {
          // Telemetry failure must not interrupt the local mastery update.
        }
      }
    }
    this.interactionActive = false;
    this.hintDepth = 0;
    this.lastRelevantKcId = undefined;
    this.activeInteractionId = undefined;
    return this.masteryPercent;
  }
}

export function isChatPanelMessage(value: unknown): value is
  | { type: "submit"; text: string }
  | { type: "followUp"; text: string }
  | { type: "resolved" } {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (message.type === "submit" || message.type === "followUp") {
    return typeof message.text === "string" && message.text.length > 0 && message.text.length <= 4_000;
  }
  return message.type === "resolved" && Object.keys(message).length === 1;
}
