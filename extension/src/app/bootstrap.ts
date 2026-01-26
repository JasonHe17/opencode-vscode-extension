import * as vscode from "vscode"
import { AppStore } from "./store.js"
import { getOpenCodeClient } from "../client/OpenCodeClient.js"
import { getSettingsManager } from "../config/SettingsManager.js"
import { getSessionManager } from "../session/SessionManager.js"
import { getSessionTreeProvider } from "../session/SessionTreeProvider.js"
import { getChatPanel } from "../chat/ChatPanel.js"
import { getServerManager } from "../server/ServerManager.js"

export async function bootstrap(context: vscode.ExtensionContext) {
  console.log("[OpenCode] Bootstrapping application...")

  const settings = getSettingsManager()

  const baseUrl = settings.get<string>("opencode.server.baseUrl", "http://localhost:4096")
  const client = getOpenCodeClient(baseUrl)

  const serverManager = getServerManager()
  serverManager.setBaseUrl(baseUrl)

  const autoStart = settings.get<boolean>("opencode.server.autoStart", true)
  let serverStatus: Awaited<ReturnType<typeof serverManager.checkServerStatus>>
  let store: AppStore

  if (autoStart) {
    console.log("[OpenCode] Ensuring OpenCode server is running...")
    serverStatus = await serverManager.ensureServerRunning()
    
    if (serverStatus.running) {
      console.log(`[OpenCode] Server is running on port ${serverStatus.port}, autoStarted: ${serverStatus.autoStarted}`)
      if (serverStatus.autoStarted) {
        vscode.window.showInformationMessage(
          "OpenCode server started successfully"
        )
      }
    } else {
      console.log("[OpenCode] Failed to start OpenCode server")
      vscode.window.showWarningMessage(
        "OpenCode server is not running. Features may be limited. Check the 'OpenCode Server' output channel for details.",
        "Open Server Output"
      ).then(selection => {
        if (selection === "Open Server Output") {
          serverManager.showOutputChannel()
        }
      })
    }

    store = new AppStore({
      sessions: new Map(),
      messages: new Map(),
      activeSessionId: null,
      serverConnected: serverStatus.running
    })

    serverManager.setContext(context)
    context.subscriptions.push(serverManager)
  } else {
    console.log("[OpenCode] Auto-start is disabled, checking server status...")
    serverStatus = await serverManager.checkServerStatus()
    
    if (serverStatus.running) {
      console.log(`[OpenCode] Server is already running on port ${serverStatus.port}`)
    } else {
      console.log("[OpenCode] Server is not running")
      vscode.window.showInformationMessage(
        "OpenCode server is not running. Auto-start is disabled in settings.",
        "Open Settings"
      ).then(selection => {
        if (selection === "Open Settings") {
          vscode.commands.executeCommand("workbench.action.openSettings", "opencode.server.autoStart")
        }
      })
    }

    store = new AppStore({
      sessions: new Map(),
      messages: new Map(),
      activeSessionId: null,
      serverConnected: serverStatus.running
    })
  }

  client.addEventListener((event) => {
    if (event.type === "message.created") {
      // store.dispatch(...)
    }
  })

  const sessionManager = getSessionManager(context)
  const sessionTreeProvider = getSessionTreeProvider(sessionManager)
  const chatPanel = getChatPanel(sessionManager)

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("sessionTree", sessionTreeProvider),
    vscode.window.registerWebviewViewProvider("opencodeChat", {
      resolveWebviewView: (webviewView) => {
        chatPanel.resolveWebviewView(webviewView, context.extensionUri)
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.sessionTree.refresh", () => {
      sessionTreeProvider.refresh()
    })
  )

  console.log("[OpenCode] Bootstrap complete")
  return { store, client, settings, serverManager }
}
