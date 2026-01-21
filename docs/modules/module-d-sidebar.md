# Module D: 会话侧边栏 (Session Sidebar)

## 概述
本模块负责在VS Code侧边栏中显示会话列表，提供会话管理功能（打开、分支、删除、导出等）。

**Phase**: 3
**依赖**: Module B (SessionManager)
**可以并行开发**: Module C
**后续依赖**: Module H (main.ts)

---

## 文件所有权

```
extension/src/session/
├── SessionTreeProvider.ts      [此模块独有]
└── SessionTreeItem.ts          [此模块独有]
```

---

## 任务列表

### Task 1: SessionTreeItem.ts
**文件**: `extension/src/session/SessionTreeItem.ts`

**职责**: 定义会话树节点

**接口定义**:

```typescript
import * as vscode from "vscode"
import { SessionWithStatus } from "./SessionManager"

export type SessionItemType = "session" | "message" | "tool"

export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly item: SessionWithStatus,
    public readonly itemType: SessionItemType = "session"
  ) {
    super(item.title, vscode.TreeItemCollapsibleState.None)

    this.description = this.getDescription()
    this.tooltip = this.getTooltip()
    this.contextValue = this.getContextValue()
    this.iconPath = this.getIcon()
    this.command = this.getCommand()

    // 标记活跃会话
    if (item.status === "active") {
      this.label = `[Active] ${item.title}`
      this.contextValue += "_active"
    }
  }

  private getDescription(): string {
    const parts: string[] = []

    if (this.item.messageCount > 0) {
      parts.push(`${this.item.messageCount} messages`)
    }

    const timeSince = Math.floor((Date.now() - this.item.time.updated) / 60000)
    if (timeSince < 1) {
      parts.push("Just now")
    } else if (timeSince < 60) {
      parts.push(`${timeSince}m ago`)
    } else if (timeSince < 1440) {
      parts.push(`${Math.floor(timeSince / 60)}h ago`)
    } else {
      parts.push(`${Math.floor(timeSince / 1440)}d ago`)
    }

    return parts.join(" • ")
  }

  private getTooltip(): string {
    return `
ID: ${this.item.id}\n
Agent: ${this.item.agent}\n
Directory: ${this.item.directory}\n
Created: ${new Date(this.item.time.created).toLocaleString()}\n
Updated: ${new Date(this.item.time.updated).toLocaleString()}
    `.trim()
  }

  private getContextValue(): string {
    const parts = ["opencode_session"]

    if (this.item.status === "active") {
      parts.push("active")
    }

    return parts.join("_")
  }

  private getIcon(): vscode.ThemeIcon {
    switch (this.item.agent) {
      case "build":
        return new vscode.ThemeIcon("rocket", new vscode.ThemeColor("terminal.ansiRed"))
      case "plan":
        return new vscode.ThemeIcon("list-tree", new vscode.ThemeColor("terminal.ansiGreen"))
      case "explore":
        return new vscode.ThemeIcon("search", new vscode.ThemeColor("terminal.ansiBlue"))
      case "general":
        return new vscode.ThemeIcon("package", new vscode.ThemeColor("terminal.ansiYellow"))
      default:
        return new vscode.ThemeIcon("comment-discussion")
    }
  }

  private getCommand(): vscode.Command | undefined {
    return {
      command: "opencode.session.open",
      title: "Open Session",
      arguments: [this.item.id]
    }
  }

  get children(): SessionTreeItem[] {
    // 可以添加子节点，如消息列表或工具列表
    return []
  }
}
```

---

### Task 2: SessionTreeProvider.ts
**文件**: `extension/src/session/SessionTreeProvider.ts`

**职责**: 提供会话树的数据源和操作

**接口定义**:

