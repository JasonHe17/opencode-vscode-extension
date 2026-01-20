import * as vscode from "vscode"
import { SessionManager } from "../session/SessionManager.js"
import { PermissionDialog } from "./PermissionDialog.js"
import { OpenCodeClient } from "../client/OpenCodeClient.js"
import type { MessagePart, BusEvent } from "../client/types.js"

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
  private panel: vscode.WebviewPanel | null = null
  private sessionManager: SessionManager
  private client: OpenCodeClient
  private permissionDialog: PermissionDialog
  private currentSessionId: string | null = null
  private currentAgent: string = "build"
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
    this.eventListenerRemover = this.client.addEventListener((event: BusEvent) => {
      this.handleServerEvent(event)
    })
  }

  private handleServerEvent(event: BusEvent): void {
    const eventData = event.data as any
    
    // Handle different event structures
    const eventType = eventData?.type || event.type
    const properties = eventData?.properties || eventData
    
    console.log(`[ChatPanel] Event type: ${eventType}, has currentSessionId: ${!!this.currentSessionId}`)
    
    // Skip server.connected and other connection events
    if (eventType === "server.connected" || eventType === "session.idle") {
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
    
    console.log(`[ChatPanel] Message part updated: type=${part.type}, role=${role}, state=${part.state}, messageID=${messageId}`)
    console.log(`[ChatPanel] Sender: ${sender}, Raw part:`, JSON.stringify({
      sender: part.sender,
      dataSender: data.sender,
      calculatedRole: role
    }))
    
    // Skip user messages (we already display them locally)
    if (role === "user") {
      console.log(`[ChatPanel] Skipping user message`)
      return
    }

    // Check if this is a new message
    if (messageId && messageId !== this.currentMessageId) {
      console.log(`[ChatPanel] New message detected: ${messageId} (previous: ${this.currentMessageId})`)
      
      // Finalize previous message if any
      if (this.pendingMessageContent && this.pendingMessageContent.length > 0) {
        console.log(`[ChatPanel] Sending pending message content: ${this.pendingMessageContent.length} chars`)
        this.postMessageToWebview({
          type: "message",
          role: "assistant",
          content: this.pendingMessageContent,
          messages: [],
          attachments: []
        })
      }
      
      this.currentMessageId = messageId
      this.pendingMessageContent = ""
    }

    if (part.type === "text") {
      const content = part.text || part.content || ""
      console.log(`[ChatPanel] Text content: "${content.substring(0, 50)}..." (len=${content.length})`)
      
      if (content) {
        // Replace pending content with the full text (not append!)
        this.pendingMessageContent = content
        console.log(`[ChatPanel] Pending content length: ${this.pendingMessageContent.length}`)
        
        // Skip if this is duplicate of last user message (server sometimes echoes user input)
        if (content === this.lastUserMessage) {
          console.log(`[ChatPanel] Skipping duplicate of last user message`)
          this.pendingMessageContent = ""
        }
      }
    } else if (part.type === "step-finish" || part.type === "step-start") {
      // When step finishes, send the accumulated text
      if (this.pendingMessageContent && this.pendingMessageContent.length > 0) {
        console.log(`[ChatPanel] Step finished, sending content: ${this.pendingMessageContent.length} chars`)
        this.postMessageToWebview({
          type: "message",
          role: "assistant",
          content: this.pendingMessageContent,
          messages: [],
          attachments: []
        })
        this.currentMessageId = null
        this.pendingMessageContent = ""
        this.isWaiting = false
      }
    } else if (part.type === "tool") {
      const toolData = {
        type: "toolUpdate" as const,
        toolId: part.id,
        updates: {
          state: part.state,
          output: part.output,
          command: part.command,
          name: part.name
        }
      }
      this.postMessageToWebview(toolData)
    }
  }

  private handleMessageCreated(data: any): void {
    const message = data.message || data
    if (!message || !message.parts) return
    
    const sender = message.sender || data.sender
    
    // Skip user messages
    if (sender === "user") return
    
    console.log("[ChatPanel] Message created:", sender)
    
    // Find text parts
    const textParts = message.parts.filter((p: any) => p.type === "text")
    for (const part of textParts) {
      const content = part.text || part.content || ""
      if (content) {
        this.postMessageToWebview({
          type: "message",
          role: "assistant",
          content: content,
          messages: [],
          attachments: []
        })
      }
    }
  }

  private handleToolOutput(data: any): void {
    const toolData = {
      type: "toolUpdate" as const,
      toolId: data.toolID,
      updates: {
        output: data.output
      }
    }
    this.postMessageToWebview(toolData)
  }

  show(sessionId?: string): void {
    if (this.panel) {
      this.panel.reveal()
      if (sessionId) {
        this.switchSession(sessionId)
      }
      return
    }

    const extensionUri = vscode.extensions
      .getExtension("opencode-ai.opencode-gui")
      ?.extensionUri

    const panel = vscode.window.createWebviewPanel(
      "opencode.chat",
      "OpenCode Chat",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri!, "webviews", "chat")
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
      case "sendMessage":
        await this.handleSendMessage(message)
        break

      case "changeAgent":
        this.currentAgent = message.agent
        break

      case "attachFile":
        await this.handleAttachFile()
        break

      case "requestFileSuggestions":
        await this.handleFileSuggestions(message.searchTerm)
        break

      default:
        console.warn("[ChatPanel] Unknown message type:", message.type)
    }
  }

  private async handleSendMessage(message: any): Promise<void> {
    const { sessionId, agent, text } = message

    if (agent) {
      this.currentAgent = agent
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
          type: "text",
          text
        }
      ]

      this.client.startPolling(1000)

      await this.client.prompt(targetSessionId, {
        agent: this.currentAgent,
        model: undefined,
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
        role: "user",
        content: `Attached: ${filePath}`,
        messages: [],
        attachments: []
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
      files: filteredFiles
    })
  }

  switchSession(sessionId: string): void {
    this.currentSessionId = sessionId
    const session = this.sessionManager.getSession(sessionId)

    if (session) {
      this.postMessageToWebview({
        type: "init",
        sessionId: sessionId,
        sessionTitle: session.title,
        agent: session.agent || this.currentAgent,
        messages: []
      })
    }
  }

  private postMessageToWebview(message: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(message)
    }
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = null
    this.eventListenerRemover?.()
    this.disposables.forEach((d) => d.dispose())
    ChatPanel.instance = null
  }
}

export function getChatPanel(sessionManager?: SessionManager): ChatPanel {
  return ChatPanel.getInstance(sessionManager)
}
