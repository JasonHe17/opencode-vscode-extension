import * as vscode from "vscode"

export interface AgentConfig {
  name: string
  description?: string
  mode: "primary" | "subagent"
  temperature?: number
  topP?: number
  prompt?: string
  systemInstructions?: string[]
  permission?: Record<string, any>
  model?: {
    providerID: string
    modelID: string
  }
}

export class AgentManager {
  private static instance: AgentManager
  private context: vscode.ExtensionContext
  private customAgents: Map<string, AgentConfig> = new Map()

  private constructor(context: vscode.ExtensionContext) {
    this.context = context
    this.loadCustomAgents()
  }

  static getInstance(context?: vscode.ExtensionContext): AgentManager {
    if (!AgentManager.instance && context) {
      AgentManager.instance = new AgentManager(context)
    }
    return AgentManager.instance
  }

  private loadCustomAgents(): void {
    const agents = this.context.globalState.get<Record<string, AgentConfig>>("opencode.customAgents")
    if (agents) {
      this.customAgents = new Map(Object.entries(agents))
    }
  }

  private async saveCustomAgents(): Promise<void> {
    const agents = Object.fromEntries(this.customAgents)
    await this.context.globalState.update("opencode.customAgents", agents)
  }

  async createAgent(config: AgentConfig): Promise<string> {
    const agentId = `custom_${Date.now()}`

    this.customAgents.set(agentId, config)
    await this.saveCustomAgents()

    vscode.window.showInformationMessage(`Agent "${config.name}" created`)
    return agentId
  }

  async updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<void> {
    const agent = this.customAgents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    Object.assign(agent, updates)
    await this.saveCustomAgents()

    vscode.window.showInformationMessage(`Agent "${agent.name}" updated`)
  }

  async deleteAgent(agentId: string): Promise<void> {
    const agent = this.customAgents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${agent.name}"?`,
      "Delete",
      "Cancel"
    )

    if (confirm !== "Delete") return

    this.customAgents.delete(agentId)
    await this.saveCustomAgents()

    vscode.window.showInformationMessage(`Agent "${agent.name}" deleted`)
  }

  getCustomAgents(): Map<string, AgentConfig> {
    return this.customAgents
  }

  async showAgentConfigUI(agentId?: string): Promise<void> {
    if (agentId) {
      await this.editAgent(agentId)
    } else {
      await this.createNewAgent()
    }
  }

  private async createNewAgent(): Promise<void> {
    const name = await vscode.window.showInputBox({
      placeHolder: "Enter agent name",
      prompt: "Name of the new agent"
    })

    if (!name) return

    const description = await vscode.window.showInputBox({
      placeHolder: "Enter agent description",
      prompt: "What does this agent do?"
    })

    const mode = await vscode.window.showQuickPick(
      [
        { label: "Primary", description: "Main agent for interactions" },
        { label: "Subagent", description: "Helper for specific tasks" }
      ],
      { placeHolder: "Select agent mode" }
    )

    if (!mode) return

    const config: AgentConfig = {
      name,
      description,
      mode: mode.label.toLowerCase() as "primary" | "subagent"
    }

    await this.createAgent(config)
  }

  private async editAgent(agentId: string): Promise<void> {
    const agent = this.customAgents.get(agentId)
    if (!agent) return

    const action = await vscode.window.showQuickPick(
      ["Edit Name", "Edit Description", "Edit Prompt", "Delete"],
      { placeHolder: "What do you want to do?" }
    )

    switch (action) {
      case "Edit Name": {
        const name = await vscode.window.showInputBox({
          value: agent.name,
          prompt: "Enter new name"
        })
        if (name) await this.updateAgent(agentId, { name })
        break
      }

      case "Edit Description": {
        const description = await vscode.window.showInputBox({
          value: agent.description || "",
          prompt: "Enter new description"
        })
        if (description !== undefined) await this.updateAgent(agentId, { description })
        break
      }

      case "Edit Prompt": {
        const prompt = await vscode.window.showInputBox({
          value: agent.prompt || "",
          prompt: "Enter system prompt"
        })
        if (prompt !== undefined) await this.updateAgent(agentId, { prompt })
        break
      }

      case "Delete":
        await this.deleteAgent(agentId)
        break
    }
  }
}

export function getAgentManager(context?: vscode.ExtensionContext): AgentManager {
  return AgentManager.getInstance(context)
}
