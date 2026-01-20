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
  content?: unknown
  text?: string
  state?: "pending" | "running" | "completed" | "error"
  output?: string
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
