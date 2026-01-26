declare const acquireVsCodeApi: () => any
const vscodeApi = acquireVsCodeApi()

function resetState(): void {
  messages = []
  messagesContainer.innerHTML = ""
}

const messagesContainer = document.getElementById("messages")!
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement
const sendButton = document.getElementById("sendButton") as HTMLButtonElement
const attachButton = document.getElementById("attachButton") as HTMLButtonElement
const fileSuggestions = document.getElementById("fileSuggestions")!
const agentSelect = document.getElementById("agentSelect") as HTMLSelectElement
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement

let messages: any[] = []
let currentSessionId: string | null = null
let currentSessionTitle: string | null = null

agentSelect.addEventListener("change", () => {
  postMessage({
    type: "changeAgent",
    agent: agentSelect.value
  })
})

modelSelect.addEventListener("change", () => {
  postMessage({
    type: "changeModel",
    model: modelSelect.value
  })
})

function postMessage(message: any): void {
  vscodeApi.postMessage(message)
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
      const textDiv = renderTextPart(getPartContent(part))
      textDiv.setAttribute("data-part-id", part.id || "")
      textDiv.className = "message-text"
      contentDiv.appendChild(textDiv)
    } else if (part.type === "tool") {
      console.log("[renderMessage] Rendering tool part:", part)
      const toolHtml = renderToolExecution(part.content || part)
      toolHtml.setAttribute("data-part-id", part.id || "")
      contentDiv.appendChild(toolHtml)
    } else if (part.type === "reasoning") {
      const reasoningDiv = renderReasoningPart(getPartContent(part), contentDiv)
      reasoningDiv.setAttribute("data-part-id", part.id || "")
    } else {
      console.log("[renderMessage] Unknown part type:", part.type, part)
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

function getPartContent(part: any): string {
  if (part?.content && typeof part.content === "string") return part.content
  if (part?.text && typeof part.text === "string") return part.text
  if (part?.content?.html && typeof part.content.html === "string") return part.content.html
  return part?.content ? String(part.content) : ""
}

function renderReasoningPart(content: any, container: HTMLElement): HTMLElement {
  const reasoningDiv = document.createElement("div")
  reasoningDiv.className = "reasoning-container"
  reasoningDiv.setAttribute("data-collapsed", "true")

  const label = document.createElement("div")
  label.className = "reasoning-label"
  label.innerHTML = `<span class="reasoning-icon">🧠</span> Thinking... <span class="collapse-icon">▼</span>`
  reasoningDiv.appendChild(label)

  const textDiv = document.createElement("div")
  textDiv.className = "reasoning-content"

  if (content && typeof content === "object" && content.html) {
    textDiv.innerHTML = content.html
  } else if (typeof content === "string") {
    textDiv.textContent = content
  } else if (typeof content === "number") {
    textDiv.textContent = String(content)
  }

  reasoningDiv.appendChild(textDiv)

  label.addEventListener("click", (e) => {
    const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true"
    if (isCollapsed) {
      reasoningDiv.setAttribute("data-collapsed", "false")
    } else {
      reasoningDiv.setAttribute("data-collapsed", "true")
    }
    updateCollapseIcon(reasoningDiv)
    e.stopPropagation()
  })

  container.appendChild(reasoningDiv)
  return reasoningDiv
}

function updateCollapseIcon(reasoningDiv: HTMLElement): void {
  const icon = reasoningDiv.querySelector(".collapse-icon") as HTMLElement
  if (icon) {
    const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true"
    icon.textContent = isCollapsed ? "▼" : "▲"
  }
}

function updateMessagePart(messageId: string, partId: string, part: any): void {
  if (!partId) return
  const message = messages.find((m) => m.id === messageId)
  if (!message) return

  const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`)
  if (!messageEl) return
  const contentDiv = messageEl.querySelector(".message-content")
  if (!contentDiv) return

  let existingPart = message.parts.find((p: any) => p.id === partId || (p.content && p.content.id === partId))

  if (existingPart) {
    Object.assign(existingPart, part)
    if (part.type === "reasoning") {
      const reasoningEl = contentDiv.querySelector(`.reasoning-container[data-part-id="${partId}"]`) as HTMLElement
      if (reasoningEl) {
        const textDiv = reasoningEl.querySelector(".reasoning-content")
        if (textDiv) {
          if (part.content && typeof part.content === "object" && part.content.html) {
            textDiv.innerHTML = part.content.html
          } else if (typeof part.content === "string") {
            textDiv.textContent = part.content
          } else if (typeof part.text === "string") {
            textDiv.textContent = part.text
          }
          reasoningEl.scrollTop = reasoningEl.scrollHeight
        }
      }
    } else if (part.type === "text") {
      const textEl = contentDiv.querySelector(`.message-text[data-part-id="${partId}"]`)
      if (textEl) {
        textEl.textContent = getPartContent(part)
      }
    }
  } else {
    message.parts.push(part)
    if (part.type === "reasoning") {
      const reasoningDiv = document.createElement("div")
      reasoningDiv.className = "reasoning-container"
      reasoningDiv.setAttribute("data-part-id", partId)
      
      const label = document.createElement("div")
      label.className = "reasoning-label"
      label.innerHTML = `<span class="reasoning-icon">🧠</span> Thinking... <span class="collapse-icon">▼</span>`
      reasoningDiv.appendChild(label)

      const textDiv = document.createElement("div")
      textDiv.className = "reasoning-content"
      if (part.content && typeof part.content === "object" && part.content.html) {
        textDiv.innerHTML = part.content.html
      } else if (typeof part.content === "string") {
        textDiv.textContent = part.content
      } else if (typeof part.text === "string") {
        textDiv.textContent = part.text
      }
      reasoningDiv.appendChild(textDiv)
      
      label.addEventListener("click", (e) => {
        const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true"
        if (isCollapsed) {
          reasoningDiv.setAttribute("data-collapsed", "false")
        } else {
          reasoningDiv.setAttribute("data-collapsed", "true")
        }
        updateCollapseIcon(reasoningDiv)
        e.stopPropagation()
      })
      
      contentDiv.appendChild(reasoningDiv)
    } else if (part.type === "tool" && part.content) {
      contentDiv.querySelectorAll(".reasoning-container").forEach(r => r.setAttribute("data-collapsed", "true"))
      contentDiv.querySelectorAll(".reasoning-container").forEach(r => updateCollapseIcon(r as HTMLElement))
      
      const toolDiv = document.createElement("div")
      toolDiv.innerHTML = constructToolHtml(part.content)
      contentDiv.appendChild(toolDiv)
    } else if (part.type === "text") {
      contentDiv.querySelectorAll(".reasoning-container").forEach(r => r.setAttribute("data-collapsed", "true"))
      contentDiv.querySelectorAll(".reasoning-container").forEach(r => updateCollapseIcon(r as HTMLElement))

      const textDiv = renderTextPart(getPartContent(part))
      textDiv.setAttribute("data-part-id", partId)
      textDiv.className = "message-text"
      contentDiv.appendChild(textDiv)
    }
  }
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

function renderToolExecution(content: any): HTMLElement {
  const div = document.createElement("div")
  
  try {
    const toolHtml = content.html || constructToolHtml(content)
    div.innerHTML = toolHtml
  } catch (error) {
    console.error("[renderToolExecution] Error rendering tool:", error, content)
    div.innerHTML = `<div class="tool-execution tool-error">
      <div class="tool-header">
        <span class="tool-icon">⚠️</span>
        <span class="tool-name">Error rendering tool</span>
      </div>
      <pre class="tool-output">${escapeHtml(String(content) || "Unknown error")}</pre>
    </div>`
  }
  
  return div
}

function constructToolHtml(content: any): string {
  console.log("[constructToolHtml] Input content:", JSON.stringify(content, null, 2))
  
  const state = content.state || content
  
  const toolName = content.tool || content.toolName || content.toolData?.name || "Unknown Tool"
  
  const stateStatus = state?.status || "pending"
  const title = state?.title || content.title || ""
  const output = state?.output || content.output || ""
  const error = state?.error || content.error || ""
  const toolInput = state?.input || content.input || {}
  
  const stateIcons = {
    pending: "⏳",
    running: "🔄",
    completed: "✓",
    error: "✗"
  }
  
  const icon = getToolIcon(toolName)
  const stateIcon = stateIcons[stateStatus as keyof typeof stateIcons] || "⏳"
  
  let html = `
    <div class="tool-execution" data-state="${stateStatus}">
      <div class="tool-header">
        <span class="tool-icon">${icon}</span>
        <span class="tool-name">${escapeHtml(toolName)}</span>
        <span class="tool-state">${stateIcon}</span>
      </div>
  `
  
  if (title) {
    html += `<div class="tool-title">${escapeHtml(title)}</div>`
  }
  
  const shouldRenderCommandOutput = (toolName === "bash" && toolInput?.command) ||
                                    (toolInput?.command || toolInput?.description || toolInput?.location)
  
  if (shouldRenderCommandOutput) {
    html += `
      <div class="tool-content">
        <div class="tool-command-section">
          <div class="tool-command-label">Command</div>
          <pre class="tool-command">${escapeHtml(toolInput.command || toolInput.description || toolInput.location || "")}</pre>
        </div>
    `
  }
  
  if (stateStatus === "error" && error) {
    if (shouldRenderCommandOutput) {
      html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Error</div>
          <pre class="tool-output tool-error">${escapeHtml(error)}</pre>
        </div>
      `
    } else {
      html += `
        <div class="tool-error">
          <pre>${escapeHtml(error)}</pre>
        </div>
      `
    }
  } else if (output) {
    const shouldCollapse = output.length > 500 || output.split("\n").length > 20
    
    if (shouldCollapse) {
      html += `
        <div class="tool-output-section" data-collapsed="true">
          <div class="output-toggle" onclick="toggleToolSection(this)">
            <span class="toggle-icon">▶</span>
            <span class="tool-output-label">Output</span>
          </div>
          <pre class="tool-output">${escapeHtml(output)}</pre>
        </div>
      `
    } else {
      html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Output</div>
          <pre class="tool-output">${escapeHtml(output)}</pre>
        </div>
      `
    }
  } else if (stateStatus === "pending") {
    if (shouldRenderCommandOutput) {
      html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Output</div>
          <div class="tool-pending">Waiting for execution...</div>
        </div>
      `
    } else {
      html += `<div class="tool-pending">Waiting for execution...</div>`
    }
  } else if (stateStatus === "running") {
    if (shouldRenderCommandOutput) {
      html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Output</div>
          <div class="tool-running">Executing...</div>
        </div>
      `
    } else {
      html += `<div class="tool-running">Executing...</div>`
    }
  }
  
  if (shouldRenderCommandOutput) {
    html += `</div>`
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

;(window as any).toggleToolSection = function(toggle: HTMLElement): void {
  const section = toggle.parentElement as HTMLElement
  if (section) {
    const isCollapsed = section.getAttribute("data-collapsed") === "true"
    console.log("[toggleToolSection] Current state:", isCollapsed, "section:", section.className)
    
    if (isCollapsed) {
      section.removeAttribute("data-collapsed")
    } else {
      section.setAttribute("data-collapsed", "true")
    }
    
    const newState = section.getAttribute("data-collapsed") === "true"
    console.log("[toggleToolSection] New state:", newState)
    
    const icon = toggle.querySelector(".toggle-icon") as HTMLElement
    if (icon) {
      icon.textContent = isCollapsed ? "▼" : "▶"
    }
  }
}

;(window as any).toggleToolOutput = function(toggle: HTMLElement): void {
  const content = toggle.parentElement
  if (content) {
    content.toggleAttribute("data-collapsed")
  }
}

window.addEventListener("message", (event) => {
  const message = event.data
  console.log("[Webview] Received message type:", message.type)

  switch (message.type) {
    case "init":
      console.log("[init] Switching to session:", message.sessionId, "Previous:", currentSessionId)
      currentSessionId = message.sessionId || null
      currentSessionTitle = message.sessionTitle || "New Session"
      const titleEl = document.getElementById("sessionTitle")
      if (titleEl) titleEl.textContent = currentSessionTitle
      
      resetState()
      
      messages = message.messages || []
      messagesContainer.innerHTML = ""
      messages.forEach(renderMessage)
      
      console.log("[init] Initialized with", messages.length, "messages, sessionId:", currentSessionId)
      
      if (currentSessionId) {
        console.log("[init] Focusing input for session:", currentSessionId)
        messageInput.value = ""
        messageInput.focus()
      }
      break

    case "message":
      if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
        break
      }
      renderMessage(message)
      messages.push(message)
      break

    case "messagePart":
      if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
        break
      }
      updateMessagePart(message.messageId, message.partId || message.part?.id, message.part)
      break

    case "toolUpdate":
      if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
        break
      }
      if (message.toolId && message.updates) {
        updateMessagePart(message.messageId, message.toolId, {
          id: message.toolId,
          type: "tool",
          content: message.updates
        })
      }
      break

    case "sessionIdle":
      messagesContainer.querySelectorAll(".reasoning-container").forEach(r => {
        r.setAttribute("data-collapsed", "true")
        updateCollapseIcon(r as HTMLElement)
      })
      break

    case "fileSuggestions":
      showFileSuggestions(message.files || message.suggestions || [])
      break

    case "insertText":
      insertText(message.text)
      break

    case "clearSuggestions":
      fileSuggestions.hidden = true
      break

    case "serverStatus":
      updateSelectors(message.agents || [], message.models || [])
      break
  }
})

function updateSelectors(agents: string[], modelGroups: Array<{ providerID: string; models: string[] }>): void {
  console.log(`[updateSelectors] Updating selectors with ${modelGroups.length} providers`)
  
  const currentAgent = agentSelect.value
  agentSelect.innerHTML = ""
  agents.forEach(agent => {
    const option = document.createElement("option")
    option.value = agent
    option.textContent = agent
    if (agent === currentAgent) option.selected = true
    agentSelect.appendChild(option)
  })

  const currentModel = modelSelect.value
  modelSelect.innerHTML = ""
  
  const defaultOpt = document.createElement("option")
  defaultOpt.value = ""
  defaultOpt.textContent = "Default Model"
  modelSelect.appendChild(defaultOpt)

  if (modelGroups && modelGroups.length > 0) {
    modelGroups.forEach(group => {
      const optgroup = document.createElement("optgroup")
      optgroup.label = group.providerID
      group.models.forEach(model => {
        const option = document.createElement("option")
        const value = `${group.providerID}/${model}`
        option.value = value
        option.textContent = model
        if (value === currentModel) option.selected = true
        optgroup.appendChild(option)
      })
      modelSelect.appendChild(optgroup)
    })
  }
}

setTimeout(() => {
  console.log("Sending init request...");
  vscodeApi.postMessage({ type: "init" });
}, 100);

function showFileSuggestions(suggestions: any[]): void {
  fileSuggestions.innerHTML = ""

  if (suggestions.length === 0) {
    fileSuggestions.hidden = true
    return
  }

  suggestions.forEach((suggestion) => {
    const div = document.createElement("div")
    div.className = "suggestion-item"
    div.innerHTML = `
      <span class="suggestion-icon">📄</span>
      <span class="suggestion-path">${escapeHtml(suggestion.path)}</span>
      ${suggestion.lineRange ? `<span class="suggestion-range">${suggestion.lineRange}</span>` : ""}
    `
    div.addEventListener("click", () => {
      const text = messageInput.value
      const cursorPos = messageInput.selectionStart
      const beforeCursor = text.substring(0, cursorPos)
      const afterCursor = text.substring(cursorPos)
      const mentionMatch = beforeCursor.match(/@([^\s]*)$/)
      
      if (mentionMatch) {
        const beforeMention = beforeCursor.substring(0, mentionMatch.index)
        const insertText = `@${suggestion.path}${suggestion.lineRange || ""} `
        messageInput.value = beforeMention + insertText + afterCursor
        messageInput.selectionStart = messageInput.selectionEnd = beforeMention.length + insertText.length
      } else {
        insertText(`@${suggestion.path}${suggestion.lineRange || ""} `)
      }
      
      fileSuggestions.hidden = true
      messageInput.focus()
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
attachButton.addEventListener("click", () => {
  postMessage({
    type: "attachFile"
  })
})
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
      type: "requestFileSuggestions",
      searchTerm
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
