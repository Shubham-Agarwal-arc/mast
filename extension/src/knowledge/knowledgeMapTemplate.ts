export function createKnowledgeMapHtml(
  cspSource: string,
  scriptUri: string,
  styleUri: string,
  nonce: string,
  initialComponents: readonly unknown[] = [],
): string {
  const initialState = JSON.stringify(initialComponents).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}' ${cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>MAST Knowledge Map</title>
</head>
<body>
  <header class="map-header">
    <div><p class="eyebrow">MAST / LEARNING MAP</p><h1>Knowledge Map</h1></div>
    <span class="source-note">Synthetic KC scaffold · threshold source unavailable</span>
  </header>
  <p class="notice">The original KC names and red/yellow/green mastery cutoffs were not supplied. Bars show the current local DKT values; no color band is inferred.</p>
  <main id="map" aria-label="Knowledge components"></main>
  <script type="application/json" id="initial-state">${initialState}</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
