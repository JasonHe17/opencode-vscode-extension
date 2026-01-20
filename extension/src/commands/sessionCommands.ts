import * as vscode from "vscode"

export async function createSession(
  _options?: { title?: string; agent?: string; model?: { providerID: string; modelID: string } }
): Promise<void> {
  vscode.window.showInformationMessage("Session created (placeholder)")
}

export async function setActiveSession(sessionId: string): Promise<void> {
  vscode.window.showInformationMessage(`Active session: ${sessionId}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    "Are you sure you want to delete this session?",
    "Delete",
    "Cancel"
  )

  if (confirm !== "Delete") return

  vscode.window.showInformationMessage(`Session ${sessionId} deleted (placeholder)`)
}

export async function forkSession(
  sessionId: string,
  _messageId?: string
): Promise<void> {
  vscode.window.showInformationMessage(`Session forked from ${sessionId} (placeholder)`)
}

export async function showSession(sessionId: string): Promise<void> {
  vscode.window.showInformationMessage(`Show session ${sessionId} (placeholder)`)
}
