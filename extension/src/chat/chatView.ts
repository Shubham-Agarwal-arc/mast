export function createChatHtml(
  cspSource: string,
  scriptUri: string,
  styleUri: string,
  nonce: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src ${cspSource}; script-src 'nonce-${nonce}' ${cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>MAST Chat</title>
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true">M</span><div><h1>MAST</h1><p>Learning conversation</p></div></div>
    <div class="status-group"><span class="badge" id="mastery" aria-label="Average mastery">Mastery 50%</span><span class="badge status" id="session-status">Session ready</span></div>
  </header>
  <main>
    <section class="thread" id="thread" aria-label="Chat messages" aria-live="polite">
      <div class="empty-state" id="empty-state"><span class="empty-rule"></span><h2>What are you working through?</h2><p>Paste an error or describe the concept that feels unclear.</p></div>
    </section>
    <section class="composer-wrap" aria-label="Message composer">
      <form id="composer">
        <label class="sr-only" for="message-input">Error or question</label>
        <textarea id="message-input" rows="3" maxlength="4000" placeholder="Paste an error or ask a question…" required></textarea>
        <div class="composer-footer"><span class="privacy-note">Classification and retrieval stay on this device.</span><button class="send-button" type="submit" aria-label="Send message"><span aria-hidden="true">↗</span> Send</button></div>
      </form>
      <p class="inline-error" id="error-message" role="alert" hidden></p>
    </section>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
