import { loadPortableCorpus } from "./portableCorpus.js";
import type { PortableCorpus } from "./portableCorpus.js";
import { LocalVectorIndex } from "./localVectorIndex.js";
import type { MasteryVector, RetrievalOptions, RetrievalResult } from "./localVectorIndex.js";
import { MiniLmEmbedder } from "./miniLmEmbedder.js";

export class LocalRetrieval {
  private constructor(
    private readonly corpus: PortableCorpus,
    private readonly embedder: MiniLmEmbedder,
    private readonly index: LocalVectorIndex,
  ) {}

  static async load(extensionPath: string, corpusPath: string): Promise<LocalRetrieval> {
    const corpus = await loadPortableCorpus(corpusPath);
    const embedder = await MiniLmEmbedder.load(extensionPath);
    const embeddings = await embedder.embed(corpus.documents.map((document) => document.text));
    return new LocalRetrieval(corpus, embedder, new LocalVectorIndex(corpus.documents, embeddings));
  }

  async retrieve(query: string, masteryByKc: MasteryVector, options?: RetrievalOptions): Promise<RetrievalResult[]> {
    const [queryEmbedding] = await this.embedder.embed([query]);
    return this.index.search(queryEmbedding, masteryByKc, options);
  }

  get provenance(): PortableCorpus["provenance"] {
    return this.corpus.provenance;
  }

  async dispose(): Promise<void> {
    await this.embedder.dispose();
  }
}