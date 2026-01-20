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

  private loadBuiltInProviders(): void {
    // Empty, we load from server
  }

  async showProviderPicker(_sessionId?: string): Promise<string | undefined> {
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
      vscode.window.showInformationMessage(`Selected: ${selected.label}`)
      return selected.providerId
    }

    return undefined
  }

  async showModelPicker(providerID: string, _sessionId?: string): Promise<string | undefined> {
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
      void { providerID, modelID: selected.modelId }
      vscode.window.showInformationMessage(`Selected: ${selected.label}`)
      return selected.modelId
    }

    return undefined
  }

  getModelList(providerID: string): ModelInfo[] {
    const provider = this.providers.get(providerID)
    return provider?.models || []
  }

  async setModel(
    sessionId: string,
    model: { providerID: string; modelID: string }
  ): Promise<void> {
    if (!this.client) {
      throw new Error("OpenCodeClient not initialized")
    }

    vscode.window.showInformationMessage(
      `Model set to: ${model.providerID}/${model.modelID}`
    )
  }

  getProviders(): ProviderInfo[] {
    return Array.from(this.providers.values())
  }

  async loadProvidersFromServer(): Promise<void> {
    if (!this.client) return

    try {
      const models = await this.client.getModels()
      this.providers.clear()
      for (const p of models) {
        this.providers.set(p.providerID, {
          id: p.providerID,
          name: p.providerID,
          models: p.models.map((m: string) => ({ id: m, name: m }))
        })
      }
    } catch (error) {
      console.error("Failed to load providers from server:", error)
    }
  }
}

export function getProviderSelector(): ProviderSelector {
  return ProviderSelector.getInstance()
}
