export type KnowledgeBand = "red" | "yellow" | "green" | "thresholds-unavailable";

export interface KnowledgeComponentState {
  kcId: string;
  mastery: number;
  band: KnowledgeBand;
}

export const KNOWLEDGE_COMPONENT_COUNT = 30;

export function getKnowledgeBand(_mastery: number): KnowledgeBand {
  // The source taxonomy and its cutoffs were not supplied with the repository.
  return "thresholds-unavailable";
}

export function buildKnowledgeMap(
  kcIds: readonly string[],
  masteryByKc: Readonly<Record<string, number>>,
): KnowledgeComponentState[] {
  return kcIds.map((kcId) => {
    const mastery = masteryByKc[kcId] ?? 0.5;
    return {
      kcId,
      mastery: Math.max(0, Math.min(1, mastery)),
      band: getKnowledgeBand(mastery),
    };
  });
}
