import * as vscode from "vscode"
import { getOpenCodeClient } from "./client/OpenCodeClient.js"
import { getExtensionConfig } from "./config/ExtensionConfig.js"
import { getSettingsManager } from "./config/SettingsManager.js"
import { getSessionManager } from "./session/SessionManager.js"
import { getChatPanel } from "./chat/ChatPanel.js"
import { getPermissionDialog } from "./chat/PermissionDialog.js"
import { getAgentSelector } from "./agent/AgentSelector.js"
import { getAgentManager } from "./agent/AgentManager.js"
import { getProviderSelector } from "./provider/ProviderSelector.js"
import { getModelConfig } from "./provider/ModelConfig.js"
import { getSessionTreeProvider } from "./session/SessionTreeProvider.js"
import { getSettingsPanel } from "./settings/SettingsPanel.js"
import { getServerManager } from "./server/ServerManager.js"
import { registerAllCommands } from "./commands/index.js"

let sessionStatusBarItem: vscode.StatusBarItem
let agentStatusBarItem: vscode.StatusBarItem
let serverStatusBarItem: vscode.StatusBarItem

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("[OpenCode] Extension is activating...")

  try {
    // First, ensure server is running if in auto mode
    const settingsManager = getSettingsManager()
    const serverMode = settingsManager.get<string>("opencode.server.mode", "auto")
    
    if (serverMode === "auto") {
      console.log("[OpenCode] Auto mode - checking server status...")
      const serverManager = getServerManager()
      await serverManager.ensureServerRunning()
    } else {
      console.log(`[OpenCode] Server mode: ${serverMode} - skipping auto start`)
    }

    initializeInfrastructure(context)
    initializeConfiguration(context)
    initializeServerManager(context)
    initializeSessionManager(context)
    initializeAIConfig(context)
    initializePermissionSystem()
    initializeChatPanel(context)
    initializeSidebar(context)
    initializeSidebarChat(context)
    initializeSettingsPanel(context)
    initializeCommands(context)
    initializeStatusBar()

    console.log("[OpenCode] Extension activated successfully!")

    vscode.window.showInformationMessage(
      "OpenCode GUI is ready! Press Cmd+Escape to open chat."
    )
    
    // Register cleanup on deactivate
    context.subscriptions.push({
      dispose: () => {
        const serverManager = getServerManager()
        serverManager.dispose()
      }
    })
  } catch (error) {
    console.error("[OpenCode] Failed to activate extension:", error)
    vscode.window.showErrorMessage(
      `Failed to activate OpenCode: ${error}`
    )
  }
}

export function deactivate() {
  console.log("[OpenCode] Extension is deactivating...")

  sessionStatusBarItem?.dispose()
  agentStatusBarItem?.dispose()
  serverStatusBarItem?.dispose()

  console.log("[OpenCode] Extension deactivated")
}

function initializeInfrastructure(context: vscode.ExtensionContext): void {
  const settingsManager = getSettingsManager()
  const serverMode = settingsManager.get<string>("opencode.server.mode", "auto")
  const baseUrl = settingsManager.get<string>("opencode.server.baseUrl", "http://localhost:4096")

  console.log(`[OpenCode] Server mode: ${serverMode}`)
  console.log(`[OpenCode] Client initialized with base URL: ${baseUrl}`)

  const serverManager = getServerManager()
  serverManager.setBaseUrl(baseUrl)
  
  getOpenCodeClient(baseUrl)
}

function initializeConfiguration(context: vscode.ExtensionContext): void {
  getExtensionConfig(context)

  const settings = getSettingsManager()
  const disposable = settings.watch("opencode.server.mode", (value) => {
    console.log(`[OpenCode] Server mode changed to: ${value}`)
  })

  context.subscriptions.push(disposable)
}

