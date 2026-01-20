import * as vscode from "vscode"
import { SessionWithStatus } from "./SessionManager.js"

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
    return `ID: ${this.item.id}\nAgent: ${this.item.agent}\nDirectory: ${this.item.directory}\nCreated: ${new Date(this.item.time.created).toLocaleString()}\nUpdated: ${new Date(this.item.time.updated).toLocaleString()}`
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
    return []
  }
}
