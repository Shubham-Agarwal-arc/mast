import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(extensionRoot, "package.json"), "utf8")) as {
  activationEvents: string[];
  contributes: { walkthroughs: Array<{ id: string; steps: Array<{
    id: string;
    media: { markdown?: string };
    completionEvents: string[];
  }> }> };
  icon: string;
  license: string;
  scripts: Record<string, string>;
};

test("Marketplace manifest has bounded first-run walkthrough and safe completion flow", async () => {
  const walkthrough = manifest.contributes.walkthroughs.find((candidate) => candidate.id === "firstRun");
  assert.ok(walkthrough);
  assert.ok(walkthrough.steps.length <= 5);
  assert.deepEqual(walkthrough.steps.map((step) => step.id), ["signIn", "openChat", "firstQuestion"]);
  assert.ok(manifest.activationEvents.includes("onStartupFinished"));

  const walkthroughCopy = await Promise.all(
    walkthrough.steps.map((step) => readFile(path.join(extensionRoot, step.media.markdown ?? ""), "utf8")),
  );
  assert.match(walkthrough.steps[0].completionEvents.join(" "), /onCommand:mast\.signIn/);
  assert.match(walkthrough.steps[1].completionEvents.join(" "), /onCommand:mast\.openChat/);
  assert.match(walkthrough.steps[2].completionEvents.join(" "), /onCommand:mast\.internal\.firstQuestionComplete/);
  assert.match(walkthroughCopy.join("\n"), /Sign in with GitHub/);
  assert.match(walkthroughCopy.join("\n"), /Open MAST Chat/);
  assert.doesNotMatch(walkthroughCopy.join("\n"), /(?:enter|paste|configure) (?:your )?(?:provider )?API key/i);
});

test("package metadata points to local license and installable PNG icon", async () => {
  assert.equal(manifest.license, "MIT");
  const icon = await readFile(path.join(extensionRoot, manifest.icon));
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.match(manifest.scripts["vscode:prepublish"], /compile/);
  assert.match(manifest.scripts["package:vsix"], /@vscode\/vsce package/);
  assert.equal(manifest.scripts["package:openvsx"], "npm run package:vsix");
  assert.match(await readFile(path.join(extensionRoot, "LICENSE"), "utf8"), /MIT License/);
});

test("package includes the labeled inference assets and excludes development files", async () => {
  const metadata = JSON.parse(
    await readFile(path.join(extensionRoot, "models", "MAST-Synthetic", "metadata.json"), "utf8"),
  ) as { provenance: string };
  assert.equal(metadata.provenance, "SYNTHETIC_BOOTSTRAP_NOT_RESEARCH_MODEL");
  await readFile(path.join(extensionRoot, "models", "MAST-Synthetic", "error_classifier.synthetic.onnx"));
  await readFile(path.join(extensionRoot, "models", "MAST-Synthetic", "dkt.synthetic.onnx"));
  await readFile(path.join(extensionRoot, "models", "Xenova", "all-MiniLM-L6-v2", "onnx", "model_quantized.onnx"));

  const ignore = await readFile(path.join(extensionRoot, ".vscodeignore"), "utf8");
  for (const pattern of [
    ".env.*",
    "*.key",
    "*.pem",
    "credentials.*",
    "test/**",
    "out/test/**",
    "src/**",
    "package-lock.json",
    "*.tsbuildinfo",
  ]) {
    assert.ok(ignore.includes(pattern), `expected packaging exclusion ${pattern}`);
  }
  assert.doesNotMatch(ignore, /^models\//m);
  assert.doesNotMatch(ignore, /^data\//m);
  assert.match(await readFile(path.join(extensionRoot, "THIRD_PARTY_NOTICES.md"), "utf8"), /Apache-2\.0/);
  assert.match(await readFile(path.join(extensionRoot, "licenses", "Apache-2.0.txt"), "utf8"), /Apache License/);
});
