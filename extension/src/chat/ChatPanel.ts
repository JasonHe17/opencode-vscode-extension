import * as vscode from "vscode"
import { readFileSync } from "fs"
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
  // Store reverted messages for redo functionality
  private revertedMessages: Map<string, any[]> = new Map()

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
    
    this.disposables.push(
      this.sessionManager.onSessionEvent((event) => {
        console.log(`[ChatPanel] SessionManager event: ${event.type}, sessionId: ${event.sessionId}`)
        
        if (event.type === "deleted" && event.sessionId === this.currentSessionId) {
          console.log(`[ChatPanel] Current session deleted, clearing chat display`)
          this.currentSessionId = null
          this.postMessageToWebview({
            type: "init",
            sessionId: null,
            sessionTitle: "No Active Session",
            agent: this.currentAgent,
            messages: []
          })
        }
      })
    )
  }

  private handleServerEvent(event: BusEvent): void {
    const eventData = event.data as any
    
    const eventType = eventData?.type || event.type
    const properties = eventData?.properties || eventData
    
    console.log(`[ChatPanel] Event type: ${eventType}, has currentSessionId: ${!!this.currentSessionId}`)
    
    if (eventType === "server.connected") {
      return
    }

    if (eventType === "session.idle") {
      const sessionId = properties?.sessionID || this.currentSessionId
      this.postMessageToWebview({
        type: "sessionIdle",
        sessionId
      })
      
      if (sessionId && !sessionId.startsWith("temp_")) {
        this.sessionManager.loadSessions(true).catch((error) => {
          console.error("[ChatPanel] Failed to refresh sessions:", error)
        })
      }
      return
    }
    
    const sessionEventId = properties?.sessionID || properties?.sessionId
    
    if (sessionEventId) {
      if (this.currentSessionId?.startsWith("temp_") && !sessionEventId.startsWith("temp_")) {
        const pendingId = this.sessionManager.getPendingSessionId()
        if (pendingId && !sessionEventId.startsWith("temp_")) {
          this.currentSessionId = sessionEventId
          console.log(`[ChatPanel] Updated currentSessionId from temp to real: ${sessionEventId}`)
        }
      }
      
      if (this.currentSessionId && this.currentSessionId !== sessionEventId && !sessionEventId.startsWith("temp_")) {
        return
      }
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
    
    const part = data.part || data
    const toolData = {
      type: "toolUpdate",
      sessionId: data.sessionID,
      messageId: data.messageID,
      toolId: data.toolID || part?.id,
      updates: {
        tool: part?.tool || data.tool,
        state: part?.state || {
          status: data.state || "pending",
          input: part?.state?.input || {},
          output: data.output || part?.state?.output || "",
          title: data.title || part?.state?.title || "",
          error: data.error || part?.state?.error || ""
        }
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
    
    setTimeout(() => {
      this.handleInit();
    }, 500);

    webviewView.onDidDispose(() => {
      this.panel = null
    })
  }

  private setupWebview(panel: vscode.WebviewPanel | vscode.WebviewView, extensionUri: vscode.Uri): void {
    const htmlPath = vscode.Uri.joinPath(extensionUri, "webviews", "chat", "index.html")
    const cssPath = vscode.Uri.joinPath(extensionUri, "webviews", "chat", "styles.css")
    const jsPath = vscode.Uri.joinPath(extensionUri, "webviews", "chat", "main.js")
    
    const fileContent = readFileSync(htmlPath.fsPath, "utf8")
    
    let htmlContent = fileContent
      .replace(
        /<link rel="stylesheet" href="styles.css">/,
        `<link rel="stylesheet" href="${panel.webview.asWebviewUri(cssPath)}">`
      )
      .replace(
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

      case "revert":
        await this.handleRevert(message)
        break

      case "unrevert":
        await this.handleUnrevert(message)
        break

      default:
        console.warn("[ChatPanel] Unknown message type:", message.type)
    }
  }

  private async handleRevert(message: any): Promise<void> {
    const { sessionId, messageId, partID } = message
    const targetSessionId = sessionId || this.currentSessionId

    if (!targetSessionId) {
      this.postMessageToWebview({
        type: "error",
        error: "No active session to revert"
      })
      return
    }

    try {
      // Get current messages before revert
      const messagesBefore = await this.client.getSessionMessages(targetSessionId)
      console.log("[ChatPanel] Messages before revert:", messagesBefore.length)
      
      // Find the target message index
      let targetIndex = -1
      if (messageId) {
        targetIndex = messagesBefore.findIndex((m: any) => m.id === messageId)
      } else {
        // If no messageId specified, target the last message
        targetIndex = messagesBefore.length - 1
      }
      
      console.log("[ChatPanel] Target message index:", targetIndex)
      
      // Find the user message that should be the revert point
      // We need to find the user message at or before the target
      let userMessageIndex = -1
      let userMessageToRestore = null
      
      if (targetIndex >= 0) {
        // If target is a user message, use it directly
        if (messagesBefore[targetIndex].role === "user") {
          userMessageIndex = targetIndex
        } else {
          // If target is an assistant message, find the preceding user message
          for (let i = targetIndex; i >= 0; i--) {
            if (messagesBefore[i].role === "user") {
              userMessageIndex = i
              break
            }
          }
        }
      }
      
      // If still no user message found, find the last user message
      if (userMessageIndex < 0) {
        for (let i = messagesBefore.length - 1; i >= 0; i--) {
          if (messagesBefore[i].role === "user") {
            userMessageIndex = i
            break
          }
        }
      }
      
      console.log("[ChatPanel] User message index:", userMessageIndex)
      
      // Get the user message content to restore
      if (userMessageIndex >= 0) {
        const userMsg = messagesBefore[userMessageIndex]
        const textParts = userMsg.parts?.filter((p: any) => p.type === "text")
        if (textParts && textParts.length > 0) {
          userMessageToRestore = textParts.map((p: any) => p.text || "").join("")
        }
      }

      console.log("[ChatPanel] User message to restore:", userMessageToRestore)

      // Call revert API with the user message ID
      const userMessageId = userMessageIndex >= 0 ? messagesBefore[userMessageIndex].id : messageId
      const revertResponse = await this.sessionManager.revertSession(targetSessionId, userMessageId, partID)
      console.log("[ChatPanel] Revert API response:", revertResponse)
      
      // Find messages that should be removed (from the user message onwards)
      let removedMessages: any[] = []
      let remainingMessages: any[] = []
      
      if (userMessageIndex >= 0) {
        // Remove the user message and all messages after it
        removedMessages = messagesBefore.slice(userMessageIndex)
        remainingMessages = messagesBefore.slice(0, userMessageIndex)
        console.log("[ChatPanel] Removing messages from user message index", userMessageIndex, "count:", removedMessages.length)
      } else if (messagesBefore.length > 0) {
        // Fallback: remove the last message if no user message found
        removedMessages = [messagesBefore[messagesBefore.length - 1]]
        remainingMessages = messagesBefore.slice(0, -1)
      }
      
      // Store removed messages for redo functionality
      if (removedMessages.length > 0) {
        this.revertedMessages.set(targetSessionId, removedMessages)
        console.log("[ChatPanel] Stored", removedMessages.length, "reverted messages for redo")
      }
      
      this.postMessageToWebview({
        type: "revertSuccess",
        sessionId: targetSessionId,
        messageId: userMessageId,
        removedMessages: removedMessages.map((m: any) => ({
          id: m.id,
          role: m.role,
          parts: m.parts
        })),
        userMessageToRestore,
        remainingMessages: remainingMessages.map((m: any) => ({
          id: m.id,
          role: m.role,
          parts: m.parts
        }))
      })
    } catch (error) {
      console.error("[ChatPanel] Failed to revert:", error)
      this.postMessageToWebview({
        type: "error",
        error: `Failed to revert: ${error}`
      })
    }
  }

  private async handleUnrevert(message: any): Promise<void> {
    const { sessionId } = message
    const targetSessionId = sessionId || this.currentSessionId

    if (!targetSessionId) {
      this.postMessageToWebview({
        type: "error",
        error: "No active session to restore"
      })
      return
    }

    try {
      // Get current messages before unrevert
      const messagesBefore = await this.client.getSessionMessages(targetSessionId)
      console.log("[ChatPanel] Messages before unrevert:", messagesBefore.length)
      
      // Get the stored reverted messages before calling unrevert (unrevert clears the revert state)
      const storedRevertedMessages = this.revertedMessages.get(targetSessionId)
      console.log("[ChatPanel] Stored reverted messages:", storedRevertedMessages?.length || 0)
      
      // Call unrevert API - this clears the session revert field
      const unrevertResponse = await this.sessionManager.unrevertSession(targetSessionId)
      console.log("[ChatPanel] Unrevert API response:", unrevertResponse)
      
      // After unrevert, reload messages from server
      const messagesAfter = await this.client.getSessionMessages(targetSessionId)
      console.log("[ChatPanel] Messages after unrevert:", messagesAfter.length)
      
      // Find restored messages (messages that are now present but weren't in the filtered list)
      const restoredMessages = messagesAfter.filter((m: any) => 
        !messagesBefore.find((before: any) => before.id === m.id)
      )
      
      console.log("[ChatPanel] Restored messages count from server:", restoredMessages.length)
      
      // If server didn't return new messages, use the stored reverted messages
      let finalRestoredMessages = restoredMessages
      let finalAllMessages = messagesAfter
      
      if (restoredMessages.length === 0 && storedRevertedMessages && storedRevertedMessages.length > 0) {
        console.log("[ChatPanel] Using stored reverted messages for redo:", storedRevertedMessages.length)
        finalRestoredMessages = storedRevertedMessages
        // Combine previous messages with stored reverted messages
        finalAllMessages = [...messagesBefore, ...storedRevertedMessages]
        
        // Clear stored reverted messages after redo
        this.revertedMessages.delete(targetSessionId)
      }
      
      this.postMessageToWebview({
        type: "unrevertSuccess",
        sessionId: targetSessionId,
        restoredMessages: finalRestoredMessages.map((m: any) => ({
          id: m.id,
          role: m.role,
          parts: m.parts
        })),
        allMessages: finalAllMessages.map((m: any) => ({
          id: m.id,
          role: m.role,
          parts: m.parts
        }))
      })
    } catch (error) {
      console.error("[ChatPanel] Failed to unrevert:", error)
      this.postMessageToWebview({
        type: "error",
        error: `Failed to restore: ${error}`
      })
    }
  }

  private async handleInit(): Promise<void> {
    try {
      console.log("[ChatPanel] Initializing and loading models from server...")
      
      const status = await this.client.getServerStatus().catch((error) => {
        console.error("[ChatPanel] Failed to get server status:", error)
        return {
          version: "unknown",
          agents: [],
          providers: [],
          models: []
        }
      })
      
      const models = await this.client.getModels().catch((error) => {
        console.error("[ChatPanel] Failed to get models:", error)
        return []
      })
      
      console.log("[ChatPanel] Models loaded:", JSON.stringify(models))
      
      const agents = (status.agents && status.agents.length > 0) 
        ? status.agents 
        : getAgentSelector().getAgentList().map(a => a.id)
      
      const response = {
        type: "serverStatus",
        agents: agents,
        models: models,
        serverConnected: status.agents.length > 0 || models.length > 0
      }
      console.log("[ChatPanel] Posting to webview:", JSON.stringify(response))
      this.postMessageToWebview(response)

      if (models.length > 0) {
        await getProviderSelector().loadProvidersFromServer()
      }

      if (this.currentSessionId) {
        await this.switchSession(this.currentSessionId)
      }
    } catch (error) {
      console.error("[ChatPanel] Failed to handle init:", error)
      this.postMessageToWebview({
        type: "serverStatus",
        agents: getAgentSelector().getAgentList().map(a => a.id),
        models: [],
        serverConnected: false
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

    let targetSessionId = sessionId || this.currentSessionId || this.sessionManager.getActiveSession()?.id

    if (!targetSessionId) {
      console.log("[ChatPanel] No active session, creating placeholder session for new message")
      const session = this.sessionManager.createPlaceholderSession({
        title: text.substring(0, 50),
        agent: this.currentAgent
      })
      targetSessionId = session.id
      this.currentSessionId = targetSessionId
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

      const mentionRegex = /@([a-zA-Z0-9._\-/]+)(?:#L(\d+)(?:-(\d+))?)?/g
      let match
      while ((match = mentionRegex.exec(text)) !== null) {
        const [, path] = match
        const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0].uri || vscode.Uri.file("/"), path)
        parts.push({
          id: Math.random().toString(36).substring(7),
          type: "file",
          uri: uri.toString(),
          filename: path,
          mime: "text/plain"
        } as any)
      }

      this.client.startPolling(1000)

      await this.sessionManager.ensureSessionCreated(targetSessionId, {
        title: text.substring(0, 50)
      })

      const realSessionId = this.sessionManager.getPendingSessionId() || targetSessionId
      this.currentSessionId = realSessionId

      await this.client.prompt(realSessionId, {
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
      const relativePath = vscode.workspace.asRelativePath(fileUri[0])
      this.postMessageToWebview({
        type: "insertText",
        text: `@${relativePath} `
      })
    }
  }

  private async handleFileSuggestions(searchTerm: string): Promise<void> {
    const openFiles = vscode.workspace.textDocuments.map(doc => ({
      path: vscode.workspace.asRelativePath(doc.uri),
      uri: doc.uri.toString()
    }))

    let files = openFiles
    if (searchTerm) {
      const workspaceFiles = await vscode.workspace.findFiles(`**/*${searchTerm}*`, "**/node_modules/**", 10)
      const foundFiles = workspaceFiles.map(uri => ({
        path: vscode.workspace.asRelativePath(uri),
        uri: uri.toString()
      }))
      
      const seen = new Set(openFiles.map(f => f.path))
      foundFiles.forEach(f => {
        if (!seen.has(f.path)) {
          files.push(f)
        }
      })
    }

    const filteredFiles = searchTerm
      ? files.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
      : files.slice(0, 10)

    this.postMessageToWebview({
      type: "fileSuggestions",
      suggestions: filteredFiles,
      sessionId: this.currentSessionId
    })
  }

  async switchSession(sessionId: string): Promise<void> {
    this.currentSessionId = sessionId
    const session = this.sessionManager.getSession(sessionId)

    if (session) {
      try {
        console.log(`[ChatPanel] Switching to session ${sessionId}, fetching history...`)
        
        let messagesResponse: any[] = []
        
        if (!sessionId.startsWith("temp_")) {
          messagesResponse = await this.client.getSessionMessages(sessionId)
          console.log(`[ChatPanel] Fetched ${messagesResponse.length} messages for history`)
        } else {
          console.log("[ChatPanel] Placeholder session, clearing display and showing empty state")
        }
        
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
    } else {
      console.log(`[ChatPanel] Session ${sessionId} not found, clearing chat`)
      this.currentSessionId = null
      this.postMessageToWebview({
        type: "init",
        sessionId: null,
        sessionTitle: "No Active Session",
        agent: this.currentAgent,
        messages: []
      })
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
