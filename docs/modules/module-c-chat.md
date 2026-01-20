# Module C: 聊天面板 (Chat Panel)

## 概述
本模块负责主要的用户交互界面，包括聊天输入、消息显示、工具执行渲染等功能。提供丰富的Webview界面和@文件提及功能。

**Phase**: 3
**依赖**: Module B (SessionManager), Module F (PermissionDialog)
**可以并行开发**: Module D
**后续依赖**: Module H (main.ts)

---

## 文件所有权

```
extension/src/chat/
├── ChatPanel.ts                [此模块独有]
├── ChatInput.ts                [此模块独有]
└── ToolRenderer.ts             [此模块独有]

extension/webviews/chat/
├── index.html                  [此模块独有]
├── styles.css                  [此模块独有]
└── main.ts                     [此模块独有]
```

---

## 任务列表

### Task 1: ChatPanel.ts
**文件**: `extension/src/chat/ChatPanel.ts`

**职责**: 管理聊天面板Webview和消息流

**接口定义**:

```typescript
import * as vscode from "vscode"
import { SessionManager, SessionWithStatus } from "../session/SessionManager"
import { PermissionDialog } from "./PermissionDialog"
import { OpenCodeClient, MessagePart } from "../client/OpenCodeClient"
import { SSEHandler } from "../client/SSEHandler"

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  role: MessageRole
  parts: MessagePart[]
  timestamp: number
}

export class ChatPanel {
  private static instance: ChatPanel | null = null
  private panel: vscode.WebviewPanel | null = null
  private sessionManager: SessionManager
  private client: OpenCodeClient
  private sseHandler: SSEHandler
  private permissionDialog: PermissionDialog
  private currentSessionId: string | null = null
  private messages: Map<string, ChatMessage[]> = new Map()
  private disposables: vscode.Disposable[] = []

  private constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager
    this.client = OpenCodeClient.getInstance()
    this.sseHandler = new SSEHandler("http://localhost:4096")
    this.permissionDialog = PermissionDialog.getInstance()

    this.setupSSEListeners()
  }

  static getInstance(sessionManager?: SessionManager): ChatPanel {
    if (!ChatPanel.instance && sessionManager) {
      ChatPanel.instance = new ChatPanel(sessionManager)
    }
    return ChatPanel.instance!
  }

  // === Panel Management ===

  /**
   * 显示聊天面板
   */
  async show(sessionId?: string): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active)
      if (sessionId) {
        await this.switchSession(sessionId)
      }
      return
    }

    this.panel = vscode.window.createWebviewPanel(
      "opencodeChat",
      "OpenCode Chat",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    )

    this.panel.webview.html = this.getHtmlContent()

    this.setupWebviewMessageHandlers()
    this.panel.onDidDispose(() => {
      this.dispose()
    })

    if (sessionId) {
      await this.switchSession(sessionId)
    } else {
      const activeSession = this.sessionManager.getActiveSession()
      if (activeSession) {
        await this.switchSession(activeSession.id)
      }
    }
  }

  /**
   * 切换会话
   */
  async switchSession(sessionId: string): Promise<void> {
    this.currentSessionId = sessionId

    const session = this.sessionManager.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // 加载会话消息
    const messages = await this.loadMessages(sessionId)
    this.messages.set(sessionId, messages)

    // 发送会话更新到webview
    this.postMessage({
      type: "sessionSwitch",
      sessionId,
      session
    })

    // 发送消息历史
    this.postMessage({
      type: "messageHistory",
      messages: messages
    })

    // 发送活跃状态
    await this.sessionManager.setActiveSession(sessionId)
  }

  // === Message Handling ===

  /**
   * 发送用户消息
   */
  async sendMessage(text: string, files?: vscode.Uri[]): Promise<void> {
    if (!this.currentSessionId) {
      vscode.window.showWarningMessage("No active session")
      return
    }

    const parts: MessagePart[] = [
      {
        type: "text",
        text
      }
    ]

    // 添加文件附件
    if (files && files.length > 0) {
      for (const file of files) {
        const content = await vscode.workspace.fs.readFile(file)
        const base64 = Buffer.from(content).toString("base64")
        parts.push({
          type: "file",
          data: `data:${this.getMimeType(file)};base64,${base64}`,
          filename: file.fsPath.split("/").pop()
        })
      }
    }

    // 显示用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      parts,
      timestamp: Date.now()
    }

    this.addMessage(this.currentSessionId, userMessage)

    // 发送到服务器
    try {
      await this.client.prompt(this.currentSessionId, {
        agent: undefined, // 使用会话默认agent
        model: undefined, // 使用会话默认model
        parts
      })

      await this.sessionManager.updateMessageCount(this.currentSessionId, 1)
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send message: ${error}`)
    }
  }

  /**
   * 添加消息到UI
   */
  private addMessage(sessionId: string, message: ChatMessage): void {
    const messages = this.messages.get(sessionId) || []
    messages.push(message)
    this.messages.set(sessionId, messages)

    this.postMessage({
      type: "messageAdd",
      message
    })
  }

  /**
   * 更新消息部分
   */
  updateMessagePart(sessionId: string messageId: string, partId: string, part: MessagePart): void {
    const messages = this.messages.get(sessionId) || []
    const message = messages.find((m) => m.id === messageId)

    if (message) {
      const partIndex = message.parts.findIndex((p) => (p as any).id === partId)
      if (partIndex >= 0) {
        message.parts[partIndex] = part
        this.postMessage({
          type: "messagePartUpdate",
          messageId,
          partId,
          part
        })
      }
    }
  }

  // === SSE Event Listeners ===

  private setupSSEListeners(): void {
    this.sseHandler.connect()

    this.sseHandler.on("message.part.updated", (event: any) => {
      if (event.sessionId === this.currentSessionId) {
        this.updateMessagePart(
          event.sessionId,
          event.messageId,
          event.partId,
          event.part
        )
      }
    })

    this.sseHandler.on("session.idle", () => {
      this.postMessage({
        type: "sessionIdle",
        sessionId: this.currentSessionId
      })
    })

    this.sseHandler.on("permission.asked", async (event: any) => {
      await this.handlePermissionRequest(event)
    })
  }

  /**
   * 处理权限请求
   */
  private async handlePermissionRequest(event: any): Promise<void> {
    const request = {
      id: event.requestId,
      tool: event.tool,
      operation: event.operation,
      targets: event.targets || [],
      risk: event.risk || "medium",
      rule: event.rule,
      askTime: Date.now(),
      sessionId: event.sessionId
    }

    await this.permissionDialog.showPermissionRequest(request)
  }

  // === Webview Message Handlers ===

  private setupWebviewMessageHandlers(): void {
    this.panel?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "sendMessage":
          await this.sendMessage(message.text, message.files)
          break

        case "openFile":
          await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(message.filePath)
          )
          break

        case "copyText":
          await vscode.env.clipboard.writeText(message.text)
          vscode.window.showInformationMessage("Copied to clipboard")
          break

        case "insertText":
          const editor = vscode.window.activeTextEditor
          if (editor) {
            const position = editor.selection.active
            await editor.edit((editBuilder) => {
              editBuilder.insert(position, message.text)
            })
          }
          break
      }
    })
  }

  private postMessage(message: any): void {
    this.panel?.webview.postMessage(message)
  }

  // === Utilities ===

  private async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const response = await this.client.getServerStatus()
      // TODO: 实际从服务器加载消息
      return []
    } catch (error) {
      console.error("Failed to load messages:", error)
      return []
    }
  }

  private getMimeType(uri: vscode.Uri): string {
    const ext = uri.fsPath.split(".").pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      js: "text/javascript",
      ts: "text/typescript",
      json: "application/json",
      md: "text/markdown",
      png: "image/png",
      jpg: "image/jpeg",
      gif: "image/gif"
    }
    return mimeTypes[ext || ""] || "application/octet-stream"
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCode Chat</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <div class="chat-container">
      <div class="messages" id="messages"></div>
      <div class="input-area">
        <textarea id="messageInput" placeholder="Type your message... Use @ to mention files"></textarea>
        <button id="sendButton">Send</button>
      </div>
    </div>
  </div>
  <script src="main.js"></script>
