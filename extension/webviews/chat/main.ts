declare const acquireVsCodeApi: () => any
const vscode = acquireVsCodeApi()

const messagesContainer = document.getElementById("messages")!
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement
const sendButton = document.getElementById("sendButton")!
const attachButton = document.getElementById("attachButton")!
const fileSuggestions = document.getElementById("fileSuggestions")!

let messages: any[] = []

function postMessage(message: any): void {
  vscode.postMessage(message)
}

function renderMessage(message: any): void {
  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${message.role}`
  messageDiv.setAttribute("data-message-id", message.id)

  const roleDiv = document.createElement("div")
  roleDiv.className = "message-role"
  roleDiv.textContent = message.role === "user" ? "You" : "OpenCode"
  messageDiv.appendChild(roleDiv)

  const contentDiv = document.createElement("div")
  contentDiv.className = "message-content"
  messageDiv.appendChild(contentDiv)

  message.parts.forEach((part: any) => {
    if (part.type === "text") {
      contentDiv.appendChild(renderTextPart(part.content))
    } else if (part.type === "tool") {
      const toolHtml = renderToolExecution(part.content)
      contentDiv.appendChild(toolHtml)
    } else if (part.type === "reasoning") {
      renderReasoningPart(part.content, contentDiv)
    }
  })

  messagesContainer.appendChild(messageDiv)
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

function renderTextPart(text: string): HTMLElement {
  const pre = document.createElement("div")
  pre.style.whiteSpace = "pre-wrap"
  pre.textContent = text
  return pre
}

function renderReasoningPart(content: any, container: HTMLElement): void {
  if (content && typeof content === "object" && content.html) {
    container.innerHTML += content.html
  } else if (typeof content === "string") {
    const div = document.createElement("div")
    div.style.padding = "8px"
    div.style.background = "var(--vscode-editor-background)"
    div.style.borderLeft = "3px solid var(--vscode-focusBorder)"
    div.textContent = content
    container.appendChild(div)
  }
}

function renderToolExecution(content: any): HTMLElement {
  const div = document.createElement("div")
  
  const toolHtml = content.html || constructToolHtml(content)
  div.innerHTML = toolHtml
  
  return div
}

function constructToolHtml(content: any): string {
  const state = content.state || "pending"
  const toolName = content.tool?.name || content.toolName || "Unknown Tool"
  const title = content.output?.title || content.title || ""
  const output = content.output?.output || content.output || ""
  const error = content.output?.error || content.error || ""
  
  const stateIcons = {
    pending: "⏳",
    running: "🔄",
    completed: "✓",
    error: "✗"
  }
  
  const icon = getToolIcon(toolName)
  const stateIcon = stateIcons[state as keyof typeof stateIcons] || "⏳"
  
  let html = `
    <div class="tool-execution" data-state="${state}">
      <div class="tool-header">
        <span class="tool-icon">${icon}</span>
        <span class="tool-name">${escapeHtml(toolName)}</span>
        <span class="tool-state">${stateIcon}</span>
      </div>
  `
  
  if (title) {
    html += `<div class="tool-title">${escapeHtml(title)}</div>`
  }
  
  if (state === "error" && error) {
    html += `
      <div class="tool-error">
        <pre>${escapeHtml(error)}</pre>
      </div>
    `
  } else if (output) {
    const shouldCollapse = output.length > 500 || output.split("\n").length > 20
    
    if (shouldCollapse) {
      html += `
        <div class="tool-content" data-collapsed="true">
          <div class="output-toggle" onclick="toggleToolOutput(this)">
            <span class="toggle-icon">▶</span>
            ${escapeHtml(output.substring(0, 100))}...
          </div>
          <pre class="tool-output">${escapeHtml(output)}</pre>
        </div>
      `
    } else {
      html += `<pre class="tool-output">${escapeHtml(output)}</pre>`
    }
  } else if (state === "pending") {
    html += `<div class="tool-pending">Waiting for execution...</div>`
  } else if (state === "running") {
    html += `<div class="tool-running">Executing...</div>`
  }
  
  html += `</div>`
  
  return html
}

function getToolIcon(toolName: string): string {
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
    question: "❓",
    default: "🔧"
  }
  return icons[toolName] || icons.default
}

function escapeHtml(text: string): string {
  const escaped: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }
  return text.replace(/[&<>"']/g, (char) => escaped[char as keyof typeof escaped])
}

;(window as any).toggleToolOutput = function(toggle: HTMLElement): void {
  const content = toggle.parentElement
  if (content) {
    content.toggleAttribute("data-collapsed")
  }
}

window.addEventListener("message", (event) => {
  const message = event.data

  switch (message.type) {
    case "messageAdd":
      renderMessage(message.message)
      messages.push(message.message)
      break

    case "messageHistory":
      messages = message.messages
      messagesContainer.innerHTML = ""
      messages.forEach(renderMessage)
      break

    case "messagePartUpdate":
      updateMessagePart(message.messageId, message.partId, message.part)
      break

    case "sessionIdle":
      console.log("Session idle:", message.sessionId)
      break

    case "fileSuggestions":
      showFileSuggestions(message.suggestions)
      break

    case "insertText":
      insertText(message.text)
      break

    case "clearSuggestions":
      fileSuggestions.hidden = true
      break
  }
})

function updateMessagePart(messageId: string, partId: string, part: any): void {
  const message = messages.find((m) => m.id === messageId)
  if (!message) return

  const existingPart = message.parts.find((p: any) => p.id === partId || (p.content && p.content.id === partId))
  if (existingPart) {
    Object.assign(existingPart, part)
  } else {
    message.parts.push(part)
  }

  const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`)
  if (messageEl) {
    const contentDiv = messageEl.querySelector(".message-content")
    if (contentDiv) {
      if (part.type === "tool" && part.content) {
        const toolDiv = document.createElement("div")
        toolDiv.innerHTML = constructToolHtml(part.content)
        contentDiv.appendChild(toolDiv)
      } else if (part.type === "text") {
        const textDiv = renderTextPart(part.content)
        contentDiv.appendChild(textDiv)
      }
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }
}

