import * as vscode from "vscode"
import { OpenCodeClient, SessionInfo } from "../client/OpenCodeClient.js"
import { ExtensionConfig } from "../config/ExtensionConfig.js"

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

  async createSession(options?: {
    title?: string
    agent?: string
    model?: { providerID: string; modelID: string }
    permission?: Record<string, any>
  }): Promise<SessionWithStatus> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]

    const session = await this.client.createSession({
      title: options?.title,
      directory: workspaceFolder?.uri.fsPath
    })

    const sessionWithStatus = this.toSessionWithStatus(session)

    sessionWithStatus.status = "active"
    sessionWithStatus.messageCount = 0
    sessionWithStatus.lastActivity = Date.now()

    this.sessions.set(session.id, sessionWithStatus)
    await this.saveSessions()

    await this.setActiveSession(session.id)

    this.fireEvent({
      type: "created",
      sessionId: session.id,
      timestamp: Date.now()
    })

    vscode.window.showInformationMessage(`Session "${session.title}" created`)
    return sessionWithStatus
  }

  async loadSessions(): Promise<void> {
    try {
      const sessionList = await this.client.listSessions()
      this.sessions.clear()

      for (const session of sessionList) {
        const sessionWithStatus = this.toSessionWithStatus(session)

        const cached = this.config.get(`session_${session.id}`) as Partial<SessionWithStatus> | undefined
        if (cached) {
          sessionWithStatus.status = cached.status || "idle"
          sessionWithStatus.messageCount = cached.messageCount || 0
          sessionWithStatus.lastActivity = cached.lastActivity || session.time.updated
        }

        this.sessions.set(session.id, sessionWithStatus)
      }

      const savedActiveId = this.config.get("activeSessionId")
      if (savedActiveId && this.sessions.has(savedActiveId)) {
        this.activeSessionId = savedActiveId
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load sessions: ${error}`)
    }
  }

  async setActiveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (this.activeSessionId) {
      const oldSession = this.sessions.get(this.activeSessionId)
      if (oldSession && oldSession.status === "active") {
        oldSession.status = "idle"
        await this.updateSessionCache(oldSession.id)
      }
    }

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

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

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

  getActiveSession(): SessionWithStatus | null {
    if (!this.activeSessionId) return null
    return this.sessions.get(this.activeSessionId) || null
  }

  getSession(sessionId: string): SessionWithStatus | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): SessionWithStatus[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.time.updated - a.time.updated)
  }

  getSessionsByStatus(status: SessionWithStatus["status"]): SessionWithStatus[] {
    return this.getAllSessions().filter((s) => s.status === status)
  }

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

  async updateSession(
    sessionId: string,
    updates: Partial<Pick<SessionWithStatus, "status">>
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

  onSessionEvent(listener: (event: SessionEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(listener)
  }

  private fireEvent(event: SessionEvent): void {
    this.eventEmitter.fire(event)
  }

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
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this.eventEmitter.dispose()
  }
}

export function getSessionManager(context?: vscode.ExtensionContext): SessionManager {
  return SessionManager.getInstance(context)
}
