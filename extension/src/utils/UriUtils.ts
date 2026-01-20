import * as vscode from "vscode"

export class UriUtils {
  static toAbsolutePath(uri: vscode.Uri): string {
    return uri.fsPath
  }

  static toRelativePath(uri: vscode.Uri, rootUri?: vscode.Uri): string | null {
    const root = rootUri || this.getWorkspaceFolder(uri)
    if (!root) return null

    const absolutePath = uri.fsPath
    const rootPath = root.fsPath

    if (absolutePath.startsWith(rootPath)) {
      return absolutePath.slice(rootPath.length + 1).replace(/\\/g, "/")
    }

    return null
  }

  static getWorkspaceFolder(uri: vscode.Uri): vscode.Uri | null {
    const folder = vscode.workspace.getWorkspaceFolder(uri)
    return folder?.uri || null
  }

  static toUri(path: string): vscode.Uri {
    return vscode.Uri.file(path)
  }
}