function showFileSuggestions(suggestions: any[]): void {
  fileSuggestions.innerHTML = ""

  if (suggestions.length === 0) {
    fileSuggestions.hidden = true
    return
  }

  suggestions.forEach((suggestion) => {
    const div = document.createElement("div")
    div.className = "file-suggestion"
    div.innerHTML = `
      <span class="file-suggestion-icon">📄</span>
      <span class="file-suggestion-path">${escapeHtml(suggestion.path)}</span>
      ${suggestion.lineRange ? `<span class="file-suggestion-range">${suggestion.lineRange}</span>` : ""}
    `
    div.addEventListener("click", () => {
      insertText(`@${suggestion.path}${suggestion.lineRange || ""} `)
      fileSuggestions.hidden = true
    })
    fileSuggestions.appendChild(div)
  })

  fileSuggestions.hidden = false
}

function insertText(text: string): void {
  const start = messageInput.selectionStart
  const end = messageInput.selectionEnd
  const before = messageInput.value.substring(0, start)
  const after = messageInput.value.substring(end)

  messageInput.value = before + text + after
  messageInput.selectionStart = messageInput.selectionEnd = start + text.length
  messageInput.focus()
}

sendButton.addEventListener("click", sendMessage)
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

function sendMessage(): void {
  const text = messageInput.value.trim()
  if (!text) return

  postMessage({
    type: "sendMessage",
    text
  })

  messageInput.value = ""
  sendButton.disabled = true
  setTimeout(() => {
    sendButton.disabled = false
  }, 500)
}

messageInput.addEventListener("input", (e) => {
  const text = (e.target as HTMLTextAreaElement).value
  const cursorPos = messageInput.selectionStart
  const beforeCursor = text.substring(0, cursorPos)
  const mentionMatch = beforeCursor.match(/@([^\s]*)$/)

  if (mentionMatch) {
    const searchTerm = mentionMatch[1]
    postMessage({
      type: "showFileSuggestions",
      text: beforeCursor
    })
  } else {
    fileSuggestions.hidden = true
  }
})

document.addEventListener("click", (e) => {
  if (!fileSuggestions.contains(e.target as Node)) {
    fileSuggestions.hidden = true
  }
})
