import * as vscode from "vscode";

import { LocalInference } from "./inference/localInference.js";
import { resolveModelPaths } from "./inference/modelPaths.js";
import type { SerializedDktState } from "./inference/types.js";

const dktStateKey = "mast.dktHiddenState.v1";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configuredDirectory = vscode.workspace.getConfiguration("mast").get<string>("modelDirectory", "");
  const paths = resolveModelPaths(context.extensionPath, configuredDirectory);
  const inference = await LocalInference.load(paths);
  context.subscriptions.push({ dispose: () => void inference.dispose() });

  context.subscriptions.push(
    vscode.commands.registerCommand("mast.classifyError", async () => {
      const errorText = await vscode.window.showInputBox({
        prompt: "Paste a Python error to classify locally",
        ignoreFocusOut: true,
      });
      if (errorText === undefined) {
        return;
      }
      try {
        const result = await inference.classifyError(errorText);
        const syntheticNotice = result.provenance.startsWith("SYNTHETIC_") ? " (synthetic model)" : "";
        await vscode.window.showInformationMessage(
          `MAST classification${syntheticNotice}: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown local inference error";
        await vscode.window.showErrorMessage(`MAST could not classify this error: ${message}`);
      }
    }),
    vscode.commands.registerCommand("mast.updateMastery", async () => {
      const kcId = await vscode.window.showQuickPick(
        inference.getKnowledgeComponents(),
        { placeHolder: "Choose the KC for this learning interaction" },
      );
      if (kcId === undefined) {
        return;
      }
      const response = await vscode.window.showQuickPick(
        [
          { label: "Resolved", resolved: true },
          { label: "Still learning", resolved: false },
        ],
        { placeHolder: "Was this interaction resolved?" },
      );
      if (response === undefined) {
        return;
      }
      try {
        const previousState = context.globalState.get<SerializedDktState>(dktStateKey);
        const result = await inference.updateMastery(kcId, response.resolved, previousState);
        await context.globalState.update(dktStateKey, result.state);
        await vscode.window.showInformationMessage(
          `MAST mastery updated for ${kcId}: ${(result.masteryByKc[kcId] * 100).toFixed(1)}%${result.provenance.startsWith("SYNTHETIC_") ? " (synthetic model)" : ""}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown local inference error";
        await vscode.window.showErrorMessage(`MAST could not update mastery: ${message}`);
      }
    }),
  );
}

export function deactivate(): void {}