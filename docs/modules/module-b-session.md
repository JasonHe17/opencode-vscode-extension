# Module B: 会话管理 (Session Management)

## 概述
本模块负责管理OpenCode会话的完整生命周期，包括创建、加载、删除、分支等操作。同时提供会话数据持久化和事件通知机制。

**Phase**: 2
**依赖**: Module A (OpenCodeClient, ExtensionConfig, UriUtils, SelectionUtils)
**可以并行开发**: Module E, Module F
**后续依赖**: Module C (ChatPanel), Module D (SessionTreeProvider), Module H (main.ts)

---

## 文件所有权

```
extension/src/session/
├── SessionManager.ts          [此模块独有]
├── SessionWebview.ts          [此模块独有]
└── types.ts                   [此模块独有 - 可选，或直接使用Module A的类型]
```

---

## 任务列表

### Task 1: SessionManager.ts
**文件**: `extension/src/session/SessionManager.ts`

**职责**: 管理会话状态和生命周期

**接口定义**:

```typescript
import * as vscode from "vscode"
import { OpenCodeClient, SessionInfo } from "../client/OpenCodeClient"
import { ExtensionConfig } from "../config/ExtensionConfig"
import { UriUtils } from "../utils/UriUtils"

export interface SessionWithStatus extends SessionInfo {
  status: "active" | "idle" | "archived"
  messageCount: number
  lastActivity: number
}

export interface SessionEvent {
  type: "created" | "updated" | "deleted" | "activated" | "forked"
  sessionId: string
  timestamp: number
}

export class SessionManager {
  private static instance: SessionManager
  private client: OpenCodeClient
  private config: ExtensionConfig
  private sessions: Map<string, SessionWithStatus> = new Map()
  private activeSessionId: string | null = null
  private eventEmitter = new vscode.EventEmitter<SessionEvent>()
  private disposables: vscode.Disposable[] = []

  private constructor(
    private context: vscode.ExtensionContext
  ) {
    this.client = OpenCodeClient.getInstance()
    this.config = ExtensionConfig.getInstance(context)
    this.loadSessions()
  }

  static getInstance(context?: vscode.ExtensionContext): SessionManager {
    if (!SessionManager.instance && context) {
      SessionManager.instance = new SessionManager(context)
    }
    return SessionManager.instance
  }

  // === Session Lifecycle ===

  /**
   * 创建新会话
   */
  async createSession(options?: {
    title?: string
    agent?: string
    model?: { providerID: string; modelID: string }
    permission?: Record<string, any>
  }): Promise<SessionWithStatus> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    const projectID = workspaceFolder ? UriUtils.toAbsolutePath(workspaceFolder.uri) : "default"

    const session = await this.client.createSession({
      title: options?.title,
      agent: options?.agent,
      model: options?.model,
      permission: options?.permission
    })

    const sessionWithStatus = this.toSessionWithStatus(session)

    // Set initial status
    sessionWithStatus.status = "active"
    sessionWithStatus.messageCount = 0
    sessionWithStatus.lastActivity = Date.now()

    this.sessions.set(session.id, sessionWithStatus)
    await this.saveSessions()

    // Auto-activate new session
    await this.setActiveSession(session.id)

    this.fireEvent({
      type: "created",
      sessionId: session.id,
      timestamp: Date.now()
    })

    vscode.window.showInformationMessage(`Session "${session.title}" created`)
    return sessionWithStatus
  }

  /**
   * 加载历史会话
   */
  async loadSessions(): Promise<void> {
    try {
      const sessionList = await this.client.listSessions()

      // 加载每个会话的详情
      for (const session of sessionList) {
        const sessionWithStatus = this.toSessionWithStatus(session)

        // 从缓存恢复状态
        const cached = this.config.get(`session_${session.id}`) as Partial<SessionWithStatus> | undefined
        if (cached) {
          sessionWithStatus.status = cached.status || "idle"
          sessionWithStatus.messageCount = cached.messageCount || 0
          sessionWithStatus.lastActivity = cached.lastActivity || session.time.updated
        }

        this.sessions.set(session.id, sessionWithStatus)
      }

      // 恢复活跃会话
      const savedActiveId = this.config.get("activeSessionId")
      if (savedActiveId && this.sessions.has(savedActiveId)) {
        this.activeSessionId = savedActiveId
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load sessions: ${error}`)
    }
  }

  /**
   * 设置活跃会话
   */
  async setActiveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // 标记旧会话为idle
    if (this.activeSessionId) {
      const oldSession = this.sessions.get(this.activeSessionId)
      if (oldSession && oldSession.status === "active") {
        oldSession.status = "idle"
        await this.updateSessionCache(oldSession.id)
      }
    }

    // 标记新会话为active
    session.status = "active"
    session.lastActivity = Date.now()

    this.activeSessionId = sessionId
    await this.config.set("activeSessionId", sessionId)
    await this.updateSessionCache(sessionId)

    this.fireEvent({
      type: "activated",
      sessionId,
      timestamp: Date.now()
    })
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // 确认删除
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${session.title}"?`,
      "Delete",
      "Cancel"
    )

    if (confirm !== "Delete") return

    try {
      await this.client.deleteSession(sessionId)
      this.sessions.delete(sessionId)
      await this.config.set(`session_${sessionId}`, undefined)

      // 如果删除的是活跃会话，清空活跃状态
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = null
        await this.config.set("activeSessionId", undefined)
      }

      this.fireEvent({
        type: "deleted",
        sessionId,
        timestamp: Date.now()
      })

      vscode.window.showInformationMessage(`Session "${session.title}" deleted`)
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete session: ${error}`)
      throw error
    }
  }

  /**
   * 分支会话
   */
  async forkSession(sessionId: string, messageId?: string): Promise<SessionWithStatus> {
    const parentSession = this.sessions.get(sessionId)
    if (!parentSession) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      const newSession = await this.client.forkSession(sessionId, messageId)
      const sessionWithStatus = this.toSessionWithStatus(newSession)

      sessionWithStatus.status = "active"
      sessionWithStatus.messageCount = 0
      sessionWithStatus.lastActivity = Date.now()

      this.sessions.set(newSession.id, sessionWithStatus)

      // 激活新会话
      await this.setActiveSession(newSession.id)

      this.fireEvent({
        type: "forked",
        sessionId: newSession.id,
        timestamp: Date.now()
      })

      vscode.window.showInformationMessage(`Created fork from "${parentSession.title}"`)
      return sessionWithStatus
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to fork session: ${error}`)
      throw error
    }
  }

  // === Query Methods ===

  /**
   * 获取活跃会话
   */
  getActiveSession(): SessionWithStatus | null {
    if (!this.activeSessionId) return null
    return this.sessions.get(this.activeSessionId) || null
  }

  /**
   * 获取指定会话
   */
  getSession(sessionId: string): SessionWithStatus | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): SessionWithStatus[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.time.updated - a.time.updated)
  }

  /**
   * 按状态筛选会话
   */
  getSessionsByStatus(status: SessionWithStatus["status"]): SessionWithStatus[] {
    return this.getAllSessions().filter((s) => s.status === status)
  }

  // === Update Methods ===

  /**
   * 更新会话消息计数
   */
  async updateMessageCount(sessionId: string, delta: number): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.messageCount += delta
      session.lastActivity = Date.now()
      await this.updateSessionCache(sessionId)

      this.fireEvent({
        type: "updated",
        sessionId,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 更新会话属性
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<SessionWithStatus, "title" | "agent" | "status">>
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    Object.assign(session, updates)
    session.lastActivity = Date.now()
    await this.updateSessionCache(sessionId)

    this.fireEvent({
      type: "updated",
      sessionId,
      timestamp: Date.now()
    })
  }

  // === Event System ===

  /**
   * 订阅会话事件
   */
  onSessionEvent(listener: (event: SessionEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(listener)
  }

  private fireEvent(event: SessionEvent): void {
    this.eventEmitter.fire(event)
  }

  // === Private Helpers ===

  private toSessionWithStatus(session: SessionInfo): SessionWithStatus {
    return {
      ...session,
      status: "idle",
      messageCount: 0,
      lastActivity: session.time.updated
    }
  }

  private async updateSessionCache(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      await this.config.set(`session_${sessionId}`, {
        status: session.status,
        messageCount: session.messageCount,
        lastActivity: session.lastActivity
      })
    }
  }

  private async saveSessions(): Promise<void> {
    // Sessions 本身由OpenCode服务端管理
    // 这里只保存额外的状态
  }

  // === Cleanup ===

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this.eventEmitter.dispose()
  }
}

