import * as vscode from "vscode"

export interface ExtensionState {
  activeSessionId?: string
  serverMode?: "auto" | "remote" | "embedded"
  serverBaseUrl?: string
  defaultAgent?: string
  defaultProvider?: string
  lastUsedModel?: { providerID: string; modelID: string }
  historyLimit?: number
  [key: string]: any
}

export class ExtensionConfig {
  private static instance: ExtensionConfig
  private state: ExtensionState = {}

  private constructor(private context: vscode.ExtensionContext) {
    this.loadConfig()
  }

  static getInstance(context?: vscode.ExtensionContext): ExtensionConfig {
    if (!ExtensionConfig.instance && context) {
      ExtensionConfig.instance = new ExtensionConfig(context)
    }
    return ExtensionConfig.instance
  }

  private loadConfig(): void {
    this.state = this.context.globalState.get<ExtensionState>("opencode.state") || {}
  }

  async saveConfig(): Promise<void> {
    await this.context.globalState.update("opencode.state", this.state)
  }

  get<K extends keyof ExtensionState>(key: K): ExtensionState[K] {
    return this.state[key]
  }

  async set<K extends keyof ExtensionState>(
    key: K,
    value: ExtensionState[K]
  ): Promise<void> {
    this.state[key] = value
    await this.saveConfig()
  }

  getAll(): ExtensionState {
    return { ...this.state }
  }

  async clear(): Promise<void> {
    this.state = {}
    await this.saveConfig()
  }
}

export function getExtensionConfig(context: vscode.ExtensionContext): ExtensionConfig {
  return ExtensionConfig.getInstance(context)
}
