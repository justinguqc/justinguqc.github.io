const vscode = require('vscode');
const crypto = require('crypto');

function panelHtml(webview, extensionUri) {
  const nonce = crypto.randomBytes(18).toString('base64');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'panel.js'));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'panel.css'));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${style}"><title>AITrace</title></head>
    <body><header class="brand"><strong>AITrace</strong></header>
    <main id="app" aria-label="AITrace review"><p>Opening your review...</p></main>
    <script nonce="${nonce}" src="${script}"></script></body></html>`;
}
module.exports = { panelHtml };