export function getSessionManager(context?: vscode.ExtensionContext): SessionManager {
  return SessionManager.getInstance(context)
}
```

---

### Task 2: SessionWebview.ts
**文件**: `extension/src/session/SessionWebview.ts`

**职责**: 显示会话历史记录的Webview

**接口定义**:

```typescript
import * as vscode from "vscode"
import { SessionWithStatus } from "./SessionManager"

export class SessionWebview {
  private static instance: SessionWebview
  private panel: vscode.WebviewPanel | null = null

  private constructor() {}

  static getInstance(): SessionWebview {
    if (!SessionWebview.instance) {
      SessionWebview.instance = new SessionWebview()
    }
    return SessionWebview.instance
  }

  /**
   * 显示会话历史
   */
  async show(session: SessionWithStatus): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One)
      this.updatePanel(session)
      return
    }

    this.panel = vscode.window.createWebviewPanel(
      "opencodeSessionHistory",
      `Session: ${session.title}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: []
      }
    )

    this.panel.onDidDispose(() => {
      this.panel = null
    })

    this.updatePanel(session)
  }

  private updatePanel(session: SessionWithStatus): void {
    if (!this.panel) return

    const html = this.getHtmlContent(session)
    this.panel.webview.html = html
  }

  private getHtmlContent(session: SessionWithStatus): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }
    h1 {
      color: var(--vscode-editor-foreground);
    }
    .info {
      margin-bottom: 20px;
      padding: 10px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>${session.title}</h1>
  <div class="info">
    <p><strong>ID:</strong> ${session.id}</p>
    <p><strong>Status:</strong> ${session.status}</p>
    <p><strong>Agent:</strong> ${session.agent}</p>
    <p><strong>Messages:</strong> ${session.messageCount}</p>
    <p><strong>Created:</strong> ${new Date(session.time.created).toLocaleString()}</p>
    <p><strong>Updated:</strong> ${new Date(session.time.updated).toLocaleString()}</p>
  </div>
</body>
</html>`
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = null
  }
}

