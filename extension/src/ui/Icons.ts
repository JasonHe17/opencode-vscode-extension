import * as vscode from "vscode"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class Icons {
  static readonly logo = {
    light: vscode.Uri.file(
      join(__dirname, "../../images/logo-dark.svg")
    ),
    dark: vscode.Uri.file(
      join(__dirname, "../../images/logo-light.svg")
    )
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
