# Third-Party Notices

## `Xenova/all-MiniLM-L6-v2`

- Upstream: https://huggingface.co/Xenova/all-MiniLM-L6-v2
- Pinned revision: `751bff37182d3f1213fa05d7196b954e230abad9`
- Upstream-declared license: Apache-2.0
- License text: `licenses/Apache-2.0.txt`
- Bundled ONNX file: `models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx`
- SHA-256: `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`

The upstream model card and configuration are included under `models/Xenova/all-MiniLM-L6-v2/`. The embedding model is distinct from the synthetic MAST classifier/DKT bootstrap artifacts described below.

## MAST synthetic bootstrap inference assets

`models/MAST-Synthetic/` contains the generated MAST classifier and DKT ONNX artifacts plus their `metadata.json`. Their provenance is `SYNTHETIC_BOOTSTRAP_NOT_RESEARCH_MODEL`; they are not the original research weights and carry no research accuracy claim. The original research weights and evaluation data were not present in the repository.
