import * as vscode from "vscode"

export interface AgentInfo {
  id: string
  name: string
  description: string
  mode: "primary" | "subagent"
  color?: string
  temperature?: number
}

export class AgentSelector {
  private static instance: AgentSelector
  private availableAgents: Map<string, AgentInfo> = new Map()
  private client: any

  private constructor() {
    this.loadBuiltInAgents()
    this.client = null
  }

  static getInstance(): AgentSelector {
    if (!AgentSelector.instance) {
      AgentSelector.instance = new AgentSelector()
    }
    return AgentSelector.instance
  }

  setClient(client: any): void {
    this.client = client
  }

  private loadBuiltInAgents(): void {
    const agents: AgentInfo[] = [
      {
        id: "build",
        name: "Build Agent",
        description: "Full access for development tasks",
        mode: "primary",
        color: "#FF6B6B"
      },
      {
        id: "plan",
        name: "Plan Agent",
        description: "Read-only exploration and planning",
        mode: "primary",
        color: "#4ECDC4"
      },
      {
        id: "explore",
        name: "Explore Agent",
        description: "Codebase analysis and documentation",
        mode: "primary",
        color: "#45B7D1"
      },
      {
        id: "general",
        name: "General Agent",
        description: "Multi-step tasks and general assistance",
        mode: "subagent",
        color: "#96CEB4"
      },
      {
        id: "compaction",
        name: "Compaction Agent",
        description: "Message summary and cleanup",
        mode: "subagent"
      }
    ]

    agents.forEach((agent) => {
      this.availableAgents.set(agent.id, agent)
    })
  }

  async showAgentPicker(_sessionId?: string): Promise<string | undefined> {
    const items = Array.from(this.availableAgents.values()).map((agent) => ({
      label: agent.name,
      description: agent.description,
      detail: agent.mode === "primary" ? "Primary" : "Subagent",
      agentId: agent.id
    }))

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select an AI Agent",
      title: "Choose Agent"
    })

    if (selected) {
      vscode.window.showInformationMessage(`Selected: ${selected.label}`)

      return selected.agentId
    }

    return undefined
  }

  getAgentList(): AgentInfo[] {
    return Array.from(this.availableAgents.values())
  }

  async setAgent(sessionId: string, agentName: string): Promise<void> {
    if (!this.client) {
      throw new Error("OpenCodeClient not initialized")
    }

    vscode.window.showInformationMessage(`Agent set to: ${agentName}`)
  }

  getAgentInfo(agentId: string): AgentInfo | undefined {
    return this.availableAgents.get(agentId)
  }

  async loadAgentsFromServer(): Promise<void> {
    if (!this.client) return

    try {
      // TODO: Implement loading agents from server
    } catch (error) {
      console.error("Failed to load agents from server:", error)
    }
  }
}

export function getAgentSelector(): AgentSelector {
  return AgentSelector.getInstance()
}
