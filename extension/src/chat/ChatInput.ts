import * as vscode from "vscode"
import { SelectionUtils } from "../utils/SelectionUtils.js"

export interface FileSuggestion {
  path: string
  uri: string
  lineRange?: string
}

export class ChatInput {
  private webview: vscode.Webview | null = null

  constructor(private panel: vscode.WebviewPanel) {
    this.webview = panel.webview
  }

  async handleTextInput(text: string): Promise<void> {
    const cursorPos = text.length
    const beforeCursor = text.substring(0, cursorPos)
    const mentionMatch = beforeCursor.match(/@([^\s]*)$/)

    if (mentionMatch) {
      const searchTerm = mentionMatch[1]
      await this.showFileSuggestions(searchTerm)
    } else {
      this.postMessage({
        type: "clearSuggestions"
      })
    }
  }

  private async showFileSuggestions(searchTerm: string): Promise<void> {
    if (searchTerm.length === 0) {
      const openFiles = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .map((tab) => tab.input)
        .filter((input): input is vscode.TabInputText => input instanceof vscode.TabInputText)
        .map((input) => input.uri)
        .filter((uri) => uri.scheme === "file")

      const suggestions = await this.filterFiles(openFiles, searchTerm)
      this.postMessage({
        type: "fileSuggestions",
        suggestions: suggestions.map((uri) => ({
          path: vscode.workspace.asRelativePath(uri),
          uri: uri.toString()
        }))
      })
      return
    }

    const files = await vscode.workspace.findFiles(`**/*${searchTerm}*`, null, 50)

    const suggestions = await this.filterFiles(files, searchTerm)
    this.postMessage({
      type: "fileSuggestions",
      suggestions: suggestions.map((uri, index) => {
        const fileMention = SelectionUtils.getFileMention()
        return {
          path: vscode.workspace.asRelativePath(uri),
          uri: uri.toString(),
          lineRange: index === 0 && fileMention?.selection
            ? `#L${fileMention.selection.startLine}-${fileMention.selection.endLine}`
            : undefined
        }
      })
    })
  }

  private async filterFiles(
    files: vscode.Uri[],
    _searchTerm: string
  ): Promise<vscode.Uri[]> {
    const textDocumentFiles: vscode.Uri[] = []

    for (const file of files) {
      if (file.scheme !== "file") continue

      const ext = file.fsPath.split(".").pop()?.toLowerCase()
      const textExtensions = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "md", "txt", "json", "yaml", "yml", "toml", "css", "html", "svelte"]

      if (ext && textExtensions.includes(ext)) {
        textDocumentFiles.push(file)
      }
    }

    return textDocumentFiles.slice(0, 10)
  }

  insertFileReference(fileSuggestion: FileSuggestion): void {
    let mention = `@${fileSuggestion.path}`
    if (fileSuggestion.lineRange) {
      mention += fileSuggestion.lineRange
    }

    this.postMessage({
      type: "insertText",
      text: mention + " "
    })
  }

  getCurrentFileMention(): string | null {
    const fileMention = SelectionUtils.getFileMention()
    return fileMention?.text || null
  }

  private postMessage(message: any): void {
    this.webview?.postMessage(message)
  }
}
