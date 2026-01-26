import * as vscode from "vscode"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { SessionInfo, BusEvent, PromptOptions } from "./types.js"

export { SessionInfo, MessagePart } from "./types.js"


export class OpenCodeClient {
  private static instance: OpenCodeClient
  private sdk: ReturnType<typeof createOpencodeClient>
  private baseUrl: string
  private retries: number = 3
  private isPolling: boolean = false
  private pollInterval: NodeJS.Timeout | null = null
  private eventListeners: Set<(event: BusEvent) => void> = new Set()
  private directory: string = ""
  private eventStream: AsyncIterator<any> | null = null
  private lastEventId: number = 0
  private processedEventIds: Set<string> = new Set()

  private constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "http://localhost:4096"
    this.directory = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()
    console.log(`[OpenCodeClient] Initializing with baseUrl: ${this.baseUrl}, directory: ${this.directory}`)
    
    try {
      this.sdk = createOpencodeClient({ 
        baseUrl: this.baseUrl,
        directory: this.directory,
      })
      console.log("[OpenCodeClient] SDK initialized successfully")
    } catch (error) {
      console.error("[OpenCodeClient] Failed to initialize SDK:", error)
      throw error
    }
  }

  setDirectory(directory: string): void {
    this.directory = directory
  }

  static getInstance(baseUrl?: string): OpenCodeClient {
    if (!OpenCodeClient.instance) {
      OpenCodeClient.instance = new OpenCodeClient(baseUrl)
    }
    return OpenCodeClient.instance
  }

  async createSession(options?: {
    title?: string
    directory?: string
    parentID?: string
  }): Promise<SessionInfo> {
    try {
      console.log("[OpenCodeClient] Creating session:", options)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Create session timeout after 30s")), 30000)
      )
      
      const createPromise = this.sdk.session.create(options || {})
      const response = await Promise.race([createPromise, timeoutPromise])
      
      console.log("[OpenCodeClient] Session create response received")
      console.log("[OpenCodeClient] Session create response:", response)
      
      // Handle different response formats
      let session
      if (response.data) {
        // response.data exists
        session = Array.isArray(response.data) ? response.data?.[0] : response.data
      } else if (response.body) {
        // Try response.body
        session = Array.isArray(response.body) ? response.body?.[0] : response.body
      } else if (response.id) {
        // Response is directly the session
        session = response
      } else {
        // Try to find session in any property that has an id
        for (const key in response) {
          const value = (response as any)[key]
          if (value && ((typeof value === 'object' && value.id) || (Array.isArray(value) && value[0]?.id))) {
            session = Array.isArray(value) ? value[0] : value
            break
          }
        }
      }
      
      if (!session || !session.id) {
        console.error("[OpenCodeClient] Raw response:", JSON.stringify(response, null, 2))
        throw new Error("Failed to create session: no session data returned")
      }
      
      console.log("[OpenCodeClient] Session created:", session)
      return this.normalizeSessionInfo(session)
    } catch (error) {
      console.error("[OpenCodeClient] Create session error:", error)
      this.handleError(error, "Failed to create session")
      throw error
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    try {
      console.log("[OpenCodeClient] Listing sessions")
      const response = await this.sdk.session.list()
      console.log("[OpenCodeClient] List sessions response:", response)
      
      let sessions = response.data || response.body || []
      
      // Handle different formats
      if (!Array.isArray(sessions)) {
        if (Array.isArray(sessions.sessions) || Array.isArray(sessions.data)) {
          sessions = sessions.sessions || sessions.data
        } else {
          // Single session object
          sessions = [sessions]
        }
      }
      
      console.log(`[OpenCodeClient] Got ${sessions.length} sessions`)
      return sessions.map((s: any) => this.normalizeSessionInfo(s))
    } catch (error) {
      console.error("[OpenCodeClient] Failed to list sessions:", error)
      throw error
    }
  }

  async getSession(id: string): Promise<SessionInfo> {
    try {
      console.log("[OpenCodeClient] Getting session:", id)
      const response = await this.sdk.session.get({ sessionID: id })
      console.log("[OpenCodeClient] Get session response:", response)
      
      let session = response.data?.[0] || response.body?.[0] || response.data || response
      
      if (!session || !session.id) {
        throw new Error(`Session ${id} not found`)
      }
      return this.normalizeSessionInfo(session)
    } catch (error) {
      console.error("[OpenCodeClient] Failed to get session:", error)
      throw error
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      console.log("[OpenCodeClient] Deleting session:", id)
      await this.sdk.session.delete({ sessionID: id })
    } catch (error) {
      this.handleError(error, `Failed to delete session ${id}`)
      throw error
    }
  }

  async prompt(sessionID: string, options: PromptOptions): Promise<void> {
    console.log("[OpenCodeClient] Sending prompt to session:", sessionID)
    console.log("[OpenCodeClient] Prompt options:", JSON.stringify({
      agent: options.agent,
      model: options.model,
      partsCount: options.parts?.length
    }, null, 2))
    
    for (let i = 0; i < this.retries; i++) {
      try {
        console.log(`[OpenCodeClient] Prompt attempt ${i + 1}`)
        const result = await this.sdk.session.prompt({
          sessionID,
          agent: options.agent,
          model: options.model,
          parts: options.parts
        })
        console.log("[OpenCodeClient] Prompt sent successfully. Response:", result)
        return
      } catch (error) {
        console.error(`[OpenCodeClient] Prompt attempt ${i + 1} failed:`, error)
        if (i === this.retries - 1) {
          console.error("[OpenCodeClient] All retry attempts exhausted")
          throw error
        }
        await this.backoff(i)
      }
    }
  }

  async forkSession(id: string, messageID?: string): Promise<SessionInfo> {
    try {
      console.log("[OpenCodeClient] Forking session:", id, "at message:", messageID)
      const response = await this.sdk.session.fork({ sessionID: id, messageID })
      const session = response.data?.[0]
      if (!session) {
        throw new Error(`Failed to fork session ${id}`)
      }
      return this.normalizeSessionInfo(session)
    } catch (error) {
      this.handleError(error, `Failed to fork session ${id}`)
      throw error
    }
  }

  async subscribeEvents(): Promise<AsyncIterable<BusEvent>> {
    console.log("[OpenCodeClient] Subscribing to events")
    const { stream } = await this.sdk.event.subscribe()
    return stream as AsyncIterable<BusEvent>
  }

  startPolling(pollIntervalMs: number = 1000): void {
    if (this.isPolling) {
      console.log("[OpenCodeClient] Polling already running")
      return
    }
    
    this.isPolling = true
    console.log("[OpenCodeClient] Starting event polling...")
    
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollEvents()
      } catch (error) {
        console.error("[OpenCodeClient] Polling error:", error)
      }
    }, pollIntervalMs)
  }

  stopPolling(): void {
    if (!this.isPolling) return
    
    this.isPolling = false
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    if (this.eventStream) {
      try {
        this.eventStream.return?.(undefined)
      } catch (e) {
        console.warn("[OpenCodeClient] Error closing stream:", e)
      }
      this.eventStream = null
    }
    this.processedEventIds.clear()
    console.log("[OpenCodeClient] Stopped event polling")
  }

  async pollEvents(): Promise<void> {
    try {
      if (!this.eventStream) {
        const { stream } = await this.sdk.event.subscribe()
        this.eventStream = stream[Symbol.asyncIterator]?.() || stream
        console.log("[OpenCodeClient] Created new event stream")
      }
      
      let eventCount = 0
      const maxEvents = 10
      
      while (eventCount < maxEvents && this.isPolling) {
        try {
          const { done, value: event } = await this.eventStream.next()
          
          if (done) {
            console.log("[OpenCodeClient] Stream ended, recreating...")
            this.eventStream = null
            break
          }
          
          eventCount++
          const eventType = event?.type || event?.data?.type || "unknown"
          
          // Generate event ID for deduplication
          const eventId = `${eventType}-${event?.data?.messageID || event?.data?.id || this.lastEventId}-${Date.now()}`
          
          console.log(`[OpenCodeClient] Got event (${eventCount}):`, eventType, `ID: ${eventId.substring(0, 30)}...`)
          
          // Skip duplicate events
          if (this.processedEventIds.has(eventId)) {
            console.log("[OpenCodeClient] Skipping duplicate event")
            continue
          }
          this.processedEventIds.add(eventId)
          
          // Keep the set size manageable
          if (this.processedEventIds.size > 1000) {
            const toDelete = Array.from(this.processedEventIds).slice(0, 500)
            toDelete.forEach(id => this.processedEventIds.delete(id))
          }
          
          // Skip server.connected events after the first one
          if (eventType === "server.connected" && this.lastEventId > 0) {
            console.log("[OpenCodeClient] Skipping server.connected event")
            continue
          }
          
          this.lastEventId++
          
          const eventData = {
            type: event?.type || "unknown",
            data: event?.data || event
          }
          
          this.notifyListeners({
            type: eventData.type,
            data: eventData.data
          })
        } catch (e) {
          if (e.name === ' AbortError') {
            console.log("[OpenCodeClient] Stream aborted")
            break
          }
          console.error("[OpenCodeClient] Error reading from stream:", e)
          this.eventStream = null
          break
        }
      }
    } catch (error) {
      console.error("[OpenCodeClient] Failed to poll events via SDK:", error)
      this.eventStream = null
    }
  }

  async checkServerAvailable(): Promise<boolean> {
    try {
      const response = await this.sdk.global.health()
      console.log("[OpenCodeClient] Server is available")
      return true
    } catch (error) {
      console.error("[OpenCodeClient] Server not available:", error)
      return false
    }
  }

  async getServerStatus(): Promise<{
    version: string
    agents: string[]
    providers: string[]
    models: Array<{ providerID: string; models: string[] }>
  }> {
    console.log("[OpenCodeClient] Getting server status")
    try {
      const healthResponse = await this.sdk.global.health()
      console.log("[OpenCodeClient] Health response:", healthResponse)
      const data = (healthResponse as any).data
      
      const result = {
        version: data?.version || "unknown",
        agents: data?.agents || [],
        providers: data?.providers || [],
        models: data?.models || []
      }
      console.log("[OpenCodeClient] Server status:", result)
      return result
    } catch (error) {
      console.error("[OpenCodeClient] SDK health endpoint failed:", error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
        return {
          version: "unknown",
          agents: [],
          providers: [],
          models: []
        }
      }
      
      throw new Error(`Failed to connect to OpenCode server: ${errorMessage}`)
    }
  }

  async getModels(): Promise<Array<{ providerID: string; models: string[] }>> {
    console.log("[OpenCodeClient] Getting models")
    try {
      const response = await this.sdk.config.providers({ directory: this.directory })
      console.log("[OpenCodeClient] Providers response:", response)

      let providers: any[] = []
      
      if (Array.isArray(response)) {
        providers = response
      } else if ((response as any).data && Array.isArray((response as any).data)) {
        providers = (response as any).data
      } else if ((response as any).data && Array.isArray((response as any).data.providers)) {
        providers = (response as any).data.providers
      } else if ((response as any).providers && Array.isArray((response as any).providers)) {
        providers = (response as any).providers
      }
      
      console.log("[OpenCodeClient] Providers count:", providers.length)

      const models = providers
        .filter((p: any) => p.models && Object.keys(p.models).length > 0)
        .map((p: any) => ({
          providerID: p.id || p.name || "unknown",
          models: Object.keys(p.models)
        }))

      console.log("[OpenCodeClient] Loaded models:", models)
      return models
    } catch (error) {
      console.error("[OpenCodeClient] Failed to load models:", error)
      const models: Array<{ providerID: string; models: string[] }> = []
      return models
    }
  }

  async getSessionMessages(id: string): Promise<any[]> {
    try {
      console.log("[OpenCodeClient] Getting messages for session:", id)
      const response = await this.sdk.session.messages({ sessionID: id })
      
      // Handle different response formats based on sdk.gen.ts (SessionMessagesResponses)
      const rawMessages = response.data || response.body || response || []
      console.log(`[OpenCodeClient] Got ${Array.isArray(rawMessages) ? rawMessages.length : 0} raw messages`)
      
      // Flatten the response format: { info: Message, parts: Array<Part> } -> { id, role, parts, ... }
      const messages = Array.isArray(rawMessages) ? rawMessages.map((msg: any) => {
        const info = msg.info || msg
        return {
          id: info.id,
          role: info.role,
          sessionID: info.sessionID,
          parts: msg.parts || [],
          time: info.time
        }
      }) : []
      
      console.log(`[OpenCodeClient] Processed ${messages.length} flattened messages`)
      return messages
    } catch (error) {
      console.error("[OpenCodeClient] Failed to get session messages:", error)
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
    console.error(`[OpenCodeClient] ${message}:`, errorMessage)
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`)
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.pow(2, attempt) * 1000
    console.log(`[OpenCodeClient] Backing off for ${delay}ms`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  addEventListener(listener: (event: BusEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  private notifyListeners(event: BusEvent): void {
    console.log(`[OpenCodeClient] Notifying ${this.eventListeners.size} listeners:`, event.type)
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        console.error("[OpenCodeClient] Event listener error:", error)
      }
    }
  }

  dispose(): void {
    this.stopPolling()
    this.eventListeners.clear()
  }
}

export function getOpenCodeClient(baseUrl?: string): OpenCodeClient {
  return OpenCodeClient.getInstance(baseUrl)
}
