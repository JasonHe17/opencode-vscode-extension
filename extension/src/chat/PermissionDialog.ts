import * as vscode from "vscode"

export type PermissionAction =
  | "allowOnce"
  | "allowAll"
  | "deny"
  | "denyTool"

export interface PermissionRequest {
  id: string
  tool: string
  operation: string
  targets: string[]
  risk: "low" | "medium" | "high"
  rule?: string
  askTime: number
  sessionId: string
}

export interface PermissionResponse {
  requestId: string
  action: PermissionAction
  rule?: string
}

export class PermissionDialog {
  private static instance: PermissionDialog
  private client: any
  private activeRequests: Map<string, PermissionRequest> = new Map()
  private disposables: vscode.Disposable[] = []

  private constructor() {}

  static getInstance(): PermissionDialog {
    if (!PermissionDialog.instance) {
      PermissionDialog.instance = new PermissionDialog()
    }
    return PermissionDialog.instance
  }

  setClient(client: any): void {
    this.client = client
  }

  async showPermissionRequest(request: PermissionRequest): Promise<PermissionAction> {
    this.activeRequests.set(request.id, request)

    const message = this.buildPermissionMessage(request)

    const actions = this.getActionsForRisk(request.risk)

    const selected = await vscode.window.showWarningMessage(message, ...actions)

    if (!selected) {
      return "deny"
    }

    const action = this.mapButtonToAction(selected)
    await this.handlePermissionResponse(request, action)

    this.activeRequests.delete(request.id)
    return action
  }

  private buildPermissionMessage(request: PermissionRequest): string {
    const toolEmoji = this.getToolEmoji(request.tool)
    const riskIcon = this.getRiskIcon(request.risk)

    let message = `${toolEmoji} **${request.tool}**\n\n`
    message += `${riskIcon} ${request.operation}\n\n`

    if (request.targets.length > 0) {
      message += `Targets:\n`
      request.targets.slice(0, 5).forEach((target) => {
        message += `  • ${target}\n`
      })
      if (request.targets.length > 5) {
        message += `  • ... and ${request.targets.length - 5} more\n`
      }
    }

    if (request.rule) {
      message += `\nRule: \`${request.rule}\`\n`
    }

    message += `\n${this.getRiskDescription(request.risk)}`

    return message
  }

  private getActionsForRisk(risk: PermissionRequest["risk"]): string[] {
    switch (risk) {
      case "low":
        return ["Allow", "Allow All", "Deny"]

      case "medium":
        return ["Allow Once", "Deny"]

      case "high":
        return ["Deny", "Allow Once"]

      default:
        return ["Allow Once", "Deny"]
    }
  }

  private mapButtonToAction(button: string): PermissionAction {
    const map: Record<string, PermissionAction> = {
      "Allow": "allowOnce",
      "Allow Once": "allowOnce",
      "Allow All": "allowAll",
      "Deny": "deny"
    }
    return map[button] || "deny"
  }

  private async handlePermissionResponse(
    request: PermissionRequest,
    action: PermissionAction
  ): Promise<void> {
    if (this.client) {
      try {
        await this.respondToPermission(request.id, action)
      } catch (error) {
        console.error("Failed to send permission response:", error)
      }
    }

    if (action === "allowAll" && request.rule) {
      await this.saveAllowRule(request.rule)
    }

    const actionText = this.getActionText(action)
    vscode.window.showInformationMessage(`Permission ${actionText}`)
  }

  private async respondToPermission(
    permissionId: string,
    action: PermissionAction
  ): Promise<void> {
    if (!this.client) {
      throw new Error("OpenCodeClient not initialized")
    }

    const baseUrl = "http://localhost:4096"
    const url = `${baseUrl}/permission/${permissionId}/respond`

    const body = {
      action,
      timestamp: Date.now()
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Failed to respond to permission: ${response.statusText}`)
    }
  }

  private async saveAllowRule(rule: string): Promise<void> {
    const allowedRules = vscode.workspace.getConfiguration("opencode")
    const existing = allowedRules.get<string[]>("allowedRules") || []

    if (!existing.includes(rule)) {
      const updated = [...existing, rule]
      await allowedRules.update("allowedRules", updated, vscode.ConfigurationTarget.Global)
      vscode.window.showInformationMessage(`Rule "${rule}" added to allowed list`)
    }
  }

  async isRuleAllowed(rule: string): Promise<boolean> {
    const allowedRules = vscode.workspace.getConfiguration("opencode")
    const existing = allowedRules.get<string[]>("allowedRules") || []
    return existing.includes(rule)
  }

  private getToolEmoji(tool: string): string {
    const emojis: Record<string, string> = {
      bash: "💻",
      write: "📝",
      edit: "✏️",
      read: "📄",
      delete: "🗑️",
      webfetch: "🌐",
      websearch: "🔍",
      default: "🔧"
    }
    return emojis[tool] || emojis.default
  }

  private getRiskIcon(risk: PermissionRequest["risk"]): string {
    const icons = {
      low: "✅",
      medium: "⚠️",
      high: "🚨"
    }
    return icons[risk]
  }

  private getRiskDescription(risk: PermissionRequest["risk"]): string {
    const descriptions = {
      low: "This operation is considered safe.",
      medium: "This operation may modify files or execute commands.",
      high: "This operation is potentially destructive. Proceed with caution."
    }
    return descriptions[risk]
  }

  private getActionText(action: PermissionAction): string {
    const texts = {
      allowOnce: "allowed (once)",
      allowAll: "allowed (all)",
      deny: "denied"
    }
    return texts[action]
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this.activeRequests.clear()
  }
}

export function getPermissionDialog(): PermissionDialog {
  return PermissionDialog.getInstance()
}
