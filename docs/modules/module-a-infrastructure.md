# Module A: 基础设施层 (Infrastructure Layer)

## 概述
本模块负责建立扩展的基础设施，包括API客户端、SSE事件处理、配置管理和工具类函数。所有其他模块都依赖于此模块提供的接口。

**Phase**: 1
**可以并行开发**: Module G (命令注册框架)
**后续依赖**: Module B, E, F

---

## 文件所有权

```
extension/src/client/
├── OpenCodeClient.ts          [此模块独有]
└── SSEHandler.ts              [此模块独有]

extension/src/config/
├── ExtensionConfig.ts         [此模块独有]
└── SettingsManager.ts         [此模块独有]

extension/src/utils/
├── UriUtils.ts                [此模块独有]
└── SelectionUtils.ts          [此模块独有]
```

---

## 任务列表

### Task 1: OpenCodeClient.ts
**文件**: `extension/src/client/OpenCodeClient.ts`

**职责**: 封装 `@opencode-ai/sdk/v2` 的API调用，提供统一的错误处理和重试机制

**接口定义**:

```typescript
// types.ts (在client目录下创建)
export interface SessionInfo {
  id: string
  title: string
  agent: string
  projectID: string
  directory: string
  time: {
    created: number
    updated: number
  }
}

export interface MessagePart {
  type: "text" | "tool" | "reasoning" | "file"
  content: unknown
}

export interface BusEvent {
  type: string
  data: unknown
}

export interface ModelOptions {
  providerID: string
  modelID: string
}

export interface PromptOptions {
  agent?: string
  model?: ModelOptions
  parts: MessagePart[]
}

// OpenCodeClient.ts
import * as vscode from "vscode"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"

export class OpenCodeClient {
  private static instance: OpenCodeClient
  private sdk: ReturnType<typeof createOpencodeClient>
  private baseUrl: string
  private retries: number = 3

  private constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "http://localhost:4096"
    this.sdk = createOpencodeClient({ baseUrl: this.baseUrl })
  }

  static getInstance(baseUrl?: string): OpenCodeClient {
    if (!OpenCodeClient.instance) {
      OpenCodeClient.instance = new OpenCodeClient(baseUrl)
    }
    return OpenCodeClient.instance
  }

  async createSession(options?: {
    title?: string
    permission?: Record<string, any>
    agent?: string
    model?: ModelOptions
  }): Promise<SessionInfo> {
    try {
      const session = await this.sdk.session.create(options || {})
      return this.normalizeSessionInfo(session)
    } catch (error) {
      this.handleError(error, "Failed to create session")
      throw error
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    try {
      const sessions = await this.sdk.session.list()
      return sessions.map((s) => this.normalizeSessionInfo(s))
    } catch (error) {
      this.handleError(error, "Failed to list sessions")
      throw error
    }
  }

  async getSession(id: string): Promise<SessionInfo> {
    try {
      const session = await this.sdk.session.get(id)
      return this.normalizeSessionInfo(session)
    } catch (error) {
      this.handleError(error, `Failed to get session ${id}`)
      throw error
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      await this.sdk.session.delete(id)
    } catch (error) {
      this.handleError(error, `Failed to delete session ${id}`)
      throw error
    }
  }

  async prompt(sessionID: string, options: PromptOptions): Promise<void> {
    for (let i = 0; i < this.retries; i++) {
      try {
        await this.sdk.session.prompt({
          sessionID,
          agent: options.agent,
          model: options.model,
          parts: options.parts
        })
        return
      } catch (error) {
        if (i === this.retries - 1) throw error
        await this.backoff(i)
      }
    }
  }

  async forkSession(id: string, messageID?: string): Promise<SessionInfo> {
    try {
      const session = await this.sdk.session.fork(id, messageID)
      return this.normalizeSessionInfo(session)
    } catch (error) {
      this.handleError(error, `Failed to fork session ${id}`)
      throw error
    }
  }

  async subscribeEvents(): Promise<AsyncIterable<BusEvent>> {
    const { stream } = await this.sdk.event.subscribe()
    return stream as AsyncIterable<BusEvent>
  }

  async getServerStatus(): Promise<{
    version: string
    agents: string[]
    providers: string[]
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/`)
      const data = await response.json()
      return {
        version: data.version || "unknown",
        agents: data.agents || [],
        providers: data.providers || []
      }
    } catch (error) {
      this.handleError(error, "Failed to get server status")
      throw error
    }
  }

  private normalizeSessionInfo(session: any): SessionInfo {
    return {
      id: session.id,
      title: session.title || "Untitled",
      agent: session.agent || "build",
      projectID: session.projectID,
      directory: session.directory,
      time: {
        created: session.time?.created || Date.now(),
        updated: session.time?.updated || Date.now()
      }
    }
  }

  private handleError(error: unknown, message: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`)
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.pow(2, attempt) * 1000
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

export function getOpenCodeClient(baseUrl?: string): OpenCodeClient {
  return OpenCodeClient.getInstance(baseUrl)
}
```

**测试**:
```typescript
// client/OpenCodeClient.test.ts
import { describe, it, expect } from "bun:test"
import { OpenCodeClient } from "./OpenCodeClient"

describe("OpenCodeClient", () => {
  it("should create singleton instance", () => {
    const client1 = OpenCodeClient.getInstance()
    const client2 = OpenCodeClient.getInstance()
    expect(client1).toBe(client2)
  })

  it("should normalize session info", async () => {
    const client = OpenCodeClient.getInstance()
    const session = await client.createSession({ title: "Test" })
    expect(session).toHaveProperty("id")
    expect(session.title).toBe("Test")
  })
})
```

---

### Task 2: SSEHandler.ts
**文件**: `extension/src/client/SSEHandler.ts`

**职责**: 管理SSE连接，处理自动重连和事件分发

**接口定义**:

```typescript
export type EventCallback = (event: BusEvent) => void
export type ErrorHandler = (error: Error) => void

export class SSEHandler {
  private eventSource: EventSource | null = null
  private subscriptions: Map<string, EventCallback[]> = new Map()
  private errorCallback: ErrorHandler | null = null
  private retryCount: number = 0
  private maxRetries: number = 10
  private baseDelay: number = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(private baseUrl: string) {}

  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return
    }

    const url = `${this.baseUrl}/event`
    this.eventSource = new EventSource(url)

    this.eventSource.onopen = () => {
      this.retryCount = 0
      console.log("[SSE] Connected")
    }

    this.eventSource.onmessage = (event) => {
      try {
        const busEvent: BusEvent = JSON.parse(event.data)
        this.dispatchEvent(busEvent)
      } catch (error) {
        console.error("[SSE] Failed to parse event:", error)
      }
    }

    this.eventSource.onerror = (error) => {
      this.handleConnectionError()
    }

    this.startHeartbeat()
  }

  on(eventType: string, callback: EventCallback): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, [])
    }
    this.subscriptions.get(eventType)?.push(callback)

    return () => {
      const callbacks = this.subscriptions.get(eventType)
      const index = callbacks?.indexOf(callback) ?? -1
      if (index > -1) {
        callbacks?.splice(index, 1)
      }
    }
  }

  onError(handler: ErrorHandler): void {
    this.errorCallback = handler
  }

  disconnect(): void {
    this.stopHeartbeat()
    this.eventSource?.close()
    this.eventSource = null
    this.subscriptions.clear()
  }

  private dispatchEvent(event: BusEvent): void {
    const callbacks = this.subscriptions.get(event.type) || []
    callbacks.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        console.error("[SSE] Error in event callback:", error)
      }
    })

    // Also fire wildcard listeners
    const wildcardCallbacks = this.subscriptions.get("*") || []
    wildcardCallbacks.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        console.error("[SSE] Error in wildcard callback:", error)
      }
    })
  }

  private handleConnectionError(): void {
    this.errorCallback?.(new Error("SSE connection error"))

    this.eventSource?.close()
    this.eventSource = null

    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= this.maxRetries) {
      this.errorCallback?.(new Error("Max retry attempts reached"))
      return
    }

    const delay = this.baseDelay * Math.pow(2, this.retryCount)
    const maxDelay = 30000

    const adjustedDelay = Math.min(delay, maxDelay)

    console.log(`[SSE] Reconnecting in ${adjustedDelay}ms (attempt ${this.retryCount + 1})`)

    setTimeout(() => {
      this.retryCount++
      this.connect()
    }, adjustedDelay)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        console.log("[SSE] Heartbeat detected closed connection")
        this.handleConnectionError()
      }
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}

export function createSSEHandler(baseUrl: string): SSEHandler {
  return new SSEHandler(baseUrl)
}
```

**测试**:
```typescript
// client/SSEHandler.test.ts
import { describe, it, expect } from "bun:test"
import { SSEHandler } from "./SSEHandler"

describe("SSEHandler", () => {
  it("should handle event subscriptions", async () => {
    const handler = new SSEHandler("http://localhost:4096")
    const events: any[] = []

    handler.on("test.event", (event) => {
      events.push(event)
    })

    handler.dispatchEvent({ type: "test.event", data: { value: 1 } })
    expect(events.length).toBe(1)
    expect(events[0].data.value).toBe(1)

    handler.disconnect()
  })
})
```

---

### Task 3: ExtensionConfig.ts
**文件**: `extension/src/config/ExtensionConfig.ts`

**职责**: 管理扩展在workspaceState中的配置

**接口定义**:

```typescript
export interface ExtensionState {
  activeSessionId?: string
  serverMode?: "auto" | "remote" | "embedded"
  serverBaseUrl?: string
  defaultAgent?: string
  defaultProvider?: string
  lastUsedModel?: { providerID: string; modelID: string }
  historyLimit?: number
}

export class ExtensionConfig {
  private static instance: ExtensionConfig
  private state: ExtensionState = {}

  private constructor(private context: vscode.ExtensionContext) {
    this.loadConfig()
  }

  static getInstance(context?: vscode.ExtensionContext): ExtensionConfig {
    if (!ExtensionConfig.instance && context) {
      ExtensionConfig.instance = new ExtensionConfig(context)
    }
    return ExtensionConfig.instance
  }

  private loadConfig(): void {
    this.state = this.context.globalState.get<ExtensionState>("opencode.state") || {}
  }

  async saveConfig(): Promise<void> {
    await this.context.globalState.update("opencode.state", this.state)
  }

  get<K extends keyof ExtensionState>(key: K): ExtensionState[K] {
    return this.state[key]
  }

  async set<K extends keyof ExtensionState>(
    key: K,
    value: ExtensionState[K]
  ): Promise<void> {
    this.state[key] = value
    await this.saveConfig()
  }

  getAll(): ExtensionState {
    return { ...this.state }
  }

  async clear(): Promise<void> {
    this.state = {}
    await this.saveConfig()
  }
}

export function getExtensionConfig(context: vscode.ExtensionContext): ExtensionConfig {
  return ExtensionConfig.getInstance(context)
}
```

---

### Task 4: SettingsManager.ts
**文件**: `extension/src/config/SettingsManager.ts`

**职责**: 管理VS Code的workspace配置

**接口定义**:

```typescript
export type ConfigKey =
  | "opencode.server.mode"
  | "opencode.server.baseUrl"
  | "opencode.server.autoStart"
  | "opencode.defaultAgent"
  | "opencode.chat.showToolOutput"

export class SettingsManager {
  private config: vscode.WorkspaceConfiguration

  constructor() {
    this.config = vscode.workspace.getConfiguration("opencode")
  }

  get<T = any>(key: ConfigKey, defaultValue?: T): T {
    return this.config.get<T>(key, defaultValue as T)
  }

  async set<T = any>(key: ConfigKey, value: T): Promise<void> {
    await this.config.update(key, value, vscode.ConfigurationTarget.Global)
  }

  watch<T = any>(key: ConfigKey, callback: (value: T) => void): vscode.Disposable {
    const listener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`opencode.${key}`)) {
        callback(this.get<T>(key))
      }
    })

    return listener
  }

  refresh(): void {
    this.config = vscode.workspace.getConfiguration("opencode")
  }
}

export function getSettingsManager(): SettingsManager {
  return new SettingsManager()
}
```

---

### Task 5: UriUtils.ts
**文件**: `extension/src/utils/UriUtils.ts`

**职责**: URI和文件路径转换工具

**接口定义**:

```typescript
export class UriUtils {
  static toAbsolutePath(uri: vscode.Uri): string {
    return uri.fsPath
  }

  static toRelativePath(uri: vscode.Uri, rootUri?: vscode.Uri): string | null {
    const root = rootUri || this.getWorkspaceFolder(uri)
    if (!root) return null

    const absolutePath = uri.fsPath
    const rootPath = root.fsPath

    if (absolutePath.startsWith(rootPath)) {
      return absolutePath.slice(rootPath.length + 1).replace(/\\/g, "/")
    }

    return null
  }

  static getWorkspaceFolder(uri: vscode.Uri): vscode.Uri | null {
    const folder = vscode.workspace.getWorkspaceFolder(uri)
    return folder?.uri || null
  }

  static toUri(path: string): vscode.Uri {
    return vscode.Uri.file(path)
  }
}
```

---

### Task 6: SelectionUtils.ts
**文件**: `extension/src/utils/SelectionUtils.ts`

**职责**: 编辑器选择和文件提及生成工具

**接口定义**:

```typescript
export interface FileMention {
  text: string
  path: string
  selection?: {
    startLine: number
    endLine: number
  }
}

export class SelectionUtils {
  static getFileMention(editor?: vscode.TextEditor): FileMention | null {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return null

    const document = activeEditor.document
    const relativePath = UriUtils.toRelativePath(document.uri)
    if (!relativePath) return null

    let mentionText = `@${relativePath}`
    let selection

    const sel = activeEditor.selection
    if (!sel.isEmpty) {
      const startLine = sel.start.line + 1
      const endLine = sel.end.line + 1

      if (startLine === endLine) {
        mentionText += `#L${startLine}`
      } else {
        mentionText += `#L${startLine}-${endLine}`
      }

      selection = { startLine, endLine }
    }

    return {
      text: mentionText,
      path: relativePath,
      selection
    }
  }

  static getActiveSelection(editor?: vscode.TextEditor): string | null {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return null

    const sel = activeEditor.selection
    if (sel.isEmpty) return null

    return activeEditor.document.getText(sel)
  }

  static hasSelection(editor?: vscode.TextEditor): boolean {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return false

    return !activeEditor.selection.isEmpty
  }

  static insertIntoEditor(text: string, editor?: vscode.TextEditor): void {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return

    const position = activeEditor.selection.active
    activeEditor.edit((editBuilder) => {
      editBuilder.insert(position, text)
    })
  }
}
```

---

## 测试清单

```bash
cd extension
bun install

