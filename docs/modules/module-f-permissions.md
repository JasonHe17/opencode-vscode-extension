# Module F: 权限系统 (Permission System)

## 概述
本模块负责处理OpenCode工具执行前的权限请求。当AI需要执行潜在危险操作时，显示友好的对话框让用户确认。

**Phase**: 2
**依赖**: Module A (OpenCodeClient)
**可以并行开发**: Module B, Module E
**后续依赖**: Module C (ChatPanel)

---

## 文件所有权

```
extension/src/chat/
└── PermissionDialog.ts         [此模块独有]
```

---

## 任务列表

### Task 1: PermissionDialog.ts
**文件**: `extension/src/chat/PermissionDialog.ts`

**职责**: 显示权限请求对话框，处理用户选择

**接口定义**:

```typescript
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

  // === Permission Request Handling ===

  /**
   * 显示权限请求对话框
   */
  async showPermissionRequest(request: PermissionRequest): Promise<PermissionAction> {
    this.activeRequests.set(request.id, request)

    const message = this.buildPermissionMessage(request)

    // 根据风险等级选择按钮
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

  /**
   * 构建权限请求消息
   */
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

  /**
   * 根据风险等级返回可用操作
   */
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

  /**
   * 映射按钮文本到操作类型
   */
  private mapButtonToAction(button: string): PermissionAction {
    const map: Record<string, PermissionAction> = {
      "Allow": "allowOnce",
      "Allow Once": "allowOnce",
      "Allow All": "allowAll",
      "Deny": "deny"
    }
    return map[button] || "deny"
  }

  /**
   * 处理权限响应
   */
  private async handlePermissionResponse(
    request: PermissionRequest,
    action: PermissionAction
  ): Promise<void> {
    const response: PermissionResponse = {
      requestId: request.id,
      action,
      rule: request.rule
    }

    // 发送响应到服务器
    if (this.client) {
      try {
        await this.respondToPermission(request.id, action)
      } catch (error) {
        console.error("Failed to send permission response:", error)
      }
    }

    // 如果是Allow All，记录规则
    if (action === "allowAll" && request.rule) {
      await this.saveAllowRule(request.rule)
    }

    const actionText = this.getActionText(action)
    vscode.window.showInformationMessage(`Permission ${actionText}`)
  }

  // === Server Communication ===

  /**
   * 发送权限响应到OpenCode服务器
   */
  private async respondToPermission(
    permissionId: string,
    action: PermissionAction
  ): Promise<void> {
    if (!this.client) {
      throw new Error("OpenCodeClient not initialized")
    }

    const baseUrl = "http://localhost:4096" // 可配置
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

  // === Rule Management ===

  /**
   * 保存允许规则
   */
  private async saveAllowRule(rule: string): Promise<void> {
    const allowedRules = vscode.workspace.getConfiguration("opencode")
    const existing = allowedRules.get<string[]>("allowedRules") || []

    if (!existing.includes(rule)) {
      const updated = [...existing, rule]
      await allowedRules.update("allowedRules", updated, vscode.ConfigurationTarget.Global)
      vscode.window.showInformationMessage(`Rule "${rule}" added to allowed list`)
    }
  }

  /**
   * 检查规则是否已被允许
   */
  async isRuleAllowed(rule: string): Promise<boolean> {
    const allowedRules = vscode.workspace.getConfiguration("opencode")
    const existing = allowedRules.get<string[]>("allowedRules") || []
    return existing.includes(rule)
  }

  // === UI Helpers ===

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

  // === Cleanup ===

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this.activeRequests.clear()
  }
}

export function getPermissionDialog(): PermissionDialog {
  return PermissionDialog.getInstance()
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
1. `PermissionDialog` - 用于Module C (ChatPanel) 处理权限请求
2. `PermissionRequest` - 权限请求类型定义
3. `PermissionAction` - 权限操作类型定义

### 依赖:
- Module A: `OpenCodeClient` - 发送权限响应到服务器
- `vscode` - VS Code API

---

## 集成说明

### 在Module C (ChatPanel) 中使用:

```typescript
import { getPermissionDialog, PermissionRequest } from "./PermissionDialog"

export class ChatPanel {
  private permissionDialog = getPermissionDialog()

  async handlePermissionRequest(event: any): Promise<void> {
    const request: PermissionRequest = {
      id: event.requestId,
      tool: event.tool,
      operation: event.operation,
      targets: event.targets,
      risk: event.risk || "medium",
      rule: event.rule,
      askTime: Date.now(),
      sessionId: this.sessionId
    }

    const action = await this.permissionDialog.showPermissionRequest(request)

    // action会自动发送到服务器
  }
}
```

---

## 完成 Checklist

- [ ] PermissionDialog.ts 实现权限对话框
- [ ] 支持4种权限操作（允许/拒绝）
- [ ] 显示工具、操作、风险等级
- [ ] 实现规则管理（允许列表）
- [ ] 所有文件通过 `bun run test && bun run check-types`
- [ ] 准备交付Module C

---

## 注意事项

1. **单例模式**: PermissionDialog使用单例确保全局唯一实例
2. **风险分级**: 根据风险等级调整可用按钮
3. **规则系统**: 支持保存允许规则，避免重复询问
4. **异步处理**: 权限响应需要异步发送到服务器
5. **用户体验**: 使用emoji和清晰的消息格式提升易读性