</body>
</html>`
  }

  // === Cleanup ===

  dispose(): void {
    this.panel?.dispose()
    this.panel = null
    this.sseHandler.disconnect()
    this.disposables.forEach((d) => d.dispose())
    this.messages.clear()
    ChatPanel.instance = null
  }
}

export function getChatPanel(sessionManager?: SessionManager): ChatPanel {
  return ChatPanel.getInstance(sessionManager)
}
```

---

### Task 2: ChatInput.ts
**文件**: `extension/src/chat/ChatInput.ts`

**职责**: 处理聊天输入和@文件提及

**接口定义**:

```typescript
import * as vscode from "vscode"
import { SelectionUtils } from "../utils/SelectionUtils"

export interface FileSuggestion {
  path: string
  uri: vscode.Uri
  lineRange?: string
}

export class ChatInput {
  private webview: vscode.Webview | null = null

  constructor(private panel: vscode.WebviewPanel) {
    this.webview = panel.webview
  }

  /**
   * 处理文本输入变化，检测@提及
   */
  async handleTextInput(text: string): Promise<void> {
    const mentionMatch = text.match(/@([^\s]*)$/)

    if (mentionMatch && mentionMatch[1].length >= 0) {
      const searchTerm = mentionMatch[1].slice(1)
      await this.showFileSuggestions(searchTerm)
    } else {
      this.postMessage({
        type: "clearSuggestions"
      })
    }
  }

  /**
   * 显示文件建议弹窗
   */
  private async showFileSuggestions(searchTerm: string): Promise<void | false> {
    if (searchTerm.length === 0) {
      // 显示当前打开的文件
      const openFiles = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .map((tab) => tab.input)
        .filter((input): input is vscode.TabInputText => input instanceof vscode.TabInputText)
        .map((input) => input.uri)
        .filter((uri) => uri.scheme === "file")

      const suggestions = await this.filterFiles(openFiles, searchTerm)
      this.postMessage({
        type: "fileSuggestions",
        suggestions: suggestions.map((uri) => ({
          path: vscode.workspace.asRelativePath(uri),
          uri: uri.toString()
        }))
      })
      return false
    }

    // 搜索工作区文件
    const files = await vscode.workspace.findFiles(searchTerm + "*", null, 50)

    const suggestions = await this.filterFiles(files, searchTerm)
    this.postMessage({
      type: "fileSuggestions",
      suggestions: suggestions.map((uri, index) => {
        const fileMention = SelectionUtils.getFileMention()
        return {
          path: vscode.workspace.asRelativePath(uri),
          uri: uri.toString(),
          lineRange: index === 0 && fileMention?.selection
            ? `#L${fileMention.selection.startLine}-${fileMention.selection.endLine}`
            : undefined
        }
      })
    })
  }

  /**
   * 过滤文件
   */
  private async filterFiles(
    files: vscode.Uri[],
    searchTerm: string
  ): Promise<vscode.Uri[]> {
    const textDocumentFiles: vscode.Uri[] = []

    for (const file of files) {
      if (file.scheme !== "file") continue

      const ext = file.fsPath.split(".").pop()?.toLowerCase()
      const textExtensions = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "md", "txt"]

      if (ext && textExtensions.includes(ext)) {
        textDocumentFiles.push(file)
      }
    }

    return textDocumentFiles.slice(0, 10)
  }

  /**
   * 插入文件引用到输入框
   */
  insertFileReference(fileSuggestion: FileSuggestion): void {
    let mention = `@${fileSuggestion.path}`
    if (fileSuggestion.lineRange) {
      mention += fileSuggestion.lineRange
    }

    this.postMessage({
      type: "insertText",
      text: mention + " "
    })
  }

  /**
   * 获取当前文件的引用
   */
  getCurrentFileMention(): string | null {
    const fileMention = SelectionUtils.getFileMention()
    return fileMention?.text || null
  }

  private postMessage(message: any): void {
    this.webview?.postMessage(message)
  }
}
```

---

### Task 3: ToolRenderer.ts
**文件**: `extension/src/chat/ToolRenderer.ts`

**职责**: 渲染工具执行状态可视化

**接口定义**:

```typescript
export type ToolState = "pending" | "running" | "completed" | "error"

