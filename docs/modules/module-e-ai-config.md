# Module E: AI配置管理 (AI Configuration)

## 概述
本模块负责AI Agent和Provider/Model的选择与配置。提供快速选择对话框和详细的模型配置界面。

**Phase**: 2
**依赖**: Module A (OpenCodeClient)
**可以并行开发**: Module B, Module F
**后续依赖**: Module H (main.ts), Module C (ChatPanel)

---

## 文件所有权

```
extension/src/agent/
├── AgentSelector.ts            [此模块独有]
└── AgentManager.ts             [此模块独有]

extension/src/provider/
├── ProviderSelector.ts         [此模块独有]
└── ModelConfig.ts              [此模块独有]
```

---

## 任务列表

### Task 1: AgentSelector.ts
**文件**: `extension/src/agent/AgentSelector.ts`

**职责**: 提供快速选择Agent的对话框

**接口定义**:

```typescript
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
  private client: any // OpenCodeClient

  private constructor() {
    this.loadBuiltInAgents()
    this.client = null // 将在main.ts中注入
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

  /**
   * 加载内置Agent
   */
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

  /**
   * 显示Agent快速选择对话框
   */
  async showAgentPicker(sessionId?: string): Promise<string | undefined> {
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

      // TODO: 如果有sessionId，更新会话的agent
      // await this.client.updateSessionAgent(sessionId, selected.agentId)

      return selected.agentId
    }

    return undefined
  }

  /**
   * 获取可用Agent列表
   */
  getAgentList(): AgentInfo[] {
    return Array.from(this.availableAgents.values())
  }

  /**
   * 设置会话的Agent
   */
  async setAgent(sessionId: string, agentName: string): Promise<void> {
    if (!this.client) {
      throw new Error("OpenCodeClient not initialized")
    }

    // TODO: 通过API更新会话的agent
    // await this.client.updateSession(sessionId, { agent: agentName })

    vscode.window.showInformationMessage(`Agent set to: ${agentName}`)
  }

  /**
   * 获取Agent详情
   */
  getAgentInfo(agentId: string): AgentInfo | undefined {
    return this.availableAgents.get(agentId)
  }

  /**
   * 从服务器加载最新Agent列表
   */
  async loadAgentsFromServer(): Promise<void> {
    if (!this.client) return

    try {
      // TODO: 从服务器获取agent列表
      // const response = await this.client.getServerStatus()
      // const serverAgents = response.agents

      // 合并内置Agent和服务器自定义Agent
    } catch (error) {
      console.error("Failed to load agents from server:", error)
    }
  }
}

export function getAgentSelector(): AgentSelector {
  return AgentSelector.getInstance()
}
```

---

### Task 2: AgentManager.ts
**文件**: `extension/src/agent/AgentManager.ts`

**职责**: 管理自定义Agent的创建、更新和删除

**接口定义**:

```typescript
import * as vscode from "vscode"
import { AgentInfo } from "./AgentSelector"

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

  /**
   * 加载自定义Agent
   */
  private loadCustomAgents(): void {
    const agents = this.context.globalState.get<Record<string, AgentConfig>>("opencode.customAgents")
    if (agents) {
      this.customAgents = new Map(Object.entries(agents))
    }
  }

  /**
   * 保存自定义Agent
   */
  private async saveCustomAgents(): Promise<void> {
    const agents = Object.fromEntries(this.customAgents)
    await this.context.globalState.update("opencode.customAgents", agents)
  }

  /**
   * 创建新Agent
   */
  async createAgent(config: AgentConfig): Promise<string> {
    const agentId = `custom_${Date.now()}`

    this.customAgents.set(agentId, config)
    await this.saveCustomAgents()

    vscode.window.showInformationMessage(`Agent "${config.name}" created`)
    return agentId
  }

  /**
   * 更新Agent
   */
  async updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<void> {
    const agent = this.customAgents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    Object.assign(agent, updates)
    await this.saveCustomAgents()

    vscode.window.showInformationMessage(`Agent "${agent.name}" updated`)
  }

  /**
   * 删除Agent
   */
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

  /**
   * 获取所有自定义Agent
   */
  getCustomAgents(): Map<string, AgentConfig> {
    return this.customAgents
  }

  /**
   * 显示Agent配置UI
   */
  async showAgentConfigUI(agentId?: string): Promise<void> {
    if (agentId) {
      // 编辑现有Agent
      await this.editAgent(agentId)
    } else {
      // 创建新Agent
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
      case "Edit Name":
        const name = await vscode.window.showInputBox({
          value: agent.name,
          prompt: "Enter new name"
        })
        if (name) await this.updateAgent(agentId, { name })
        break

      case "Edit Description":
        const description = await vscode.window.showInputBox({
          value: agent.description || "",
          prompt: "Enter new description"
        })
        if (description !== undefined) await this.updateAgent(agentId, { description })
        break

      case "Edit Prompt":
        const prompt = await vscode.window.showInputBox({
          value: agent.prompt || "",
          prompt: "Enter system prompt",
          multiline: true
        })
        if (prompt !== undefined) await this.updateAgent(agentId, { prompt })
        break

      case "Delete":
        await this.deleteAgent(agentId)
        break
    }
  }
}

export function getAgentManager(context?: vscode.ExtensionContext): AgentManager {
  return AgentManager.getInstance(context)
}
```

