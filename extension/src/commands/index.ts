import * as vscode from "vscode"
import { createSession, setActiveSession as setSessionActive, deleteSession, forkSession, showSession } from "./sessionCommands"
import { openChat, sendMessage, attachFile, explainSelection, refactorSelection, generateTests } from "./chatCommands"
import { openSettings, selectAgent, selectModel, setApiKey } from "./configCommands"

export function registerAllCommands(context: vscode.ExtensionContext): void {
  registerSessionCommands(context)
  registerChatCommands(context)
  registerConfigCommands(context)
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
    async (sessionId: string) => {
      await deleteSession(sessionId)
    }
  )

  const forkSessionCommand = vscode.commands.registerCommand(
    "opencode.session.fork",
    async (sessionId: string, messageId?: string) => {
      await forkSession(sessionId, messageId)
    }
  )

  const showSessionCommand = vscode.commands.registerCommand(
    "opencode.session.show",
    async (sessionId: string) => {
      await showSession(sessionId)
    }
  )

  context.subscriptions.push(
    createSessionCommand,
    setActiveSessionCommand,
    deleteSessionCommand,
    forkSessionCommand,
    showSessionCommand
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
    async (sessionId: string, message: string) => {
      await sendMessage(sessionId, message)
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
