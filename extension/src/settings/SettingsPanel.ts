import * as vscode from "vscode"
import { OpenCodeClient } from "../client/OpenCodeClient.js"
import { getSettingsManager } from "../config/SettingsManager.js"

export class SettingsPanel {
  private static instance: SettingsPanel | null = null
  private panel: vscode.WebviewPanel | null = null
  private client: OpenCodeClient
  private settings: any
  private context: vscode.ExtensionContext | null = null
  private disposables: vscode.Disposable[] = []

  private constructor() {
    this.client = OpenCodeClient.getInstance()
    this.settings = getSettingsManager()
    console.log("[SettingsPanel] Initialized")
  }

  static getInstance(): SettingsPanel {
    if (!SettingsPanel.instance) {
      SettingsPanel.instance = new SettingsPanel()
    }
    return SettingsPanel.instance
  }

  setContext(context: vscode.ExtensionContext): void {
    this.context = context
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal()
      return
    }

    const extensionUri = vscode.extensions
      .getExtension("opencode-ai.opencode-gui")
      ?.extensionUri

    const panel = vscode.window.createWebviewPanel(
      "opencode.settings",
      "OpenCode Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri!, "webviews", "settings")
        ]
      }
    )

    this.panel = panel
    this.setupWebview(panel, extensionUri!)

    panel.onDidDispose(() => {
      this.panel = null
    }, null, this.disposables)
  }

  private setupWebview(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
    const htmlPath = vscode.Uri.joinPath(extensionUri, "webviews", "settings", "index.html")
    const jsPath = vscode.Uri.joinPath(extensionUri, "webviews", "settings", "main.js")
    
    let html = htmlPath.fsPath
    const fileContent = require("fs").readFileSync(html, "utf8")
    
    let htmlContent = fileContent.replace(
      /<script src="main.js"><\/script>/,
      `<script src="${panel.webview.asWebviewUri(jsPath)}"></script>`
    )

    panel.webview.html = htmlContent

    panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleWebviewMessage(message)
    }, null, this.disposables)
  }

  private async handleWebviewMessage(message: any): Promise<void> {
    console.log("[SettingsPanel] Received message from webview:", message.type, message)
    switch (message.type) {
      case "checkServerStatus":
        await this.checkServerStatus()
        break

      case "saveServerConfig":
        await this.saveServerConfig(message.config)
        break

      case "saveApiKey":
        await this.saveApiKey(message.provider, message.key)
        break

      case "loadModels":
        console.log("[SettingsPanel] loadModels request received")
        await this.loadModels()
        break

      case "saveDefaultAgent":
        await this.saveDefaultAgent(message.agent)
        break

      case "saveChatSettings":
        await this.saveChatSettings(message.settings)
        break

      default:
        console.warn("[SettingsPanel] Unknown message type:", message.type)
    }
  }

  private async checkServerStatus(): Promise<void> {
    try {
      const status = await this.client.getServerStatus()
      this.postMessageToWebview({
        type: "serverStatus",
        status: {
          connected: true,
          url: "http://localhost:4096",
          version: status.version,
          agents: status.agents,
          providers: status.providers,
          models: status.models
        }
      })
    } catch (error) {
      console.error("[SettingsPanel] Server check failed:", error)
      this.postMessageToWebview({
        type: "serverStatus",
        status: {
          connected: false,
          url: "http://localhost:4096",
          error: String(error)
        }
      })
    }
  }

  private async saveServerConfig(config: any): Promise<void> {
    await this.settings.set("opencode.server.mode", config.mode)
    await this.settings.set("opencode.server.baseUrl", config.url)
    
    this.postMessageToWebview({
      type: "configSaved"
    })
    
    vscode.window.showInformationMessage("Server configuration saved")
  }

  private async saveApiKey(provider: string, key: string): Promise<void> {
    if (!this.context) {
      vscode.window.showErrorMessage("No extension context available")
      return
    }
    
    await this.context.secrets.store(`opencode.${provider}.apiKey`, key)
    
    this.postMessageToWebview({
      type: "configSaved"
    })
    
    vscode.window.showInformationMessage(`API key for ${provider} saved`)
  }

  private async loadModels(): Promise<void> {
    try {
      console.log("[SettingsPanel] Calling client.getModels()...")
      const models = await this.client.getModels()
      console.log("[SettingsPanel] Got models:", models)
      this.postMessageToWebview({
        type: "modelsLoaded",
        models
      })
    } catch (error) {
      console.error("[SettingsPanel] Error loading models:", error)
      this.postMessageToWebview({
        type: "error",
        error: `Failed to load models: ${error}`
      })
    }
  }

  private async saveDefaultAgent(agent: string): Promise<void> {
    await this.settings.set("opencode.defaultAgent", agent)
    
    this.postMessageToWebview({
      type: "configSaved"
    })
    
    vscode.window.showInformationMessage("Default agent saved")
  }

  private async saveChatSettings(settings: any): Promise<void> {
    await this.settings.set("opencode.chat.showToolOutput", settings.showToolOutput)
    
    this.postMessageToWebview({
      type: "configSaved"
    })
    
    vscode.window.showInformationMessage("Chat settings saved")
  }

  private postMessageToWebview(message: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(message)
    }
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = null
    this.disposables.forEach((d) => d.dispose())
    SettingsPanel.instance = null
  }
}

export function getSettingsPanel(): SettingsPanel {
  return SettingsPanel.getInstance()
}
