import * as vscode from "vscode"
import { SessionWithStatus } from "./SessionManager.js"

export class SessionWebview {
  private static instance: SessionWebview
  private panel: vscode.WebviewPanel | null = null

  private constructor() {}

  static getInstance(): SessionWebview {
    if (!SessionWebview.instance) {
      SessionWebview.instance = new SessionWebview()
    }
    return SessionWebview.instance
  }

  async show(session: SessionWithStatus): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One)
      this.updatePanel(session)
      return
    }

    this.panel = vscode.window.createWebviewPanel(
      "opencodeSessionHistory",
      `Session: ${session.title}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: []
      }
    )

    this.panel.onDidDispose(() => {
      this.panel = null
    })

    this.updatePanel(session)
  }

  private updatePanel(session: SessionWithStatus): void {
    if (!this.panel) return

    const html = this.getHtmlContent(session)
    this.panel.webview.html = html
  }

  private getHtmlContent(session: SessionWithStatus): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }
    h1 {
      color: var(--vscode-editor-foreground);
    }
    .info {
      margin-bottom: 20px;
      padding: 10px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>${session.title}</h1>
  <div class="info">
    <p><strong>ID:</strong> ${session.id}</p>
    <p><strong>Status:</strong> ${session.status}</p>
    <p><strong>Agent:</strong> ${session.agent}</p>
    <p><strong>Messages:</strong> ${session.messageCount}</p>
    <p><strong>Created:</strong> ${new Date(session.time.created).toLocaleString()}</p>
    <p><strong>Updated:</strong> ${new Date(session.time.updated).toLocaleString()}</p>
  </div>
</body>
</html>`
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = null
  }
}

export function getSessionWebview(): SessionWebview {
  return SessionWebview.getInstance()
}
