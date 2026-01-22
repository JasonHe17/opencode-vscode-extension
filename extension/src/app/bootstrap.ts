import * as vscode from "vscode"
import { AppStore } from "./store.js"
import { getOpenCodeClient } from "../client/OpenCodeClient.js"
import { getSettingsManager } from "../config/SettingsManager.js"
import { getSessionManager } from "../session/SessionManager.js"
import { getSessionTreeProvider } from "../session/SessionTreeProvider.js"
import { getChatPanel } from "../chat/ChatPanel.js"

export async function bootstrap(context: vscode.ExtensionContext) {
  console.log("[OpenCode] Bootstrapping application...")

  // 1. Initialize Adapters (Settings, Storage)
  const settings = getSettingsManager()

  // 2. Initialize Core Store
  const store = new AppStore({
    sessions: new Map(),
    messages: new Map(),
    activeSessionId: null,
    serverConnected: false
  })

  // 3. Initialize Services
  const baseUrl = settings.get<string>("opencode.server.baseUrl", "http://localhost:4096")
  const client = getOpenCodeClient(baseUrl)

  // 4. Set up Event Ingestion
  client.addEventListener((event) => {
    // Map server events to store dispatch
    if (event.type === "message.created") {
      // store.dispatch(...)
    }
  })

  // 5. Register VS Code Integrations
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

  // Register internal refresh command for tree view
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.sessionTree.refresh", () => {
      sessionTreeProvider.refresh()
    })
  )

  console.log("[OpenCode] Bootstrap complete")
  return { store, client, settings }
}