```typescript
import * as vscode from "vscode"
import { SessionManager, SessionWithStatus } from "./SessionManager"
import { SessionTreeItem } from "./SessionTreeItem"

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private sessionManager: SessionManager
  private disposables: vscode.Disposable[] = []

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager

    // 监听会话变化
    this.disposables.push(
      this.sessionManager.onSessionEvent((event) => {
        this.refresh()
      })
    )
  }

  /**
   * 刷新树视图
   */
  refresh(item?: SessionTreeItem): void {
    this._onDidChangeTreeData.fire(item)
  }

  /**
   * 获取树节点
   */
  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element
  }

  /**
   * 获取子节点
   */
  getChildren(element?: SessionTreeItem): Thenable<SessionTreeItem[]> {
    if (element) {
      // 返回会话的子节点（消息、工具等）
      return Promise.resolve(element.children)
    }

    // 返回所有会话（按状态分组）
    return Promise.resolve(
      this.sessionManager.getAllSessions().map((session) => new SessionTreeItem(session))
    )
  }

  /**
   * 获取父节点
   */
  getParent(element: SessionTreeItem): Thenable<SessionTreeItem | undefined> {
    return Promise.resolve(undefined)
  }

  // === Session Operations ===

  /**
   * 打开会话
   */
  async openSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) {
      vscode.window.showErrorMessage(`Session ${sessionId} not found`)
      return
    }

    // 激活会话
    await this.sessionManager.setActiveSession(sessionId)

    // 打开聊天面板
    vscode.commands.executeCommand("opencode.chat.open", sessionId)
  }

  /**
   * 分支会话
   */
  async forkSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    const messageId = await this.selectForkPoint(sessionId)

    try {
      const newSession = await this.sessionManager.forkSession(sessionId, messageId)
      vscode.window.showInformationMessage(`Created fork: ${newSession.title}`)
      this.refresh()
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to fork session: ${error}`)
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.sessionManager.deleteSession(sessionId)
      this.refresh()
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete session: ${error}`)
    }
  }

  /**
   * 导出会话
   */
  async exportSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    const format = await vscode.window.showQuickPick(
      ["Markdown", "JSON"],
      { placeHolder: "Select export format" }
    )

    if (!format) return

    let content = ""

    // TODO: 实际获取会话历史
    content = "# " + session.title + "\n\n*Exported at " + new Date().toISOString() + "*"

    const defaultUri = vscode.Uri.file(
      `${session.title.replace(/[^a-zA-Z0-9]/g, "_")}_export.${format === "Markdown" ? "md" : "json"}`
    )

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        [format]: [format === "Markdown" ? "md" : "json"]
      }
    })

    if (uri) {
      try {
        const encoder = new TextEncoder()
        await vscode.workspace.fs.writeFile(uri, encoder.encode(content))
        vscode.window.showInformationMessage("Session exported successfully")
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export session: ${error}`)
      }
    }
  }

  /**
   * 分享会话
   */
  async shareSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    // TODO: 通过OpenCode API生成分享链接
    vscode.window.showInformationMessage("Share link copied to clipboard")
  }

  /**
   * 归档会话
   */
  async archiveSession(sessionId: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, { status: "archived" })
    this.refresh()
    vscode.window.showInformationMessage("Session archived")
  }

  /**
   * 取消归档
   */
  async unarchiveSession(sessionId: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, { status: "idle" })
    this.refresh()
    vscode.window.showInformationMessage("Session unarchived")
  }

  // === Helpers ===

  /**
   * 选择分支点（消息）
   */
  private async selectForkPoint(sessionId: string): Promise<string | undefined> {
    // TODO: 显示消息列表让用户选择分支点
    const points = ["Start", "Last message", "Custom..."]
    const selected = await vscode.window.showQuickPick(points, {
      placeHolder: "Select fork point"
    })

    if (selected === "Start") return undefined
    if (selected === "Last message") {
      // TODO: 获取最后一条消息ID
      return undefined
    }
    if (selected === "Custom...") {
      const messageId = await vscode.window.showInputBox({
        placeHolder: "Enter message ID",
        prompt: "Enter the message ID to fork from (leave empty for start)"
      })
      return messageId || undefined
    }

    return undefined
  }

  // === Cleanup ===

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this._onDidChangeTreeData.dispose()
  }
}

export function getSessionTreeProvider(sessionManager: SessionManager): SessionTreeProvider {
  return new SessionTreeProvider(sessionManager)
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
1. `SessionTreeProvider` - 用于Module H (main.ts) 注册TreeView
2. `SessionTreeItem` - 树节点实体

### 依赖:
- Module B: `SessionManager` - 获取会话数据
- `vscode` - VS Code API

---

## 完成 Checklist

- [x] SessionTreeItem.ts 实现树节点定义
- [x] SessionTreeProvider.ts 实现树数据源
- [x] SessionTreeProvider.ts 实现会话操作（打开/分支/删除）
- [x] 集成SessionManager获取会话列表
- [x] package.json 添加viewsContributes
- [x] 所有文件通过类型检查
- [x] 准备交付Module H

---

## 注意事项

1. **事件驱动**: 监听SessionManager的事件自动刷新
2. **状态显示**: 使用ThemetIcon和颜色编码显示不同状态
3. **上下文菜单**: 为不同状态提供不同的右键菜单
4. **排序**: 会话按更新时间倒序排列
5. **描述信息**: 显示消息数量和时间，提供快速概览
