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
  id: string
  type: "text" | "tool" | "reasoning" | "file" | "compaction"
  content?: unknown
  text?: string
  synthetic?: boolean
  ignored?: boolean
  state?: {
    status: "pending" | "running" | "completed" | "error"
    input?: any
    output?: any
    metadata?: any
    error?: string
  }
  tool?: string
  callID?: string
  filename?: string
  mime?: string
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
  parts: any[]
}
