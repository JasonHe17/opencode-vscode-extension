import type { BusEvent } from "./types.js"

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

    this.eventSource.onerror = (_error) => {
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
