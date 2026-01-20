export type ToolState = "pending" | "running" | "completed" | "error"

export interface ToolExecution {
  toolId: string
  toolName: string
  state: ToolState
  title?: string
  startTime: number
  endTime?: number
  output?: string
  error?: string
  attachments?: any[]
}

export class ToolRenderer {
  renderItem(tool: ToolExecution): string {
    const icon = this.getToolIcon(tool.toolName)
    const stateIcon = this.getStateIcon(tool.state)
    const duration = tool.endTime
      ? `${((tool.endTime - tool.startTime) / 1000).toFixed(2)}s`
      : "Running..."

    let html = `
      <div class="tool-execution" data-state="${tool.state}">
        <div class="tool-header">
          <span class="tool-icon">${icon}</span>
          <span class="tool-name">${this.escapeHtml(tool.toolName)}</span>
          <span class="tool-state">${stateIcon}</span>
          <span class="tool-duration">${duration}</span>
        </div>
    `

    if (tool.title) {
      html += `<div class="tool-title">${this.escapeHtml(tool.title)}</div>`
    }

    html += this.renderToolOutput(tool)
    html += `</div>`

    return html
  }

  private renderToolOutput(tool: ToolExecution): string {
    if (tool.state === "pending") {
      return '<div class="tool-pending">Waiting for execution...</div>'
    }

    if (tool.state === "running") {
      return '<div class="tool-running">Executing...</div>'
    }

    if (tool.state === "error") {
      const error = tool.error || "Unknown error"
      return `
        <div class="tool-error">
          <pre>${this.escapeHtml(error)}</pre>
        </div>
      `
    }

    if (tool.state === "completed") {
      const output = tool.output || "(No output)"
      const shouldCollapse = this.shouldCollapseOutput(output)

      let html = `
        <div class="tool-content" ${shouldCollapse ? 'data-collapsed="true"' : ""}>
      `

      if (shouldCollapse) {
        html += `
          <div class="output-toggle" onclick="this.parentElement.toggleAttribute('data-collapsed')">
            <span class="toggle-icon">▶</span>
            ${this.escapeHtml(this.truncateOutput(output))}...
          </div>
        `
      }

      html += `
          <pre class="tool-output">${this.escapeHtml(output)}</pre>
          ${this.renderAttachments(tool.attachments)}
        </div>
      `

      return html
    }

    return ""
  }

  private renderAttachments(attachments: any[]): string {
    if (!attachments || attachments.length === 0) return ""

    return `
      <div class="tool-attachments">
        ${attachments.map((att) => `
          <div class="attachment">
            <span class="attachment-icon">📎</span>
            <span class="attachment-name">${this.escapeHtml(att.filename || "File")}</span>
          </div>
        `).join("")}
      </div>
    `
  }

  private getToolIcon(toolName: string): string {
    const icons: Record<string, string> = {
      bash: "💻",
      read: "📄",
      write: "📝",
      edit: "✏️",
      glob: "🔍",
      grep: "🔎",
      webfetch: "🌐",
      websearch: "🔍",
      codesearch: "🔍",
      task: "🔧",
      question: "question",
      default: "🔧"
    }
    return icons[toolName] || icons.default
  }

  private getStateIcon(state: ToolState): string {
    const icons = {
      pending: "⏳",
      running: "🔄",
      completed: "✓",
      error: "✗"
    }
    return icons[state]
  }

  private shouldCollapseOutput(output: string): boolean {
    return output.length > 500 || output.split("\n").length > 20
  }

  private truncateOutput(output: string, maxLen: number = 100): string {
    return output.slice(0, maxLen)
  }

  private escapeHtml(text: string): string {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }
    return text.replace(/[&<>"']/g, (char) => escaped[char as keyof typeof escaped])
  }
}

export function getToolRenderer(): ToolRenderer {
  return new ToolRenderer()
}
