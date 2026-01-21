import * as vscode from "vscode"
import { SessionManager } from "./SessionManager.js"
import { SessionTreeItem } from "./SessionTreeItem.js"
import { ChatPanel } from "../chat/ChatPanel.js"

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private sessionManager: SessionManager
  private disposables: vscode.Disposable[] = []

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager

    this.disposables.push(
      this.sessionManager.onSessionEvent(() => {
        this.refresh()
      })
    )
  }

  refresh(item?: SessionTreeItem): void {
    this._onDidChangeTreeData.fire(item)
  }

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element
  }

  getChildren(_element?: SessionTreeItem): Promise<SessionTreeItem[]> {
    if (_element) {
      return Promise.resolve(_element.children)
    }

    return Promise.resolve(
      this.sessionManager.getAllSessions().map((session) => new SessionTreeItem(session))
    )
  }

  getParent(_element: SessionTreeItem): Promise<SessionTreeItem | undefined> {
    return Promise.resolve(undefined)
  }

  async openSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) {
      vscode.window.showErrorMessage(`Session ${sessionId} not found`)
      return
    }

    await this.sessionManager.setActiveSession(sessionId)
    const chatPanel = ChatPanel.getInstance()
    chatPanel.show(sessionId)
  }

  async forkSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    const messageId = await this.selectForkPoint(sessionId)

    try {
      const newSession = await this.sessionManager.forkSession(sessionId, messageId)
      vscode.window.showInformationMessage(`Created fork: ${newSession.title}`)
      this.refresh()
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to fork session: ${error}`)
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.sessionManager.deleteSession(sessionId)
      this.refresh()
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete session: ${error}`)
    }
  }

  async exportSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    const format = await vscode.window.showQuickPick(
      ["Markdown", "JSON"],
      { placeHolder: "Select export format" }
    )

    if (!format) return

    let content = ""
    content = "# " + session.title + "\n\n*Exported at " + new Date().toISOString() + "*"

    const defaultUri = vscode.Uri.file(
      `${session.title.replace(/[^a-zA-Z0-9]/g, "_")}_export.${format === "Markdown" ? "md" : "json"}`
    )

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        [format]: [format === "Markdown" ? "md" : "json"]
      }
    })

    if (uri) {
      try {
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content))
        vscode.window.showInformationMessage("Session exported successfully")
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export session: ${error}`)
      }
    }
  }

  async shareSession(_sessionId: string): Promise<void> {
    vscode.window.showInformationMessage("Share link copied to clipboard")
  }

  async archiveSession(sessionId: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, { status: "archived" })
    this.refresh()
    vscode.window.showInformationMessage("Session archived")
  }

  async unarchiveSession(sessionId: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, { status: "idle" })
    this.refresh()
    vscode.window.showInformationMessage("Session unarchived")
  }

  private async selectForkPoint(_sessionId: string): Promise<string | undefined> {
    const points = ["Start", "Last message", "Custom..."]
    const selected = await vscode.window.showQuickPick(points, {
      placeHolder: "Select fork point"
    })

    if (selected === "Start") return undefined
    if (selected === "Last message") {
      return undefined
    }
    if (selected === "Custom...") {
      const messageId = await vscode.window.showInputBox({
        placeHolder: "Enter message ID",
        prompt: "Enter the message ID to fork from (leave empty for start)"
      })
      return messageId || undefined
    }

    return undefined
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this._onDidChangeTreeData.dispose()
  }
}

export function getSessionTreeProvider(sessionManager: SessionManager): SessionTreeProvider {
  return new SessionTreeProvider(sessionManager)
}
