import * as vscode from "vscode"
import { UriUtils } from "./UriUtils"

export interface FileMention {
  text: string
  path: string
  selection?: {
    startLine: number
    endLine: number
  }
}

export class SelectionUtils {
  static getFileMention(editor?: vscode.TextEditor): FileMention | null {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return null

    const document = activeEditor.document
    const relativePath = UriUtils.toRelativePath(document.uri)
    if (!relativePath) return null

    let mentionText = `@${relativePath}`
    let selection

    const sel = activeEditor.selection
    if (!sel.isEmpty) {
      const startLine = sel.start.line + 1
      const endLine = sel.end.line + 1

      if (startLine === endLine) {
        mentionText += `#L${startLine}`
      } else {
        mentionText += `#L${startLine}-${endLine}`
      }

      selection = { startLine, endLine }
    }

    return {
      text: mentionText,
      path: relativePath,
      selection
    }
  }

  static getActiveSelection(editor?: vscode.TextEditor): string | null {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return null

    const sel = activeEditor.selection
    if (sel.isEmpty) return null

    return activeEditor.document.getText(sel)
  }

  static hasSelection(editor?: vscode.TextEditor): boolean {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return false

    return !activeEditor.selection.isEmpty
  }

  static insertIntoEditor(text: string, editor?: vscode.TextEditor): void {
    const activeEditor = editor || vscode.window.activeTextEditor
    if (!activeEditor) return

    const position = activeEditor.selection.active
    activeEditor.edit((editBuilder) => {
      editBuilder.insert(position, text)
    })
  }
}