---

### Task 3: ProviderSelector.ts
**文件**: `extension/src/provider/ProviderSelector.ts`

**职责**: 提供Provider和Model的选择对话框

**接口定义**:

```typescript
import * as vscode from "vscode"

export interface ProviderInfo {
  id: string
  name: string
  models: ModelInfo[]
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
  inputPrice?: number
  outputPrice?: number
  capabilities?: string[]
}

export class ProviderSelector {
  private static instance: ProviderSelector
  private providers: Map<string, ProviderInfo> = new Map()
  private client: any

  private constructor() {
    this.loadBuiltInProviders()
  }

  static getInstance(): ProviderSelector {
    if (!ProviderSelector.instance) {
      ProviderSelector.instance = new ProviderSelector()
    }
    return ProviderSelector.instance
  }

  setClient(client: any): void {
    this.client = client
  }

  /**
   * 加载内置Provider
   */
  private loadBuiltInProviders(): void {
    const providers: ProviderInfo[] = [
      {
        id: "openai",
        name: "OpenAI",
        models: [
          { id: "gpt-4o", name: "GPT-4 Omni", contextWindow: 128000 },
          { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000 },
          { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16385 }
        ]
      },
      {
        id: "anthropic",
        name: "Anthropic",
        models: [
          { id: "claude-3-opus", name: "Claude 3 Opus", contextWindow: 200000 },
          { id: "claude-3-sonnet", name: "Claude 3 Sonnet", contextWindow: 200000 },
          { id: "claude-3-haiku", name: "Claude 3 Haiku", contextWindow: 200000 }
        ]
      },
      {
        id: "google",
        name: "Google",
        models: [
          { id: "gemini-pro", name: "Gemini Pro", contextWindow: 91728 },
          { id: "gemini-ultra", name: "Gemini Ultra", contextWindow: 1000000 }
        ]
      }
    ]

    providers.forEach((provider) => {
      this.providers.set(provider.id, provider)
    })
  }

  /**
   * 显示Provider选择对话框
   */
  async showProviderPicker(sessionId?: string): Promise<string | undefined> {
    const items = Array.from(this.providers.values()).map((p) => ({
      label: p.name,
      description: `${p.models.length} models available`,
      detail: "",
      providerId: p.id
    }))

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select an AI Provider",
      title: "Choose Provider"
    })

    if (selected) {
      viewController.window.showInformationMessage(`Selected: ${selected.label}`)
      return selected.providerId
    }

    return undefined
  }

  /**
   * 显示Model选择对话框
   */
  async showModelPicker(providerID: string, sessionId?: string): Promise<string | undefined> {
    const provider = this.providers.get(providerID)
    if (!provider) {
      vscode.window.showErrorMessage(`Provider ${providerID} not found`)
      return undefined
    }

    const items = provider.models.map((model) => ({
      label: model.name,
      description: model.contextWindow
        ? `${(model.contextWindow / 1000).toFixed(0)}k context window`
        : "",
      detail: "",
      modelId: model.id
    }))

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select a model from ${provider.name}`,
      title: "Choose Model"
    })

    if (selected) {
      const modelDetail: { providerID: string; modelID: string } = {
        providerID,
        modelID: selected.modelId
      }

      // TODO: 如果有sessionId，更新会话的model
      // await this.client.updateSessionModel(sessionId, modelDetail)

      vscode.window.showInformationMessage(`Selected: ${selected.label}`)
      return selected.modelId
    }

    return undefined
  }

  /**
   * 获取指定Provider的模型列表
   */
  getModelList(providerID: string): ModelInfo[] {
    const provider = this.providers.get(providerID)
    return provider?.models || []
  }

  /**
   * 设置会话的Model
   */
  async setModel(
    sessionId: string,
    model: { providerID: string; modelID: string }
  ): Promise<void> {
    if (!this.client) {
      throw new Error("OpenCodeClient not initialized")
    }

    // TODO: 通过API更新会话的model
    // await this.client.updateSession(sessionId, { model })

    vscode.window.showInformationMessage(
      `Model set to: ${model.providerID}/${model.modelID}`
    )
  }

  /**
   * 获取所有Provider列表
   */
  getProviders(): ProviderInfo[] {
    return Array.from(this.providers.values())
  }

  /**
   * 从服务器加载最新Provider列表
   */
  async loadProvidersFromServer(): Promise<void> {
    if (!this.client) return

    try {
      // TODO: 从服务器获取provider列表
      // const response = await this.client.getServerStatus()
      // const serverProviders = response.providers
    } catch (error) {
      console.error("Failed to load providers from server:", error)
    }
  }
}