export interface ToolExecution {
  toolId: string
  toolName: string
  state: ToolState
  title?: string
  startTime: number
  endTime?: number
  output?: string
  error?: string
  attachments?: any[]
}

export class ToolRenderer {
  /**
   * 渲染工具执行状态
   */
  renderItem(tool: ToolExecution): string {
    const icon = this.getToolIcon(tool.toolName)
    const stateIcon = this.getStateIcon(tool.state)
    const duration = tool.endTime
      ? `${((tool.endTime - tool.startTime) / 1000).toFixed(2)}s`
      : "Running..."

    return `
      <div class="tool-execution" data-state="${tool.state}">
        <div class="tool-header">
          <span class="tool-icon">${icon}</span>
          <span class="tool-name">${tool.toolName}</span>
          <span class="tool-state">${stateIcon}</span>
          <span class="tool-duration">${duration}</span>
        </div>
        ${tool.title ? `<div class="tool-title">${tool.title}</div>` : ""}
        ${this.renderToolOutput(tool)}
      </div>
    `
  }

  /**
   * 渲染工具输出
   */
  private renderToolOutput(tool: ToolExecution): string {
    if (tool.state === "pending") {
      return '<div class="tool-pending">Waiting for execution...</div>'
    }

    if (tool.state === "running") {
      return '<div class="tool-running">Executing...</div>'
    }

    if (tool.state === "error") {
      return `
        <div class="tool-error">
          <div class="error-icon">❌</div>
          <pre>${this.escapeHtml(tool.error || "Unknown error")}</pre>
        </div>
      `
    }

    if (tool.state === "completed") {
      const output = tool.output || "(No output)"

      // 检查是否需要折叠
      const shouldCollapse = this.shouldCollapseOutput(output)

      return `
        <div class="tool-content" ${shouldCollapse ? 'data-collapsed="true"' : ""}>
          <div class="output-toggle" onclick="this.parentElement.toggleAttribute('data-collapsed')">
            <span class="toggle-icon">${shouldCollapse ? "▶" : "▼"}</span>
            ${shouldCollapse ? `${this.truncateOutput(output)}...` : ""}
          </div>
          <pre class="tool-output">${this.escapeHtml(output)}</pre>
          ${this.renderAttachments(tool.attachments)}
        </div>
      `
    }

    return ""
  }

