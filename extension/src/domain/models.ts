export interface Session {
  id: string
  title: string
  agent: string
  directory: string
  createdAt: number
  updatedAt: number
  status: "active" | "idle" | "archived"
}

export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  parts: MessagePart[]
  timestamp: number
  sessionId: string
}

export interface MessagePart {
  id: string
  type: "text" | "tool" | "reasoning" | "file"
  content?: any
  text?: string
  tool?: string
  state?: "pending" | "running" | "completed" | "error"
}

export interface ToolState {
  id: string
  name: string
  state: "pending" | "running" | "completed" | "error"
  input?: any
  output?: any
  error?: string
}
