import * as vscode from "vscode"
import { join } from "path"

function getExtensionPath(): string {
  const extension = vscode.extensions.getExtension('opencode-ai.opencode-gui')
  return extension?.extensionPath || ''
}

export class Icons {
  static getLogo(): { light: vscode.Uri; dark: vscode.Uri } {
    const extensionPath = getExtensionPath()
    return {
      light: vscode.Uri.file(
        join(extensionPath, "images", "logo-dark.svg")
      ),
      dark: vscode.Uri.file(
        join(extensionPath, "images", "logo-light.svg")
      )
    }
  }

  static session = {
    active: new vscode.ThemeIcon("radio-tower"),
    idle: new vscode.ThemeIcon("circle-outline"),
    archived: new vscode.ThemeIcon("archive", new vscode.ThemeColor("descriptionForeground"))
  }

  static agent = {
    build: new vscode.ThemeIcon("rocket", new vscode.ThemeColor("terminal.ansiRed")),
    plan: new vscode.ThemeIcon("list-tree", new vscode.ThemeColor("terminal.ansiGreen")),
    explore: new vscode.ThemeIcon("search", new vscode.ThemeColor("terminal.ansiBlue")),
    general: new vscode.ThemeIcon("package", new vscode.ThemeColor("terminal.ansiYellow")),
    default: new vscode.ThemeIcon("symbol-class")
  }

  static tool = {
    pending: new vscode.ThemeIcon("loading~spin"),
    running: new vscode.ThemeIcon("sync~spin"),
    completed: new vscode.ThemeIcon("pass"),
    error: new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground"))
  }

  static status = {
    connected: new vscode.ThemeIcon("check"),
    disconnected: new vscode.ThemeIcon("x"),
    busy: new vscode.ThemeIcon("loading~spin")
  }

  static permission = {
    allowed: new vscode.ThemeIcon("shield"),
    denied: new vscode.ThemeIcon("lock"),
    pending: new vscode.ThemeIcon("shield", new vscode.ThemeColor("editorWarning.foreground"))
  }
}
