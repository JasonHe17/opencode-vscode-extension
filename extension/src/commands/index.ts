import * as vscode from "vscode"
import { createSession, setActiveSession as setSessionActive, deleteSession, forkSession, showSession, revertSession, unrevertSession } from "./sessionCommands.js"
import { openChat, sendMessage, attachFile, explainSelection, refactorSelection, generateTests } from "./chatCommands.js"
import { openSettings, selectAgent, selectModel, setApiKey } from "./configCommands.js"

export function registerAllCommands(context: vscode.ExtensionContext): void {
  registerSessionCommands(context)
  registerChatCommands(context)
  registerConfigCommands(context)

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "opencode.sessions.refresh",
      async () => {
        console.log("[opencode.sessions.refresh] Refresh command triggered")
        const { SessionManager } = await import("../session/SessionManager.js")
        const manager = SessionManager.getInstance()
        if (manager) {
          await manager.loadSessions(true)
          setTimeout(async () => {
            const { getSessionTreeProvider } = await import("../session/SessionTreeProvider.js")
            const treeProvider = getSessionTreeProvider(manager)
            console.log("[opencode.sessions.refresh] Manually refreshing tree view")
            treeProvider?.refresh?.()
          }, 100)
        }
      }
    )
  )
}

function registerSessionCommands(context: vscode.ExtensionContext): void {
  const createSessionCommand = vscode.commands.registerCommand(
    "opencode.session.create",
    async (options?: { title?: string }) => {
      await createSession(options)
    }
  )

  const setActiveSessionCommand = vscode.commands.registerCommand(
    "opencode.session.setActive",
    async (sessionId: string) => {
      await setSessionActive(sessionId)
    }
  )

  const deleteSessionCommand = vscode.commands.registerCommand(
    "opencode.session.delete",
    async (item: any) => {
      const sessionId = typeof item === "string" ? item : item?.item?.id
      if (sessionId) {
        await deleteSession(sessionId)
      }
    }
  )

  const forkSessionCommand = vscode.commands.registerCommand(
    "opencode.session.fork",
    async (sessionId: string, messageId?: string) => {
      await forkSession(sessionId, messageId)
    }
  )

  const showSessionCommand = vscode.commands.registerCommand(
    "opencode.session.open",
    async (sessionId: string) => {
      await showSession(sessionId)
    }
  )

  const revertSessionCommand = vscode.commands.registerCommand(
    "opencode.session.revert",
    async (sessionId: string, messageId?: string, partID?: string) => {
      await revertSession(sessionId, messageId, partID)
    }
  )

  const unrevertSessionCommand = vscode.commands.registerCommand(
    "opencode.session.unrevert",
    async (sessionId: string) => {
      await unrevertSession(sessionId)
    }
  )

  context.subscriptions.push(
    createSessionCommand,
    setActiveSessionCommand,
    deleteSessionCommand,
    forkSessionCommand,
    showSessionCommand,
    revertSessionCommand,
    unrevertSessionCommand
  )
}

function registerChatCommands(context: vscode.ExtensionContext): void {
  const openChatCommand = vscode.commands.registerCommand(
    "opencode.chat.open",
    async (sessionId?: string) => {
      await openChat(sessionId)
    }
  )

  const sendMessageCommand = vscode.commands.registerCommand(
    "opencode.chat.send",
    async (sessionId: string, _message: string) => {
      await sendMessage(sessionId, _message)
    }
  )

  const attachFileCommand = vscode.commands.registerCommand(
    "opencode.chat.attachFile",
    async () => {
      await attachFile()
    }
  )

  const explainSelectionCommand = vscode.commands.registerCommand(
    "opencode.chat.explainSelection",
    async () => {
      await explainSelection()
    }
  )

  const refactorSelectionCommand = vscode.commands.registerCommand(
    "opencode.chat.refactorSelection",
    async () => {
      await refactorSelection()
    }
  )

  const generateTestsCommand = vscode.commands.registerCommand(
    "opencode.chat.generateTests",
    async () => {
      await generateTests()
    }
  )

  context.subscriptions.push(
    openChatCommand,
    sendMessageCommand,
    attachFileCommand,
    explainSelectionCommand,
    refactorSelectionCommand,
    generateTestsCommand
  )
}

function registerConfigCommands(context: vscode.ExtensionContext): void {
  const openSettingsCommand = vscode.commands.registerCommand(
    "opencode.config.openSettings",
    async () => {
      await openSettings()
    }
  )

  const selectAgentCommand = vscode.commands.registerCommand(
    "opencode.config.selectAgent",
    async (sessionId?: string) => {
      await selectAgent(sessionId)
    }
  )

  const selectModelCommand = vscode.commands.registerCommand(
    "opencode.config.selectModel",
    async (sessionId?: string) => {
      await selectModel(sessionId)
    }
  )

  const setApiKeyCommand = vscode.commands.registerCommand(
    "opencode.config.setApiKey",
    async (provider?: string) => {
      await setApiKey(provider)
    }
  )

  context.subscriptions.push(
    openSettingsCommand,
    selectAgentCommand,
    selectModelCommand,
    setApiKeyCommand
  )
}
