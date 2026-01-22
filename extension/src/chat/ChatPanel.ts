import * as vscode from "vscode"
import { SessionManager } from "../session/SessionManager.js"
import { PermissionDialog } from "./PermissionDialog.js"
import { OpenCodeClient } from "../client/OpenCodeClient.js"
import { getProviderSelector } from "../provider/ProviderSelector.js"
import type { MessagePart, BusEvent } from "../client/types.js"

import { getAgentSelector } from "../agent/AgentSelector.js"

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  attachments?: any[]
  timestamp: number
}

export class ChatPanel {
  private static instance: ChatPanel | null = null
  private panel: vscode.WebviewPanel | vscode.WebviewView | null = null
  private sessionManager: SessionManager
  private client: OpenCodeClient
  private permissionDialog: PermissionDialog
  private currentSessionId: string | null = null
  private currentAgent: string = "build"
  private currentModel: { providerID: string; modelID: string } | undefined = undefined
  private isWaiting: boolean = false
  private disposables: vscode.Disposable[] = []
  private eventListenerRemover: (() => void) | null = null
  private currentMessageId: string | null = null
  private pendingMessageContent: string = ""
  private lastUserMessage: string = ""

  private constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager
    this.client = OpenCodeClient.getInstance()
    this.permissionDialog = PermissionDialog.getInstance()
    this.setupEventListeners()
    console.log("[ChatPanel] Initialized")
  }

  static getInstance(sessionManager?: SessionManager): ChatPanel {
    if (!ChatPanel.instance && sessionManager) {
      ChatPanel.instance = new ChatPanel(sessionManager)
    }
    return ChatPanel.instance!
  }

  private setupEventListeners(): void {
    console.log("[ChatPanel] Setting up event listeners...")
    this.eventListenerRemover = this.client.addEventListener((event: any) => {
      this.handleServerEvent(event)
    })
  }

  private handleServerEvent(event: BusEvent): void {
    const eventData = event.data as any
    
    // Handle different event structures
    const eventType = eventData?.type || event.type
    const properties = eventData?.properties || eventData
    
    console.log(`[ChatPanel] Event type: ${eventType}, has currentSessionId: ${!!this.currentSessionId}`)
    
    if (eventType === "server.connected") {
      return
    }

    if (eventType === "session.idle") {
      this.postMessageToWebview({
        type: "sessionIdle",
        sessionId: properties?.sessionID
      })
      return
    }
    
    // Check session ID if present
    if (properties?.sessionID && properties.sessionID !== this.currentSessionId) {
      return
    }

    switch (eventType) {
      case "message.part.updated":
        this.handleMessagePartUpdated(properties)
        break
        
      case "message.created":
        this.handleMessageCreated(properties)
        break

      case "tool.stdout":
      case "tool.stderr":
        this.handleToolOutput(properties)
        break

      default:
        console.log("[ChatPanel] Unhandled event type:", eventType)
    }
  }

  private handleMessagePartUpdated(data: any): void {
    const part = data.part || data
    if (!part) return

    const messageId = data.messageID || data.id || part.messageID
    const sender = data.sender || part.sender
    const role = sender === "user" ? "user" : "assistant"

    if (role === "user") return

    const sessionId = data.sessionID || part.sessionID

    this.postMessageToWebview({
      type: "messagePart",
      sessionId,
      messageId: messageId,
      role: role,
      part: part
    })

    if (part.type === "step-finish" || part.type === "step-start") {
      this.isWaiting = false
    }
  }

  private handleMessageCreated(data: any): void {
    const message = data.message || data
    if (!message) return

    const sessionId = message.sessionID || data.sessionID

    this.postMessageToWebview({
      type: "message",
      sessionId,
      id: message.id,
      role: message.role || "assistant",
      parts: message.parts || []
    })
  }

  private handleToolOutput(data: any): void {
    if (!data?.messageID || !data?.toolID) return
    const toolData = {
      type: "toolUpdate" as const,
      sessionId: data.sessionID,
      messageId: data.messageID,
      toolId: data.toolID,
      updates: {
        output: data.output,
        state: data.state,
        tool: data.tool,
        title: data.title
      }
    }
    this.postMessageToWebview(toolData)
  }

  show(sessionId?: string): void {
    if (sessionId) {
      this.switchSession(sessionId)
    }

    if (this.panel) {
      if ("reveal" in this.panel) {
        this.panel.reveal()
      }
      return
    }

    vscode.commands.executeCommand("opencodeChat.focus")
  }

  resolveWebviewView(webviewView: vscode.WebviewView, extensionUri: vscode.Uri): void {
    this.panel = webviewView
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "webviews", "chat")
      ]
    }

    this.setupWebview(webviewView, extensionUri)
    
    // Auto-init when sidebar is resolved
    setTimeout(() => {
      this.handleInit();
    }, 500);

    webviewView.onDidDispose(() => {
      this.panel = null
    })
  }

  private setupWebview(panel: vscode.WebviewPanel | vscode.WebviewView, extensionUri: vscode.Uri): void {
    const htmlPath = vscode.Uri.joinPath(extensionUri, "webviews", "chat", "index.html")
    const jsPath = vscode.Uri.joinPath(extensionUri, "webviews", "chat", "main.js")
    
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
    switch (message.type) {
      case "init":
        await this.handleInit()
        break

      case "sendMessage":
        await this.handleSendMessage(message)
        break

      case "changeAgent":
        this.currentAgent = message.agent
        break

      case "changeModel":
        if (message.model) {
          const [providerID, modelID] = message.model.split("/")
          this.currentModel = modelID ? { providerID, modelID } : undefined
        } else {
          this.currentModel = undefined
        }
        break

      case "attachFile":
        await this.handleAttachFile()
        break

      case "requestFileSuggestions":
        await this.handleFileSuggestions(message.searchTerm)
        break

      case "openFile":
        if (message.filePath) {
          const uri = vscode.Uri.file(message.filePath);
          vscode.workspace.openTextDocument(uri).then(doc => {
            vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
          });
        }
        break

      default:
        console.warn("[ChatPanel] Unknown message type:", message.type)
    }
  }

  private async handleInit(): Promise<void> {
    try {
      console.log("[ChatPanel] Initializing and loading models from server...")
      const status = await this.client.getServerStatus()
      const models = await this.client.getModels()
      
      // Update ProviderSelector cache
      await getProviderSelector().loadProvidersFromServer()
      
      console.log("[ChatPanel] Models loaded:", JSON.stringify(models))
      
      const agents = (status.agents && status.agents.length > 0) 
        ? status.agents 
        : getAgentSelector().getAgentList().map(a => a.id);
      
      const response = {
        type: "serverStatus",
        agents: agents,
        models: models
      };
      console.log("[ChatPanel] Posting to webview:", JSON.stringify(response));
      this.postMessageToWebview(response)

      // If we have a current session, send its history after status
      if (this.currentSessionId) {
        await this.switchSession(this.currentSessionId)
      }
    } catch (error) {
      console.error("[ChatPanel] Failed to handle init:", error)
      // Fallback with minimal info if server is starting
      this.postMessageToWebview({
        type: "serverStatus",
        agents: getAgentSelector().getAgentList().map(a => a.id),
        models: []
      })
    }
  }

  private async handleSendMessage(message: any): Promise<void> {
    const { sessionId, agent, model, text } = message

    if (agent) {
      this.currentAgent = agent
    }
    if (model) {
      const [providerID, modelID] = model.split("/")
      this.currentModel = modelID ? { providerID, modelID } : undefined
    }

    // Store last user message for duplicate detection
    this.lastUserMessage = text

    let targetSessionId = sessionId
    if (!targetSessionId) {
      const session = await this.sessionManager.createSession({
        title: text.substring(0, 50)
      })
      targetSessionId = session.id
      this.switchSession(targetSessionId)
    }

    this.currentSessionId = targetSessionId
    this.isWaiting = true

    try {
      const parts: MessagePart[] = [
        {
          id: Math.random().toString(36).substring(7),
          type: "text",
          text
        }
      ]

      this.client.startPolling(1000)

      await this.client.prompt(targetSessionId, {
        agent: this.currentAgent,
        model: this.currentModel,
        parts
      })

      console.log("[ChatPanel] Message sent successfully, waiting for response...")
    } catch (error) {
      console.error("[ChatPanel] Failed to send message:", error)
      this.isWaiting = false
      this.postMessageToWebview({
        type: "error",
        error: `Failed to send message: ${error}`
      })
    }
  }

  async handleAttachFile(): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false
    })

    if (fileUri && fileUri[0]) {
      const filePath = fileUri[0].fsPath
      this.postMessageToWebview({
        type: "message",
        sessionId: this.currentSessionId,
        id: `attachment-${Date.now()}`,
        role: "user",
        parts: [
          {
            type: "text",
            content: `Attached: ${filePath}`
          }
        ]
      })
    }
  }

  private async handleFileSuggestions(searchTerm: string): Promise<void> {
    const files = vscode.workspace.textDocuments.map(doc => {
      const relativePath = vscode.workspace.asRelativePath(doc.uri)
      return {
        path: relativePath,
        absolutePath: doc.uri.fsPath
      }
    })

    const filteredFiles = searchTerm
      ? files.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase()))
      : files.slice(0, 10)

    this.postMessageToWebview({
      type: "fileSuggestions",
      files: filteredFiles,
      sessionId: this.currentSessionId
    })
  }

  async switchSession(sessionId: string): Promise<void> {
    this.currentSessionId = sessionId
    const session = this.sessionManager.getSession(sessionId)

    if (session) {
      try {
        console.log(`[ChatPanel] Switching to session ${sessionId}, fetching history...`)
        const messagesResponse = await this.client.getSessionMessages(sessionId)
        console.log(`[ChatPanel] Fetched ${messagesResponse.length} messages for history`)
        
        this.postMessageToWebview({
          type: "init",
          sessionId: sessionId,
          sessionTitle: session.title,
          agent: session.agent || this.currentAgent,
          messages: messagesResponse
        })
      } catch (error) {
        console.error("[ChatPanel] Failed to fetch session history:", error)
        this.postMessageToWebview({
          type: "init",
          sessionId: sessionId,
          sessionTitle: session.title,
          agent: session.agent || this.currentAgent,
          messages: []
        })
      }
    }
  }

  private postMessageToWebview(message: any): void {
    if (this.panel?.webview) {
      this.panel.webview.postMessage(message)
    }
  }

  dispose(): void {
    if (this.panel && 'dispose' in this.panel) {
      this.panel.dispose()
    }
    this.panel = null
    this.eventListenerRemover?.()
    this.disposables.forEach((d) => d.dispose())
    ChatPanel.instance = null
  }
}

export function getChatPanel(sessionManager?: SessionManager): ChatPanel {
  return ChatPanel.getInstance(sessionManager)
}
