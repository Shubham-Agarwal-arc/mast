import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

import { buildKnowledgeMap } from "./knowledgeMapModel.js";
import { createKnowledgeMapHtml } from "./knowledgeMapTemplate.js";

export interface KnowledgeMapPanel {
  panel: vscode.WebviewPanel;
  update(masteryByKc: Readonly<Record<string, number>>): Promise<void>;
}

export function showKnowledgeMapPanel(
  context: vscode.ExtensionContext,
  kcIds: readonly string[],
  masteryByKc: Readonly<Record<string, number>>,
): KnowledgeMapPanel {
  const panel = vscode.window.createWebviewPanel("mast.knowledgeMap", "MAST Knowledge Map", vscode.ViewColumn.Beside, {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
  });
  const nonce = randomBytes(16).toString("base64");
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "knowledgeMap.js"));
  const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "knowledgeMap.css"));
  panel.webview.html = createKnowledgeMapHtml(
    panel.webview.cspSource,
    String(scriptUri),
    String(styleUri),
    nonce,
    buildKnowledgeMap(kcIds, masteryByKc),
  );

  const update = async (nextMastery: Readonly<Record<string, number>>): Promise<void> => {
    await panel.webview.postMessage({
      type: "knowledgeState",
      components: buildKnowledgeMap(kcIds, nextMastery),
    });
  };
  void update(masteryByKc);
  context.subscriptions.push(panel);
  return { panel, update };
}
