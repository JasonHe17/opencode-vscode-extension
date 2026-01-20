import * as vscode from "vscode"
import { getSessionManager } from "../session/SessionManager.js"
import { getChatPanel } from "../chat/ChatPanel.js"

export async function openChat(sessionId?: string): Promise<void> {
  const sessionManager = getSessionManager()
  const chatPanel = getChatPanel(sessionManager)

  if (!sessionId) {
    const activeSession = sessionManager.getActiveSession()
    sessionId = activeSession?.id
  }

  chatPanel.show(sessionId)
}

export async function sendMessage(sessionId: string, message: string): Promise<void> {
  const sessionManager = getSessionManager()
  const chatPanel = getChatPanel(sessionManager)
  
  chatPanel.show(sessionId)
}

export async function attachFile(): Promise<void> {
  const fileUri = await vscode.window.showOpenDialog({
    title: "Select file to attach",
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false
  })

  if (fileUri && fileUri.length > 0) {
    const filePath = fileUri[0].fsPath
    vscode.window.showInformationMessage(`Attached: ${filePath}`)
  }
}

export async function explainSelection(editor?: vscode.TextEditor): Promise<void> {
  const activeEditor = editor || vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  if (activeEditor.selection.isEmpty) {
    vscode.window.showWarningMessage("Please select some text")
    return
  }

  const selectedText = activeEditor.document.getText(activeEditor.selection)

  const sessionManager = getSessionManager()
  const chatPanel = getChatPanel(sessionManager)
  chatPanel.show()

  vscode.env.clipboard.writeText(selectedText)
  vscode.window.showInformationMessage("Selection copied to clipboard. Paste it in the chat.")
}

export async function refactorSelection(editor?: vscode.TextEditor): Promise<void> {
  const activeEditor = editor || vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  if (activeEditor.selection.isEmpty) {
    vscode.window.showWarningMessage("Please select some text to refactor")
    return
  }

  const selectedText = activeEditor.document.getText(activeEditor.selection)

  const sessionManager = getSessionManager()
  const chatPanel = getChatPanel(sessionManager)
  chatPanel.show()

  vscode.env.clipboard.writeText(selectedText)
  vscode.window.showInformationMessage("Selection copied to clipboard. Paste it in the chat.")
}

export async function generateTests(editor?: vscode.TextEditor): Promise<void> {
  const activeEditor = editor || vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  if (activeEditor.selection.isEmpty) {
    vscode.window.showWarningMessage("Please select code to generate tests for")
    return
  }

  const selectedText = activeEditor.document.getText(activeEditor.selection)

  const sessionManager = getSessionManager()
  const chatPanel = getChatPanel(sessionManager)
  chatPanel.show()

  vscode.env.clipboard.writeText(selectedText)
  vscode.window.showInformationMessage("Selection copied to clipboard. Paste it in the chat.")
}
