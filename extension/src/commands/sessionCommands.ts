import * as vscode from "vscode"
import { getSessionManager } from "../session/SessionManager.js"

export async function createSession(
  options?: { title?: string; agent?: string; model?: { providerID: string; modelID: string } }
): Promise<void> {
  const sessionManager = getSessionManager()
  try {
    const session = await sessionManager.createSession(options)
    await vscode.commands.executeCommand("opencode.chat.open", session.id)
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create session: ${error}`)
  }
}

export async function setActiveSession(sessionId: string): Promise<void> {
  const sessionManager = getSessionManager()
  try {
    await sessionManager.setActiveSession(sessionId)
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to set active session: ${error}`)
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessionManager = getSessionManager()
  try {
    await sessionManager.deleteSession(sessionId)
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete session: ${error}`)
  }
}

export async function forkSession(
  sessionId: string,
  messageId?: string
): Promise<void> {
  const sessionManager = getSessionManager()
  try {
    const newSession = await sessionManager.forkSession(sessionId, messageId)
    await vscode.commands.executeCommand("opencode.chat.open", newSession.id)
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to fork session: ${error}`)
  }
}

export async function showSession(sessionId: string): Promise<void> {
  const sessionManager = getSessionManager()
  const session = sessionManager.getSession(sessionId)
  if (!session) {
    vscode.window.showErrorMessage(`Session ${sessionId} not found`)
    return
  }

  await sessionManager.setActiveSession(sessionId)
  await vscode.commands.executeCommand("opencode.chat.open", sessionId)
}
