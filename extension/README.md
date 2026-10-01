# MAST for Visual Studio Code

MAST is a Socratic tutor for machine-learning debugging. It helps you reason through an error with questions instead of handing over a corrected solution.

## Try MAST

1. Install MAST and open the **Your first MAST question** walkthrough.
2. Sign in with GitHub.
3. Open **MAST: Open Chat**, then paste a Python error or ask about a machine-learning concept.

The Managed Cloud flow uses MAST's server-side model configuration. It does not ask you to provide a model-provider API key. A provider key is not required to use the default flow.

## What runs where

Error classification, retrieval, and mastery updates run locally in the extension. Chat text and any included error/code context are sent to the configured MAST Gateway for Socratic generation and verification. MAST does not add a third-party telemetry SDK. Optional derived-metadata telemetry is off by default and can be changed with `mast.telemetryEnabled` in Settings.

## Current model and content limitations

The classifier and DKT assets currently included in this repository are synthetic bootstrap artifacts, not the original research weights. They are labeled as synthetic in their metadata and must not be used to claim research accuracy or learning outcomes. The bundled MiniLM embedding model is the upstream `Xenova/all-MiniLM-L6-v2` Apache-2.0 model at the pinned revision listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The original MAST reference-document corpus, original KC taxonomy, and mastery thresholds were not supplied. Production retrieval therefore has no source corpus, and the Knowledge Map uses neutral mastery bars rather than invented color bands. See the [Build State](https://github.com/Shubham-Agarwal-arc/mast/blob/main/MAST_BUILD_STATE.md) for current validation and data caveats.

## Commands

- **MAST: Open Chat** opens the tutoring panel.
- **MAST: Open Knowledge Map** opens local mastery estimates.
- **MAST: Run Python and Capture Error** runs the active Python file in the workspace and can route captured stderr into Chat.
- **MAST: Sign In with GitHub** starts managed Gateway sign-in.

## Settings

- `mast.gatewayUrl` selects the Gateway URL. Remote URLs must use HTTPS.
- `mast.telemetryEnabled` defaults to `false`. When enabled, MAST sends derived classification confidence/KC identifiers and content-free resolution feedback to the Gateway; message, error, and code content are not telemetry fields.
- `mast.modelDirectory` optionally selects a local classifier/DKT model directory.
- `mast.pythonCommand` selects the executable used by the explicit run-and-capture command.

## Development and packaging

From this directory, run `npm ci`, `npm test`, and `npm run typecheck`. To create a local VS Code package, run `npm run package:vsix`; this invokes `@vscode/vsce` through `npx`. Inspect and install the resulting `.vsix` locally before any registry release.

The same validated `.vsix` can be submitted to the VS Code Marketplace and Open VSX. The manifest publisher value `mast` is a placeholder until the publisher account is confirmed in both registries. This repository does not publish automatically; publication requires a separately authorized release and publisher credentials.

## License

MAST source is provided under the MIT License. Bundled third-party assets retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
