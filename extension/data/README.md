# Local Reference Corpus

`reference-documents.v1.json` is the versioned, portable runtime corpus format.
It is intentionally empty because the repository did not include the original
ChromaDB documents, text, difficulty annotations, or their KC assignments.
Do not fill this file with invented text and describe it as source material.

Block 6 algorithm tests use the clearly-labelled synthetic fixture at
`../test/fixtures/reference-documents.synthetic.json`. Replace the empty
production corpus only when the original source corpus and metadata are
available for a faithful import.

Each document uses a stable `id`, `kcId`, normalized `difficulty` in `[0, 1]`,
and `text`. The corpus also carries `schemaVersion` and `provenance`.

Retrieval first excludes documents whose difficulty exceeds the exact
mastery-dependent ceiling `0.4 + mastery * 0.6`. Eligible documents are then
ranked with cosine similarity weighted at 0.8 and difficulty proximity weighted
at 0.2. Difficulty proximity is `1 - abs(documentDifficulty - mastery)`; ties
are resolved by similarity and then stable document ID. The PRD specifies the
ceiling and both ranking signals but no numeric weight, so 0.2 is the explicit
Block 6 call and is covered by tests.