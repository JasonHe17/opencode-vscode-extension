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

  private loadConfigs(): void {
    const configs = this.context.globalState.get<
      Record<string, ModelOptions>
    >("opencode.modelConfigs")
    if (configs) {
      this.configs = new Map(Object.entries(configs))
    }
  }

  private async saveConfigs(): Promise<void> {
    const configs = Object.fromEntries(this.configs)
    await this.context.globalState.update("opencode.modelConfigs", configs)
  }

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
      case "Temperature": {
        const temperature = await vscode.window.showInputBox({
            value: String(currentConfig.temperature ?? 0.7),
            placeHolder: "0.0 - 2.0",
            prompt: "Temperature (lower = more focused, higher = more creative)"
          })

        if (temperature !== undefined) {
          const value = parseFloat(temperature)
          if (!isNaN(value) && value >= 0 && value <= 2) {
            await this.updateModelOptions(providerID, modelID, { temperature: value })
          } else {
            vscode.window.showErrorMessage("Invalid temperature value")
          }
        }
        break
      }

      case "Top P": {
        const topP = await vscode.window.showInputBox({
          value: String(currentConfig.topP ?? 1.0),
          placeHolder: "0.0 - 1.0",
          prompt: "Top P (nucleus sampling)"
        })

        if (topP !== undefined) {
          const value = parseFloat(topP)
          if (!isNaN(value) && value >= 0 && value <= 1) {
            await this.updateModelOptions(providerID, modelID, { topP: value })
          } else {
            vscode.window.showErrorMessage("Invalid topP value")
          }
        }
        break
      }

      case "Max Tokens": {
        const maxTokens = await vscode.window.showInputBox({
          value: String(currentConfig.maxTokens ?? 4096),
          placeHolder: "1 - 100000",
          prompt: "Maximum tokens to generate"
        })

        if (maxTokens !== undefined) {
          const value = parseInt(maxTokens)
          if (!isNaN(value) && value > 0) {
            await this.updateModelOptions(providerID, modelID, { maxTokens: value })
          } else {
            vscode.window.showErrorMessage("Invalid maxTokens value")
          }
        }
        break
      }

      case "Timeout": {
        const timeout = await vscode.window.showInputBox({
          value: String(currentConfig.timeout ?? 120),
          placeHolder: "Seconds",
          prompt: "Request timeout in seconds"
        })

        if (timeout !== undefined) {
          const value = parseInt(timeout)
          if (!isNaN(value) && value > 0) {
            await this.updateModelOptions(providerID, modelID, { timeout: value })
          } else {
            vscode.window.showErrorMessage("Invalid timeout value")
          }
        }
        break
      }

      case "System Prompt": {
        const systemPrompt = await vscode.window.showInputBox({
          value: currentConfig.systemPrompt ?? "",
          prompt: "Custom system prompt for this model"
        })

        if (systemPrompt !== undefined) {
          await this.updateModelOptions(providerID, modelID, { systemPrompt })
        }
        break
      }

      case "Reset to Default":
        this.configs.delete(configKey)
        await this.saveConfigs()
        vscode.window.showInformationMessage("Configuration reset to default")
        break
    }
  }

  async updateModelOptions(
    providerID: string,
    modelID: string,
    options: Partial<ModelOptions>
  ): Promise<void> {
    const configKey = `${providerID}:${modelID}`
    const current = this.configs.get(configKey) || {}
    this.configs.set(configKey, { ...current, ...options })
    await this.saveConfigs()
    vscode.window.showInformationMessage("Configuration saved")
  }

  getModelConfig(providerID: string, modelID: string): ModelOptions {
    const configKey = `${providerID}:${modelID}`
    return this.configs.get(configKey) || {}
  }
}

export function getModelConfig(context?: vscode.ExtensionContext): ModelConfig {
  return ModelConfig.getInstance(context)
}
