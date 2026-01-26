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
  private pendingSessionId: string | null = null
  private isCreatingSession: boolean = false
  private loadSessionsDebounce: NodeJS.Timeout | null = null

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

  createPlaceholderSession(options?: {
    title?: string
    agent?: string
  }): SessionWithStatus {
    if (this.pendingSessionId && this.activeSessionId?.startsWith("temp_")) {
      const existingPlaceholder = this.sessions.get(this.activeSessionId)
      if (existingPlaceholder && existingPlaceholder.messageCount === 0) {
        console.log(`[SessionManager] Deleting existing placeholder ${this.activeSessionId} before creating new one`)
        this.sessions.delete(this.activeSessionId)
        this.fireEvent({
          type: "deleted",
          sessionId: this.activeSessionId,
          timestamp: Date.now()
        })
      }
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const sessionWithStatus: SessionWithStatus = {
      id: tempId,
      title: options?.title || "New Session",
      agent: options?.agent || "build",
      projectID: "",
      directory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "",
      time: {
        created: Date.now(),
        updated: Date.now()
      },
      status: "active",
      messageCount: 0,
      lastActivity: Date.now()
    }

    this.sessions.set(tempId, sessionWithStatus)
    this.activeSessionId = tempId
    this.pendingSessionId = tempId

    this.fireEvent({
      type: "created",
      sessionId: tempId,
      timestamp: Date.now()
    })

    console.log(`[SessionManager] Created placeholder session: ${tempId}`)
    return sessionWithStatus
  }

  async ensureSessionCreated(sessionId: string, options?: {
    title?: string
  }): Promise<string> {
    const session = this.sessions.get(sessionId)
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!sessionId.startsWith("temp_")) {
      return sessionId
    }

    if (this.isCreatingSession) {
      console.log(`[SessionManager] Session creation already in progress, waiting for: ${sessionId}`)
      return sessionId
    }

    this.isCreatingSession = true

    try {
      console.log(`[SessionManager] Converting placeholder session ${sessionId} to real session`)
      
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      const realSession = await this.client.createSession({
        title: options?.title || session.title,
        directory: workspaceFolder?.uri.fsPath
      })

      const sessionWithStatus = this.toSessionWithStatus(realSession)
      
      sessionWithStatus.status = session.status
      sessionWithStatus.messageCount = session.messageCount
      sessionWithStatus.lastActivity = session.lastActivity

      this.sessions.delete(sessionId)
      this.sessions.set(realSession.id, sessionWithStatus)
      
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = realSession.id
        await this.config.set("activeSessionId", realSession.id)
      }

      if (this.pendingSessionId === sessionId) {
        this.pendingSessionId = realSession.id
      }

      this.fireEvent({
        type: "created",
        sessionId: realSession.id,
        timestamp: Date.now()
      })

      this.fireEvent({
        type: "updated",
        sessionId: realSession.id,
        timestamp: Date.now()
      })

      this.fireEvent({
        type: "deleted",
        sessionId: sessionId,
        timestamp: Date.now()
      })

      console.log(`[SessionManager] Real session created: ${realSession.id}`)
      return realSession.id
    } finally {
      this.isCreatingSession = false
    }
  }

  getPendingSessionId(): string | null {
    return this.pendingSessionId
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

  hasPlaceholderSession(): boolean {
    return this.pendingSessionId !== null && this.sessions.has(this.pendingSessionId || "")
  }

  async loadSessions(force: boolean = false): Promise<void> {
    if (!force && this.loadSessionsDebounce) {
      return
    }

    if (!force) {
      this.loadSessionsDebounce = setTimeout(async () => {
        this.loadSessionsDebounce = null
        await this.doLoadSessions()
      }, 500)
      return
    }

    await this.doLoadSessions()
  }

  private async doLoadSessions(): Promise<void> {
    try {
      console.log("[SessionManager] Loading sessions from API...")
      let sessionList: SessionInfo[] = []
      try {
        sessionList = await this.client.listSessions()
      } catch (e) {
        console.error("[SessionManager] Failed to list sessions from client:", e)
      }
      
      const placeholderId = this.pendingSessionId
      const activeSessionBefore = this.activeSessionId
      
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

      if (placeholderId && !this.sessions.has(placeholderId)) {
        this.activeSessionId = await this.config.get("activeSessionId") as string || null
        
        if (activeSessionBefore?.startsWith("temp_") && placeholderId === activeSessionBefore) {
          const newestSession = this.getAllSessions()[0]
          if (newestSession) {
            this.activeSessionId = newestSession.id
            this.pendingSessionId = newestSession.id
            await this.config.set("activeSessionId", newestSession.id)
            console.log(`[SessionManager] Auto-switched to newest session after placeholder conversion: ${newestSession.id}`)
          }
        }
      } else {
        const savedActiveId = this.config.get("activeSessionId")
        if (savedActiveId && this.sessions.has(savedActiveId as string)) {
          this.activeSessionId = savedActiveId as string
        }
      }

      console.log(`[SessionManager] Loaded ${this.sessions.size} sessions, active: ${this.activeSessionId}`)
      
      this.fireEvent({
        type: "updated",
        sessionId: this.activeSessionId || "",
        timestamp: Date.now()
      })
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load sessions: ${error}`)
    }
  }

  async setActiveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const previousActiveId = this.activeSessionId

    if (this.activeSessionId) {
      const oldSession = this.sessions.get(this.activeSessionId)
      if (oldSession && oldSession.status === "active" && this.activeSessionId !== sessionId) {
        oldSession.status = "idle"
        oldSession.lastActivity = Date.now()
        await this.updateSessionCache(oldSession.id)
        
        this.fireEvent({
          type: "updated",
          sessionId: this.activeSessionId,
          timestamp: Date.now()
        })
        
        console.log(`[SessionManager] Deactivated session: ${this.activeSessionId}`)
      }

      if (this.activeSessionId.startsWith("temp_") && this.activeSessionId !== sessionId) {
        console.log(`[SessionManager] Switching away from placeholder session ${this.activeSessionId}, deleting it`)
        this.deletePlaceholderSession(this.activeSessionId)
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

    if (previousActiveId !== sessionId) {
      this.fireEvent({
        type: "updated",
        sessionId: sessionId,
        timestamp: Date.now()
      })
      console.log(`[SessionManager] Activated session: ${sessionId}`)
    }
  }

  private deletePlaceholderSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session && sessionId.startsWith("temp_") && session.messageCount === 0) {
      console.log(`[SessionManager] Deleting placeholder session: ${sessionId}`)
      this.sessions.delete(sessionId)
      if (this.pendingSessionId === sessionId) {
        this.pendingSessionId = null
      }
      this.fireEvent({
        type: "deleted",
        sessionId,
        timestamp: Date.now()
      })
    }
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
        this.pendingSessionId = null
        await this.config.set("activeSessionId", undefined)
        console.log(`[SessionManager] Active session deleted, clearing active status`)
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

  async handleActiveSessionDeleted(): Promise<void> {
    console.log(`[SessionManager] Handling active session deletion`)
    this.activeSessionId = null
    this.pendingSessionId = null
    await this.config.set("activeSessionId", undefined)
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
    const sessionWithStatus: SessionWithStatus = {
      id: session.id,
      title: session.title,
      agent: session.agent,
      projectID: session.projectID,
      directory: session.directory,
      time: session.time,
      status: "idle",
      messageCount: 0,
      lastActivity: session.time?.updated || Date.now()
    }
    console.log(`[SessionManager] toSessionWithStatus: ${session.id} - ${session.title}`)
    return sessionWithStatus
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