function initializeServerManager(context: vscode.ExtensionContext): void {
  const settingsManager = getSettingsManager()
  const serverMode = settingsManager.get<string>("opencode.server.mode", "auto")
  const baseUrl = settingsManager.get<string>("opencode.server.baseUrl", "http://localhost:4096")
  const autoStart = settingsManager.get<boolean>("opencode.server.autoStart", true)

  const serverManager = getServerManager()
  serverManager.setContext(context)
  serverManager.setBaseUrl(baseUrl)

  context.subscriptions.push({
    dispose: () => serverManager.dispose()
  })

  if (serverMode === "auto" && autoStart) {
    serverManager.ensureServerRunning().then((status) => {
      if (status.running) {
        console.log(`[OpenCode] Server running at ${status.url}`)
        updateServerStatusBar(true)
      } else {
        console.log("[OpenCode] Server not running")
        updateServerStatusBar(false)
      }
    }).catch((error) => {
      console.error("[OpenCode] Failed to start server:", error)
      updateServerStatusBar(false)
    })
  }

  console.log("[OpenCode] Server manager initialized")
}

function initializeSessionManager(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)
  sessionManager.loadSessions().catch((error) => {
    vscode.window.showErrorMessage(`Failed to load sessions: ${error}`)
  })

  console.log("[OpenCode] Sessions loaded")
}

function initializeAIConfig(context: vscode.ExtensionContext): void {
  getAgentManager(context)
  getModelConfig(context)

  const agentSelector = getAgentSelector()
  const providerSelector = getProviderSelector()

  const client = getOpenCodeClient()

  agentSelector.setClient(client)
  agentSelector.loadAgentsFromServer()

  providerSelector.setClient(client)
  providerSelector.loadProvidersFromServer()

  console.log("[OpenCode] AI config initialized")
}

function initializePermissionSystem(): void {
  const permissionDialog = getPermissionDialog()
  const client = getOpenCodeClient()

  permissionDialog.setClient(client)

  console.log("[OpenCode] Permission system initialized")
}

function initializeChatPanel(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)
  const chatPanel = getChatPanel(sessionManager)

  context.subscriptions.push(
    {
      dispose: () => chatPanel.dispose()
    }
  )

  console.log("[OpenCode] Chat panel initialized")
}

function initializeSidebar(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)
  const treeProvider = getSessionTreeProvider(sessionManager)

  const treeView = vscode.window.createTreeView("sessionTree", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  })

  treeView.onDidChangeSelection(() => {
  })

  context.subscriptions.push(treeView)
  context.subscriptions.push(treeProvider)

  console.log("[OpenCode] Sidebar initialized")
}

function initializeSidebarChat(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)
  const chatPanel = getChatPanel(sessionManager)
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("opencodeChat", {
      resolveWebviewView(webviewView) {
        chatPanel.resolveWebviewView(webviewView, context.extensionUri)
      }
    })
  )
}

function initializeSettingsPanel(context: vscode.ExtensionContext): void {
  const settingsPanel = getSettingsPanel()
  settingsPanel.setContext(context)

  context.subscriptions.push(
    {
      dispose: () => settingsPanel.dispose()
    }
  )

  console.log("[OpenCode] Settings panel initialized")
}

function initializeCommands(context: vscode.ExtensionContext): void {
  registerAllCommands(context)

  console.log("[OpenCode] Commands registered")
}

function initializeStatusBar(): void {
  serverStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  serverStatusBarItem.command = "opencode.config.openSettings"
  serverStatusBarItem.tooltip = "OpenCode Settings"
  updateServerStatusBar(undefined, false)
  serverStatusBarItem.show()

  console.log("[OpenCode] Status bar initialized")
}

function updateSessionStatusBar(): void {
  // Removed
}

function updateAgentStatusBar(): void {
  // Removed
}

function updateServerStatusBar(_connected?: boolean, _auto?: boolean): void {
  const settings = getSettingsManager()
  const mode = settings.get<string>("opencode.server.mode", "auto")

  const icons = {
    auto: "$(cloud-upload)",
    remote: "$(globe)",
    embedded: "$(server)"
  }

  const serverModeText = mode.charAt(0).toUpperCase() + mode.slice(1)
  serverStatusBarItem.text = `${icons[mode as keyof typeof icons]} OpenCode: ${serverModeText}`
}

export function getSessionManagerForCommand() {
  return getSessionManager()
}