export function getProviderSelector(): ProviderSelector {
  return ProviderSelector.getInstance()
}
```

---

### Task 4: ModelConfig.ts
**文件**: `extension/src/provider/ModelConfig.ts`

**职责**: 显示和编辑模型参数配置

**接口定义**:

```typescript
import * as vscode from "vscode"

export interface ModelOptions {
  temperature?: number
  topP?: number
  maxTokens?: number
  timeout?: number
  systemPrompt?: string
}

export class ModelConfig {
  private static instance: ModelConfig
  private context: vscode.ExtensionContext
  private configs: Map<string, ModelOptions> = new Map()

  private constructor(context: vscode.ExtensionContext) {
    this.context = context
    this.loadConfigs()
  }

  static getInstance(context?: vscode.ExtensionContext): ModelConfig {
    if (!ModelConfig.instance && context) {
      ModelConfig.instance = new ModelConfig(context)
    }
    return ModelConfig.instance
  }

  /**
   * 加载模型配置
   */
  private loadConfigs(): void {
    const configs = this.context.globalState.get<
      Record<string, ModelOptions>
    >("opencode.modelConfigs")
    if (configs) {
      this.configs = new Map(Object.entries(configs))
    }
  }

  /**
   * 保存模型配置
   */
  private async saveConfigs(): Promise<void> {
    const configs = Object.fromEntries(this.configs)
    await this.context.globalState.update("opencode.modelConfigs", configs)
  }

