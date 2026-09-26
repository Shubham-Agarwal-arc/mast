import { readFile } from "node:fs/promises";

export interface ReferenceDocument {
  id: string;
  kcId: string;
  difficulty: number;
  text: string;
}

export interface PortableCorpus {
  schemaVersion: 1;
  provenance: "prototype_import" | "synthetic_test_fixture" | "source_not_provided";
  documents: ReferenceDocument[];
}

export function validatePortableCorpus(value: unknown): PortableCorpus {
  if (typeof value !== "object" || value === null) {
    throw new Error("Reference corpus must be an object");
  }
  const corpus = value as Partial<PortableCorpus>;
  if (corpus.schemaVersion !== 1 || !Array.isArray(corpus.documents)) {
    throw new Error("Reference corpus must use schemaVersion 1 and include documents");
  }
  if (
    corpus.provenance !== "prototype_import" &&
    corpus.provenance !== "synthetic_test_fixture" &&
    corpus.provenance !== "source_not_provided"
  ) {
    throw new Error("Reference corpus provenance is missing or unsupported");
  }

  const ids = new Set<string>();
  for (const document of corpus.documents) {
    if (
      !document ||
      typeof document.id !== "string" ||
      !document.id.trim() ||
      typeof document.kcId !== "string" ||
      !document.kcId.trim() ||
      typeof document.text !== "string" ||
      !document.text.trim() ||
      typeof document.difficulty !== "number" ||
      !Number.isFinite(document.difficulty) ||
      document.difficulty < 0 ||
      document.difficulty > 1
    ) {
      throw new Error("Each corpus document needs a stable ID, KC ID, text, and difficulty from 0 to 1");
    }
    if (ids.has(document.id)) {
      throw new Error(`Duplicate reference document ID: ${document.id}`);
    }
    ids.add(document.id);
  }

  return corpus as PortableCorpus;
}

export async function loadPortableCorpus(filePath: string): Promise<PortableCorpus> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  return validatePortableCorpus(parsed);
}