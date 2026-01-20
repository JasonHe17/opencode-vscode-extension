import * as vscode from "vscode"

export type ConfigKey =
  | "opencode.server.mode"
  | "opencode.server.baseUrl"
  | "opencode.server.autoStart"
  | "opencode.defaultAgent"
  | "opencode.chat.showToolOutput"

export class SettingsManager {
  private config: vscode.WorkspaceConfiguration

  constructor() {
    this.config = vscode.workspace.getConfiguration("opencode")
  }

  get<T = any>(key: ConfigKey, defaultValue?: T): T {
    return this.config.get<T>(key, defaultValue as T)
  }

  async set<T = any>(key: ConfigKey, value: T): Promise<void> {
    await this.config.update(key, value, vscode.ConfigurationTarget.Global)
  }

  watch<T = any>(key: ConfigKey, callback: (value: T) => void): vscode.Disposable {
    const listener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`opencode.${key}`)) {
        callback(this.get<T>(key))
      }
    })

    return listener
  }

  refresh(): void {
    this.config = vscode.workspace.getConfiguration("opencode")
  }
}

export function getSettingsManager(): SettingsManager {
  return new SettingsManager()
}