  /**
   * 显示模型配置UI
   */
  async showModelConfig(providerID: string, modelID: string): Promise<void> {
    const configKey = `${providerID}:${modelID}`
    const currentConfig = this.configs.get(configKey) || {}

    const action = await vscode.window.showQuickPick(
      [
        "Temperature",
        "Top P",
        "Max Tokens",
        "Timeout",
        "System Prompt",
        "Reset to Default"
      ],
      { placeHolder: "Select option to configure" }
    )

    switch (action) {
      case "Temperature":
        const temperature = await vscode.window.showInputBox({
            value: String(currentConfig.temperature ?? 0.7),
            placeHolder: "0.0 - 2.0",
            prompt: "Temperature (lower = more focused, higher = more creative)"
          })

        if (temperature !== undefined) {
          const value = parseFloat(temperature)
          if (!isNaN(value) && value >= 0 && value <= 2) {
            await this.updateModelOptions(configKey, { temperature: value })
          } else {
            vscode.window.showErrorMessage("Invalid temperature value")
          }
        }
        break

      case "Top P":
        const topP = await vscode.window.showInputBox({
          value: String(currentConfig.topP ?? 1.0),
          placeHolder: "0.0 - 1.0",
          prompt: "Top P (nucleus sampling)"
        })

        if (topP !== undefined) {
          const value = parseFloat(topP)
          if (!isNaN(value) && value >= 0 && value <= 1) {
            await this.updateModelOptions(configKey, { topP: value })
          } else {
            vscode.window.showErrorMessage("Invalid topP value")
          }
        }
        break

      case "Max Tokens":
        const maxTokens = await vscode.window.showInputBox({
          value: String(currentConfig.maxTokens ?? 4096),
          placeHolder: "1 - 100000",
          prompt: "Maximum tokens to generate"
        })

        if (maxTokens !== undefined) {
          const value = parseInt(maxTokens)
          if (!isNaN(value) && value > 0) {
            await this.updateModelOptions(configKey, { maxTokens: value })
          } else {
            vscode.window.showErrorMessage("Invalid maxTokens value")
          }
        }
        break

      case "Timeout":
        const timeout = await vscode.window.showInputBox({
          value: String(currentConfig.timeout ?? 120),
          placeHolder: "Seconds",
          prompt: "Request timeout in seconds"
        })

        if (timeout !== undefined) {
          const value = parseInt(timeout)
          if (!isNaN(value) && value > 0) {
            await this.updateModelOptions(configKey, { timeout: value })
          } else {
            vscode.window.showErrorMessage("Invalid timeout value")
          }
        }
        break

      case "System Prompt":
        const systemPrompt = await vscode.window.showInputBox({
          value: currentConfig.systemPrompt ?? "",
          prompt: "Custom system prompt for this model",
          multiline: true
        })

        if (systemPrompt !== undefined) {
          await this.updateModelOptions(configKey, { systemPrompt })
        }
        break

      case "Reset to Default":
        this.configs.delete(configKey)
        await this.saveConfigs()
        vscode.window.showInformationMessage("Configuration reset to default")
        break
    }
  }

  /**
   * 更新模型选项
   */
  async updateModelOptions(
    providerID: string,
    modelID: string,
    options: Partial<ModelOptions>
  ): Promise<void> {
    const configKey = `${providerID}:${modelID}`
    await this.updateModelOptions(configKey, options)
  }

  private async updateModelOptions(
    configKey: string,
    options: Partial<ModelOptions>
  ): Promise<void> {
    const current = this.configs.get(configKey) || {}
    this.configs.set(configKey, { ...current, ...options })
    await this.saveConfigs()
    vscode.window.showInformationMessage("Configuration saved")
  }

  /**
   * 获取模型配置
   */
  getModelConfig(providerID: string, modelID: string): ModelOptions {
    const configKey = `${providerID}:${modelID}`
    return this.configs.get(configKey) || {}
  }
}

export function getModelConfig(context?: vscode.ExtensionContext): ModelConfig {
  return ModelConfig.getInstance(context)
}
```

---

## 测试清单

```bash
cd extension
bun install

# 类型检查
bun run check-types

# 语法检查
bun run lint
```

---

## 与其他模块的接口

### 提供:
1. `AgentSelector` - 用于Module H (main.ts), Module C (ChatPanel)
2. `AgentManager` - 用于Module H (main.ts)
3. `ProviderSelector` - 用于Module H (main.ts), Module C (ChatPanel)
4. `ModelConfig` - 用于Module H (main.ts)

### 依赖:
- Module A: `OpenCodeClient` - 调用API获取会话/Agent信息
- `vscode` - VS Code API

---

## 完成 Checklist

- [ ] AgentSelector.ts 实现Agent快速选择
- [ ] AgentManager.ts 实现Agent配置管理
- [ ] ProviderSelector.ts 实现Provider/Model选择
- [ ] ModelConfig.ts 实现模型选项配置
- [ ] 所有文件通过 `bun run test && bun run check-types`
- [ ] 准备交付Module H

---

## 注意事项

1. **单例模式**: 所有Selector和Manager使用单例
2. **延迟注入**: client在main.ts中注入，避免循环依赖
3. **配置持久化**: 使用globalState保存自定义Agent和模型配置
4. **类型安全**: 定义清晰的接口（AgentInfo, ProviderInfo, ModelInfo）
5. **用户体验**: 使用QuickPick提供流畅的配置界面