# 运行所有测试
bun run test

# 类型检查
bun run check-types

# 语法检查
bun run lint
```

---

## 与其他模块的接口

### 提供:
1. `OpenCodeClient` - 用于Module B (SessionManager), E (Agent/ProviderSelector), F (PermissionDialog)
2. `SSEHandler` - 用于Module B (SessionManager), C (ChatPanel)
3. `ExtensionConfig` - 用于Module B (SessionManager), H (main.ts)
4. `SettingsManager` - 用于Module H (main.ts)
5. `UriUtils`, `SelectionUtils` - 用于所有模块

### 依赖:
- `@opencode-ai/sdk/v2` - OpenCode TypeScript SDK
- `vscode` - VS Code API

---

## 完成 Checklist

- [ ] OpenCodeClient.ts 完成所有API方法
- [ ] SSEHandler.ts 完成事件流处理
- [ ] ExtensionConfig.ts 完成配置持久化
- [ ] SettingsManager.ts 完成VS Code设置集成
- [ ] UriUtils.ts 完成URI转换
- [ ] SelectionUtils.ts 完成文件提及生成
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 准备与Module G合并package.json

---

## 注意事项

1. **单例模式**: OpenCodeClient, SSEHandler, ExtensionConfig 使用单例确保全局唯一
2. **错误处理**: 所有API调用都需要try/catch并显示友好错误提示
3. **重试机制**: OpenCodeClient 使用指数退避重试
4. **类型安全**: 所有接口使用TypeScript严格类型定义
5. **向后兼容**: 配置项使用可选属性，支持渐进式迁移
