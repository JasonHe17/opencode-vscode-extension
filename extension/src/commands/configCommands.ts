import * as vscode from "vscode"
import { getSettingsPanel } from "../settings/SettingsPanel.js"

export async function openSettings(): Promise<void> {
  const settingsPanel = getSettingsPanel()
  settingsPanel.show()
}

export async function selectAgent(_sessionId?: string): Promise<void> {
  const agent = await vscode.window.showQuickPick(
    ["build", "plan", "explore", "general"],
    {
      placeHolder: "Select an agent"
    }
  )

  if (agent) {
    vscode.window.showInformationMessage(`Selected agent: ${agent}`)
  }
}

export async function selectModel(_sessionId?: string): Promise<void> {
  const provider = await vscode.window.showQuickPick(
    ["OpenAI", "Anthropic", "Google"],
    {
      placeHolder: "Select a provider"
    }
  )

  if (provider) {
    vscode.window.showInformationMessage(`Selected provider: ${provider}`)
  }
}

export async function setApiKey(provider?: string): Promise<void> {
  if (!provider) {
    const providers = await vscode.window.showQuickPick(
      ["OpenAI", "Anthropic", "Google", "GitHub Copilot"],
      {
        placeHolder: "Select a provider"
      }
    )
    if (!providers) return
    provider = providers
  }

  const apiKey = await vscode.window.showInputBox({
    placeHolder: "Enter your API key",
    password: true,
    prompt: `Enter API key for ${provider}`
  })

  if (apiKey) {
    vscode.window.showInformationMessage(`API key set for ${provider}`)
  }
}