export function getSessionWebview(): SessionWebview {
  return SessionWebview.getInstance()
}
```

---

## 测试清单

```bash
cd extension
bun install

# 创建测试文件
touch test/session/SessionManager.test.ts

# 运行测试
bun run test

# 类型检查
bun run check-types
```

**测试示例**:
```typescript
// test/session/SessionManager.test.ts
import { describe, it, expect } from "bun:test"
import { SessionManager } from "../src/session/SessionManager"

describe("SessionManager", () => {
  let manager: SessionManager

  // 注意：需要模拟vscode API和OpenCodeClient

  it("should create singleton instance", () => {
    const manager1 = SessionManager.getInstance(mockContext)
    const manager2 = SessionManager.getInstance()
    expect(manager1).toBe(manager2)
  })

  it("should get active session", async () => {
    const active = manager.getActiveSession()
    expect(active).toBeNull()
  })
})
```

---

## 与其他模块的接口

### 提供:
1. `SessionManager` - 用于Module C (ChatPanel), D (SessionTreeProvider), H (main.ts)
2. `SessionWithStatus` - 定义会话状态扩展
3. `SessionEvent` - 会话事件类型
4. `SessionWebview` - 用于Module D (SessionTreeProvider) 查看会话详情

### 依赖:
- Module A: `OpenCodeClient` - API调用
- Module A: `ExtensionConfig` - 配置持久化
- Module A: `UriUtils` - 路径转换
- `vscode` - VS Code API

---

## 完成 Checklist

- [x] SessionManager.ts 实现会话生命周期
- [x] SessionManager.ts 实现事件系统
- [x] SessionWebview.ts 实现会话历史查看
- [x] 集成OpenCodeClient进行API调用
- [x] 集成ExtensionConfig进行持久化
- [x] 所有文件通过类型检查
- [x] 准备交付Module C和Module D

---

## 注意事项

1. **单例模式**: SessionManager使用单例确保全局唯一状态
2. **事件驱动**: 使用EventEmitter通知UI模块更新
3. **缓存策略**: 会话状态使用ExtensionConfig缓存
4. **错误处理**: 所有异步操作都需要try/catch
5. **状态同步**: 服务器状态和本地状态需要保持同步