  /**
   * 渲染附件
   */
  private renderAttachments(attachments: any[]): string {
    if (!attachments || attachments.length === 0) return ""

    return `
      <div class="tool-attachments">
        ${attachments.map((att) => `
          <div class="attachment">
            <span class="attachment-icon">📎</span>
            <span class="attachment-name">${att.filename || "File"}</span>
          </div>
        `).join("")}
      </div>
    `
  }

  // === UI Helpers ===

  private getToolIcon(toolName: string): string {
    const icons: Record<string, string> = {
      bash: "💻",
      read: "📄",
      write: "📝",
      edit: "✏️",
      glob: "🔍",
      grep: "🔎",
      webfetch: "🌐",
      websearch: "🔍",
      codesearch: "🔍",
      task: "🔧",
      default: "🔧"
    }
    return icons[toolName] || icons.default
  }

  private getStateIcon(state: ToolState): string {
    const icons = {
      pending: "⏳",
      running: "🔄",
      completed: "✓",
      error: "✗"
    }
    return icons[state]
  }

  private shouldCollapseOutput(output: string): boolean {
    return output.length > 500 || output.split("\n").length > 20
  }

  private truncateOutput(output: string, maxLen: number = 100): string {
    return output.slice(0, maxLen)
  }

  private escapeHtml(text: string): string {
    const escaped = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }
    return text.replace(/[&<>"']/g, (char) => escaped[char as keyof typeof escaped])
  }
}

export function getToolRenderer(): ToolRenderer {
  return new ToolRenderer()
}
```

---

### Task 4: Webview (index.html, styles.css, main.ts)

**文件**: `extension/webviews/chat/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCode Chat</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    /* 内联主题变量，由VS Code注入 */
    :root {
      --vscode-font-family: var(--font-family);
      --vscode-foreground: #cccccc;
      --vscode-background: #1e1e1e;
      --vscode-editor-background: #1e1e1e;
      --vscode-button-background: #0e639c;
      --vscode-button-hoverBackground: #1177bb;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="chat-container">
      <div class="messages" id="messages"></div>

      <div class="input-area">
        <div class="file-mention-suggestions" id="fileSuggestions" hidden></div>

        <textarea
          id="messageInput"
          placeholder="Type your message... Use @ to mention files"
          rows="3"></textarea>

        <div class="input-actions">
          <button id="attachButton" class="icon-button" title="Attach file">📎</button>
          <button id="sendButton">Send</button>
        </div>
      </div>
    </div>
  </div>

  <script type="module" src="main.js"></script>
</body>
</html>
```

**文件**: `extension/webviews/chat/styles.css`

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  color: var(--vscode-foreground);
  background: var(--vscode-background);
  height: 100vh;
  overflow: hidden;
}

#app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 消息样式 */
.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message.user {
  align-items: flex-end;
}

.message.assistant {
  align-items: flex-start;
}

.message-content {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 8px;
  line-height: 1.5;
}

.message.user .message-content {
  background: var(--vscode-button-background);
  color: white;
}

.message.assistant .message-content {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border);
}

.message-role {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
}

/* 工具执行样式 */
.tool-execution {
  margin-top: 8px;
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  overflow: hidden;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-widget-border);
}

.tool-name {
  font-weight: 600;
  flex: 1;
}

.tool-state {
  font-size: 16px;
}

.tool-title {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
}

.tool-content[data-collapsed="true"] .tool-output {
  display: none;
}

.output-toggle {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.toggle-icon {
  transition: transform 0.2s;
}

.tool-content:not([data-collapsed="true"]) .toggle-icon {
  transform: rotate(90deg);
}

.tool-output {
  padding: 12px;
  background: var(--vscode-editor-background);
  max-height: 400px;
  overflow: auto;
}

.tool-error {
  padding: 12px;
  background: rgba(255, 0, 0, 0.1);
  color: #ff6b6b;
}

/* 输入区域 */
.input-area {
  padding: 16px;
  border-top: 1px solid var(--vscode-widget-border);
  background: var(--vscode-editor-background);
}

#messageInput {
  width: 100%;
  resize: none;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 10px;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  margin-bottom: 8px;
}

#messageInput:focus {
  border-color: var(--vscode-focusBorder);
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.icon-button {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 6px;
  font-size: 16px;
  border-radius: 4px;
}

.icon-button:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

#sendButton {
  background: var(--vscode-button-background);
  color: white;
  border: none;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

#sendButton:hover {
  background: var(--vscode-button-hoverBackground);
}

#sendButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 文件建议弹窗 */
.file-mention-suggestions {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.file-suggestion {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-suggestion:hover {
  background: var(--vscode-list-hoverBackground);
}

.file-suggestion-icon {
  font-size: 16px;
}

.file-suggestion-path {
  font-family: monospace;
  font-size: 13px;
}
```

**文件**: `extension/webviews/chat/main.ts`

```typescript
// 获取VS Code API
declare const acquireVsCodeApi: () => any
const vscode = acquireVsCodeApi()

// DOM 元素
const messagesContainer = document.getElementById("messages")!
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement
const sendButton = document.getElementById("sendButton")!
const attachButton = document.getElementById("attachButton")!
const fileSuggestions = document.getElementById("fileSuggestions")!

// 消息历史
let messages: any[] = []

// 发送消息到extension
function postMessage(message: any): void {
  vscode.postMessage(message)
}

// 渲染消息
function renderMessage(message: any): void {
  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${message.role}`

  const roleDiv = document.createElement("div")
  roleDiv.className = "message-role"
  roleDiv.textContent = message.role === "user" ? "You" : "OpenCode"
  messageDiv.appendChild(roleDiv)

  const contentDiv = document.createElement("div")
  contentDiv.className = "message-content"
  messageDiv.appendChild(contentDiv)

  // 渲染消息部分
  message.parts.forEach((part: any) => {
    if (part.type === "text") {
      contentDiv.appendChild(renderTextPart(part.text))
    } else if (part.type === "tool") {
      contentDiv.appendChild(renderToolPart(part))
    }
  })

  messagesContainer.appendChild(messageDiv)
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

function renderTextPart(text: string): HTMLElement {
  const pre = document.createElement("pre")
  pre.textContent = text
  return pre
}

function renderToolPart(part: any): HTMLElement {
  const toolDiv = document.createElement("div")
  toolDiv.innerHTML = part.html || `<div class="tool-execution">Tool: ${part.toolName}</div>`
  return toolDiv
}

// 监听extension消息
window.addEventListener("message", (event) => {
  const message = event.data

  switch (message.type) {
    case "messageAdd":
      renderMessage(message.message)
      messages.push(message.message)
      break

    case "messageHistory":
      messages = message.messages
      messagesContainer.innerHTML = ""
      messages.forEach(renderMessage)
      break

    case "messagePartUpdate":
      updateMessagePart(message.messageId, message.partId, message.part)
      break

    case "sessionIdle":
      showSessionIdle()
      break

    case "fileSuggestions":
      showFileSuggestions(message.suggestions)
      break

    case "insertText":
      insertText(message.text)
      break
  }
})

function updateMessagePart(messageId: string, partId: string, part: any): void {
  const message = messages.find((m) => m.id === messageId)
  if (!message) return

  const existingPart = message.parts.find((p: any) => p.id === partId)
  if (existingPart) {
    Object.assign(existingPart, part)
  } else {
    message.parts.push(part)
  }

  // 重新渲染消息
  const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`)
  if (messageEl) {
    messageEl.innerHTML = ""
    messageEl.appendChild(message.role === "user" ? renderTextPart(message.parts[0].text) : renderToolPart(part))
  }
}

function showFileSuggestions(suggestions: any[]): void {
  fileSuggestions.innerHTML = ""

  if (suggestions.length === 0) {
    fileSuggestions.hidden = true
    return
  }

  suggestions.forEach((suggestion) => {
    const div = document.createElement("div")
    div.className = "file-suggestion"
    div.innerHTML = `
      <span class="file-suggestion-icon">📄</span>
      <span class="file-suggestion-path">${suggestion.path}</span>
      ${suggestion.lineRange ? `<span class="file-suggestion-range">${suggestion.lineRange}</span>` : ""}
    `
    div.addEventListener("click", () => {
      insertText(`@${suggestion.path}${suggestion.lineRange || ""} `)
      fileSuggestions.hidden = true
    })
    fileSuggestions.appendChild(div)
  })

  fileSuggestions.hidden = false
}

function insertText(text: string): void {
  const start = messageInput.selectionStart
  const end = messageInput.selectionEnd
  const before = messageInput.value.substring(0, start)
  const after = messageInput.value.substring(end)

  messageInput.value = before + text + after
  messageInput.selectionStart = messageInput.selectionEnd = start + text.length
  messageInput.focus()
}

// 发送消息
sendButton.addEventListener("click", sendMessage)
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

function sendMessage(): void {
  const text = messageInput.value.trim()
  if (!text) return

  postMessage({
    type: "sendMessage",
    text
  })

  messageInput.value = ""
}

// 检测@文件提及
messageInput.addEventListener("input", (e) => {
  const text = messageInput.value
  const cursorPos = messageInput.selectionStart

  const beforeCursor = text.substring(0, cursorPos)
  const mentionMatch = beforeCursor.match(/@([^\s]*)$/)

  if (mentionMatch) {
    const searchTerm = mentionMatch[1]
    postMessage({
      type: "showFileSuggestions",
      searchTerm
    })
  } else {
    fileSuggestions.hidden = true
  }
})

// 清除文件建议
document.addEventListener("click", (e) => {
  if (!fileSuggestions.contains(e.target as Node)) {
    fileSuggestions.hidden = true
  }
})
```

---

## 测试清单

```bash
cd extension
bun install

# 类型检查
bun run check-types

# 语法检查
bun run lint
```

---

## 与其他模块的接口

### 提供:
1. `ChatPanel` - 用于Module H (main.ts)
2. `ChatInput` - 用于ChatPanel内部
3. `ToolRenderer` - 渲染工具执行状态

### 依赖:
- Module B: `SessionManager` - 获取/更新会话
- Module F: `PermissionDialog` - 处理权限请求
- Module A: `OpenCodeClient`, `SSEHandler` - API通信和事件流
- Module A: `SelectionUtils` - 生成文件提及

---

## 完成 Checklist

- [ ] ChatPanel.ts 实现主聊天面板
- [ ] ChatPanel.ts 实现@文件提及检测
- [ ] ChatPanel.ts 集成SSE事件处理
- [ ] ChatPanel.ts 集成权限处理
- [ ] ChatInput.ts 实现文件搜索和建议
- [ ] ToolRenderer.ts 实现工具状态渲染
- [ ] webviews/chat/* 实现前端界面
- [ ] 所有文件通过 `bun run test && bun run check-types`
- [ ] 准备交付Module H

---

## 注意事项

1. **单例模式**: ChatPanel使用单例，通过SessionManager注入
2. **Webview通信**: 使用postMessage进行extension和webview的双向通信
3. **SSE集成**: 实时更新工具执行状态
4. **文件提及**: 支持智能文件搜索和补全
5. **响应式设计**: 使用flex布局确保自适应不同窗口大小
