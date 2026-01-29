import { marked } from "marked"
import { markedHighlight } from "marked-highlight"
import hljs from "highlight.js"

declare const acquireVsCodeApi: () => any
const vscodeApi = acquireVsCodeApi()

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext"
      return hljs.highlight(code, { language }).value
    }
  })
)

marked.setOptions({
  breaks: true,
  gfm: true
})

function resetState(): void {
  messages = []
  messagesContainer.innerHTML = ""
}

const messagesContainer = document.getElementById("messages")!
const messageInput = document.getElementById("messageInput") as HTMLDivElement
const sendButton = document.getElementById("sendButton") as HTMLButtonElement
const attachButton = document.getElementById("attachButton") as HTMLButtonElement
const undoButton = document.getElementById("undoButton") as HTMLButtonElement
const redoButton = document.getElementById("redoButton") as HTMLButtonElement
const fileSuggestions = document.getElementById("fileSuggestions")!
const agentSelect = document.getElementById("agentSelect") as HTMLSelectElement
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement

let messages: any[] = []
let currentSessionId: string | null = null
let currentSessionTitle: string | null = null
let canUndo = false
let canRedo = false

// Track current mention state for file suggestions
let currentMention: { startOffset: number; searchTerm: string; textBefore: string; savedRange: Range } | null = null

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
  console.log("[renderMessage] Rendering message:", message.id, "role:", message.role)
  
  // Check if we should merge this message with the previous one
  // Note: When called from init, messages array is already merged, so we check the DOM instead
  const lastMsgEl = messagesContainer.lastElementChild as HTMLElement
  const isLastAssistant = lastMsgEl && lastMsgEl.classList.contains("assistant")
  
  const shouldMerge = isLastAssistant && message.role === "assistant"

  console.log("[renderMessage] shouldMerge:", shouldMerge, "isLastAssistant:", isLastAssistant)

  let messageDiv: HTMLElement
  let contentDiv: HTMLElement

  if (shouldMerge) {
    messageDiv = lastMsgEl
    contentDiv = messageDiv.querySelector(".message-content") as HTMLElement
    // Update the ID to the latest one so subsequent parts can find it
    messageDiv.setAttribute("data-message-id", message.id)
    console.log("[renderMessage] Merged into existing element, new ID:", message.id)
  } else {
    console.log("[renderMessage] Creating new message element...")
    messageDiv = createMessageElement(message)
    contentDiv = messageDiv.querySelector(".message-content") as HTMLElement
    messagesContainer.appendChild(messageDiv)
  }

  message.parts.forEach((part: any) => {
    if (part.type === "text") {
      const textDiv = renderTextPart(getPartContent(part))
      textDiv.setAttribute("data-part-id", part.id || "")
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

  // Add message actions (undo button) for user messages
  if (message.role === "user" && currentSessionId && !currentSessionId.startsWith("temp_")) {
    const actionsDiv = document.createElement("div")
    actionsDiv.className = "message-actions"

    const undoBtn = document.createElement("button")
    undoBtn.className = "message-action-btn"
    undoBtn.innerHTML = "↩️ Undo from here"
    undoBtn.title = "Revert session to before this message"
    undoBtn.addEventListener("click", () => {
      console.log(`[Message Undo] Reverting from user message: ${message.id}`)
      postMessage({
        type: "revert",
        sessionId: currentSessionId,
        messageId: message.id
      })
      undoButton.disabled = true
      redoButton.disabled = true
    })

    actionsDiv.appendChild(undoBtn)
    contentDiv.appendChild(actionsDiv)
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

function createMessageElement(message: any): HTMLElement {
  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${message.role}`
  messageDiv.setAttribute("data-message-id", message.id)

  const headerDiv = document.createElement("div")
  headerDiv.className = "message-header"
  
  const iconSpan = document.createElement("span")
  iconSpan.className = "message-icon"
  iconSpan.textContent = message.role === "user" ? "👤" : "🤖"
  
  const roleSpan = document.createElement("span")
  roleSpan.className = "message-role"
  if (message.role === "user") {
    roleSpan.textContent = "You"
  } else {
    // Use agent name if available, otherwise default to OpenCode
    const agentName = agentSelect.value || "OpenCode"
    roleSpan.textContent = agentName.charAt(0).toUpperCase() + agentName.slice(1)
  }
  
  headerDiv.appendChild(iconSpan)
  headerDiv.appendChild(roleSpan)
  messageDiv.appendChild(headerDiv)

  const contentDiv = document.createElement("div")
  contentDiv.className = "message-content"
  messageDiv.appendChild(contentDiv)

  return messageDiv
}

function renderTextPart(text: string): HTMLElement {
  const div = document.createElement("div")
  div.className = "message-text"
  div.innerHTML = marked.parse(text) as string
  return div
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
  label.className = "reasoning-header"
  label.innerHTML = `<span class="reasoning-icon">🧠</span> 思考过程 <span class="collapse-icon">▼</span>`
  reasoningDiv.appendChild(label)

  const textDiv = document.createElement("div")
  textDiv.className = "reasoning-content"

  if (content && typeof content === "object" && content.html) {
    textDiv.innerHTML = content.html
  } else {
    textDiv.innerHTML = marked.parse(getPartContent({ content })) as string
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
  console.log("[updateMessagePart] messageId:", messageId, "partId:", partId)
  const message = messages.find((m) => m.id === messageId)
  if (!message) {
    console.log("[updateMessagePart] Message not found in local array:", messageId)
    return
  }

  const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`)
  if (!messageEl) {
    console.log("[updateMessagePart] Message element not found in DOM:", messageId)
    return
  }
  const contentDiv = messageEl.querySelector(".message-content")
  if (!contentDiv) return

  let existingPart = message.parts.find((p: any) => p.id === partId || (p.content && p.content.id === partId))

  if (existingPart) {
    Object.assign(existingPart, part)
    if (part.type === "reasoning") {
      const reasoningEl = contentDiv.querySelector(`.reasoning-container[data-part-id="${partId}"]`) as HTMLElement
      if (reasoningEl) {
        const textDiv = reasoningEl.querySelector(".reasoning-content") as HTMLElement
        if (textDiv) {
          if (part.content && typeof part.content === "object" && part.content.html) {
            textDiv.innerHTML = part.content.html
          } else {
            textDiv.innerHTML = marked.parse(getPartContent(part)) as string
          }
          reasoningEl.scrollTop = reasoningEl.scrollHeight
        }
      }
    } else if (part.type === "text") {
      const textEl = contentDiv.querySelector(`.message-text[data-part-id="${partId}"]`) as HTMLElement
      if (textEl) {
        textEl.innerHTML = marked.parse(getPartContent(part)) as string
      }
    }
  } else {
    message.parts.push(part)
    if (part.type === "reasoning") {
      const reasoningDiv = document.createElement("div")
      reasoningDiv.className = "reasoning-container"
      reasoningDiv.setAttribute("data-part-id", partId)
      reasoningDiv.setAttribute("data-collapsed", "true")
      
      const label = document.createElement("div")
      label.className = "reasoning-header"
      label.innerHTML = `<span class="reasoning-icon">🧠</span> 思考过程 <span class="collapse-icon">▼</span>`
      reasoningDiv.appendChild(label)

      const textDiv = document.createElement("div")
      textDiv.className = "reasoning-content"
      if (part.content && typeof part.content === "object" && part.content.html) {
        textDiv.innerHTML = part.content.html
      } else {
        textDiv.innerHTML = marked.parse(getPartContent(part)) as string
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
          <pre class="tool-command">${escapeHtml(toolInput.command || toolInput.description || toolInput.location || "")}</pre>
        </div>
    `
  }
  
  if (stateStatus === "error" && error) {
    if (shouldRenderCommandOutput) {
      html += `
        <div class="tool-output-section" data-collapsed="true">
          <div class="output-toggle" onclick="toggleToolSection(this)">
            <span class="tool-output-label">Error</span>
            <span class="toggle-icon">▶</span>
          </div>
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
    html += `
      <div class="tool-output-section" data-collapsed="true">
        <div class="output-toggle" onclick="toggleToolSection(this)">
          <span class="tool-output-label">Output</span>
          <span class="toggle-icon">▶</span>
        </div>
        <pre class="tool-output">${escapeHtml(output)}</pre>
      </div>
    `
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
      section.setAttribute("data-collapsed", "false")
    } else {
      section.setAttribute("data-collapsed", "true")
    }
    
    const newState = section.getAttribute("data-collapsed") === "true"
    console.log("[toggleToolSection] New state:", newState)
    
    const icon = toggle.querySelector(".toggle-icon") as HTMLElement
    if (icon) {
      icon.textContent = newState ? "▶" : "▼"
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

      const rawMessages = message.messages || []
      console.log("[init] Processing", rawMessages.length, "raw messages")
      
      // Process messages to merge consecutive assistant messages
      const processedMessages: any[] = []
      rawMessages.forEach((msg: any) => {
        const lastMsg = processedMessages[processedMessages.length - 1]
        if (lastMsg && lastMsg.role === "assistant" && msg.role === "assistant") {
          lastMsg.parts = [...(lastMsg.parts || []), ...(msg.parts || [])]
          lastMsg.id = msg.id // Keep the latest ID
        } else {
          processedMessages.push({ ...msg })
        }
      })

      messages = processedMessages
      messagesContainer.innerHTML = ""
      messages.forEach(renderMessage)

      console.log("[init] Initialized with", messages.length, "messages, sessionId:", currentSessionId)

      // Enable undo if there are messages and it's a real session
      canUndo = messages.length > 0 && !!currentSessionId && !currentSessionId.startsWith("temp_")
      canRedo = false // Reset redo state on init
      updateUndoRedoButtons()

      if (currentSessionId) {
        console.log("[init] Focusing input for session:", currentSessionId)
        messageInput.innerHTML = ""
        messageInput.focus()
      }
      break

    case "message":
      if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
        break
      }
      
      // Check if we should merge this message into the previous one in the messages array
      const lastMsg = messages[messages.length - 1]
      const shouldMerge = lastMsg && 
                        lastMsg.role === "assistant" && 
                        message.role === "assistant"

      console.log("[Webview] Received message, shouldMerge:", shouldMerge)

      renderMessage(message)

      if (shouldMerge) {
        // Merge parts into the last message
        lastMsg.parts = [...(lastMsg.parts || []), ...(message.parts || [])]
        // Update the ID to the latest one
        lastMsg.id = message.id
      } else {
        messages.push(message)
      }

      // Enable undo when new message arrives
      if (currentSessionId && !currentSessionId.startsWith("temp_")) {
        canUndo = true
        canRedo = false // New message clears redo history
        updateUndoRedoButtons()
      }
      break

    case "messagePart":
      if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
        break
      }
      console.log("[Webview] Received messagePart:", message.messageId, "partId:", message.partId || message.part?.id)
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
      currentMention = null
      break

    case "serverStatus":
      updateSelectors(message.agents || [], message.models || [])
      break

    case "revertSuccess":
      console.log("[Webview] Revert successful", message)
      
      // Clear current messages display
      messagesContainer.innerHTML = ""
      
      // Update local messages array to remaining messages
      if (message.remainingMessages) {
        messages = message.remainingMessages
      }
      
      // Re-render all remaining messages
      messages.forEach(renderMessage)
      
      // Restore user message to input box for editing
      if (message.userMessageToRestore) {
        messageInput.innerHTML = ""
        insertText(message.userMessageToRestore)
        messageInput.focus()
      }
      
      canUndo = messages.length > 0
      canRedo = true
      updateUndoRedoButtons()
      break

    case "unrevertSuccess":
      console.log("[Webview] Unrevert (redo) successful", message)
      
      // Clear current messages display
      messagesContainer.innerHTML = ""
      
      // Update local messages array to all messages
      if (message.allMessages) {
        messages = message.allMessages
      }
      
      // Re-render all messages
      messages.forEach(renderMessage)
      
      // Clear input box on redo (since we're restoring the conversation)
      messageInput.innerHTML = ""
      
      canUndo = true
      canRedo = false
      updateUndoRedoButtons()
      break

    case "error":
      console.error("[Webview] Error:", message.error)
      // Re-enable buttons on error
      updateUndoRedoButtons()
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
      insertFileMention(suggestion.path, suggestion.lineRange)
      fileSuggestions.hidden = true
      currentMention = null
      messageInput.focus()
    })
    fileSuggestions.appendChild(div)
  })

  fileSuggestions.hidden = false
}

function insertFileMention(path: string, lineRange?: string): void {
  // Use the saved range from currentMention if available
  // This is crucial because when clicking on a suggestion, the focus/selection changes
  let range: Range | null = null
  
  if (currentMention?.savedRange) {
    // Clone the saved range to avoid modifying the original
    range = currentMention.savedRange.cloneRange()
  } else {
    // Fallback to current selection
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    range = selection.getRangeAt(0)
  }
  
  if (!range) return
  
  // Restore focus to messageInput first
  messageInput.focus()
  
  // Delete the @searchTerm text before inserting
  // Use the saved startOffset from currentMention
  if (currentMention) {
    const deleteRange = document.createRange()
    
    // Find the text node containing the @ symbol using the saved startOffset
    let currentOffset = 0
    let startNode: Text | null = null
    let startOffsetInNode = 0
    
    const walker = document.createTreeWalker(messageInput, NodeFilter.SHOW_TEXT, null)
    let textNode: Text | null = null
    
    while (textNode = walker.nextNode() as Text) {
      const nodeLength = textNode.textContent?.length || 0
      if (currentOffset <= currentMention.startOffset && currentMention.startOffset < currentOffset + nodeLength) {
        startNode = textNode
        startOffsetInNode = currentMention.startOffset - currentOffset
        break
      }
      currentOffset += nodeLength
    }
    
    if (startNode) {
      deleteRange.setStart(startNode, startOffsetInNode)
      deleteRange.setEnd(range.endContainer, range.endOffset)
      deleteRange.deleteContents()
    }
  }

  // Create the file mention element
  const mentionSpan = document.createElement("span")
  mentionSpan.className = "file-mention"
  mentionSpan.setAttribute("data-path", path)
  mentionSpan.setAttribute("contenteditable", "false")
  mentionSpan.setAttribute("tabindex", "-1")
  
  const pathText = document.createTextNode(`@${path}`)
  mentionSpan.appendChild(pathText)
  
  if (lineRange) {
    const rangeSpan = document.createElement("span")
    rangeSpan.className = "line-range"
    rangeSpan.textContent = lineRange
    mentionSpan.appendChild(rangeSpan)
  }

  // Get the current selection after deletion and focus restoration
  const newSelection = window.getSelection()
  if (newSelection && newSelection.rangeCount > 0) {
    const newRange = newSelection.getRangeAt(0)
    
    // Insert the mention
    newRange.insertNode(mentionSpan)
    
    // Move cursor after the mention and add a space
    newRange.setStartAfter(mentionSpan)
    newRange.setEndAfter(mentionSpan)
    
    // Add a space after the mention
    const spaceNode = document.createTextNode(" ")
    newRange.insertNode(spaceNode)
    
    // Move cursor after the space
    newRange.setStartAfter(spaceNode)
    newRange.setEndAfter(spaceNode)
    
    newSelection.removeAllRanges()
    newSelection.addRange(newRange)
  }
  
  // Add click handler to select the entire mention
  mentionSpan.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    selectMention(mentionSpan)
  })
}

function getOffsetOfNode(node: Node): number {
  let offset = 0
  const walker = document.createTreeWalker(messageInput, NodeFilter.SHOW_TEXT, null)
  let currentNode: Text | null = null
  while (currentNode = walker.nextNode() as Text) {
    if (currentNode === node) {
      return offset
    }
    offset += currentNode.textContent?.length || 0
  }
  return offset
}

function getCursorPosition(): number {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return 0
  
  const range = selection.getRangeAt(0)
  let position = 0
  
  const walker = document.createTreeWalker(messageInput, NodeFilter.SHOW_TEXT, null)
  let textNode: Text | null = null
  while (textNode = walker.nextNode() as Text) {
    if (textNode === range.startContainer) {
      return position + range.startOffset
    }
    position += textNode.textContent?.length || 0
  }
  return position
}

function selectMention(mentionSpan: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) return
  
  const range = document.createRange()
  range.selectNode(mentionSpan)
  selection.removeAllRanges()
  selection.addRange(range)
  
  // Add visual selection class
  mentionSpan.classList.add("selected")
  
  // Remove selection class when clicking elsewhere
  const removeSelection = (e: Event) => {
    if (!mentionSpan.contains(e.target as Node)) {
      mentionSpan.classList.remove("selected")
      document.removeEventListener("click", removeSelection)
    }
  }
  
  setTimeout(() => {
    document.addEventListener("click", removeSelection)
  }, 0)
}

// Add global double-click handler for file mentions
messageInput.addEventListener("dblclick", (e) => {
  const target = e.target as HTMLElement
  const mentionElement = findMentionElement(target)
  if (mentionElement) {
    e.preventDefault()
    e.stopPropagation()
    selectMention(mentionElement)
  }
})

function getTextNodeAtOffset(root: Node, offset: number): Text | null {
  let currentOffset = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  
  let textNode: Text | null = null
  while (textNode = walker.nextNode() as Text) {
    const nodeLength = textNode.textContent?.length || 0
    if (currentOffset + nodeLength >= offset) {
      return textNode
    }
    currentOffset += nodeLength
  }
  
  return null
}

function insertText(text: string): void {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) {
    // Check if the text is a file mention (starts with @ and looks like a path)
    const fileMentionMatch = text.match(/^@([^\s]+)(\s*)$/)
    if (fileMentionMatch) {
      const path = fileMentionMatch[1]
      const trailingSpace = fileMentionMatch[2]
      insertFileMentionAtEnd(path)
      if (trailingSpace) {
        messageInput.appendChild(document.createTextNode(trailingSpace))
      }
    } else {
      messageInput.innerHTML += escapeHtml(text)
    }
    return
  }

  const range = selection.getRangeAt(0)
  
  // Check if the text is a file mention (starts with @ and looks like a path)
  const fileMentionMatch = text.match(/^@([^\s]+)(\s*)$/)
  if (fileMentionMatch) {
    const path = fileMentionMatch[1]
    const trailingSpace = fileMentionMatch[2]
    
    // Create the file mention element
    const mentionSpan = document.createElement("span")
    mentionSpan.className = "file-mention"
    mentionSpan.setAttribute("data-path", path)
    mentionSpan.setAttribute("contenteditable", "false")
    mentionSpan.setAttribute("tabindex", "-1")
    
    const pathText = document.createTextNode(`@${path}`)
    mentionSpan.appendChild(pathText)
    
    // Insert the mention
    range.insertNode(mentionSpan)
    
    // Move cursor after the mention
    range.setStartAfter(mentionSpan)
    range.setEndAfter(mentionSpan)
    
    // Add trailing space if present
    if (trailingSpace) {
      const spaceNode = document.createTextNode(trailingSpace)
      range.insertNode(spaceNode)
      range.setStartAfter(spaceNode)
      range.setEndAfter(spaceNode)
    }
    
    selection.removeAllRanges()
    selection.addRange(range)
    
    // Add click handler to select the entire mention
    mentionSpan.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      selectMention(mentionSpan)
    })
  } else {
    // Regular text insertion
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

function insertFileMentionAtEnd(path: string, lineRange?: string): void {
  // Create the file mention element
  const mentionSpan = document.createElement("span")
  mentionSpan.className = "file-mention"
  mentionSpan.setAttribute("data-path", path)
  mentionSpan.setAttribute("contenteditable", "false")
  mentionSpan.setAttribute("tabindex", "-1")
  
  const pathText = document.createTextNode(`@${path}`)
  mentionSpan.appendChild(pathText)
  
  if (lineRange) {
    const rangeSpan = document.createElement("span")
    rangeSpan.className = "line-range"
    rangeSpan.textContent = lineRange
    mentionSpan.appendChild(rangeSpan)
  }
  
  // Append to messageInput
  messageInput.appendChild(mentionSpan)
  
  // Add click handler to select the entire mention
  mentionSpan.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    selectMention(mentionSpan)
  })
}

sendButton.addEventListener("click", sendMessage)
attachButton.addEventListener("click", () => {
  postMessage({
    type: "attachFile"
  })
})

undoButton.addEventListener("click", () => {
  if (!currentSessionId || currentSessionId.startsWith("temp_")) {
    console.warn("[Undo] Cannot undo: no active session or placeholder session")
    return
  }
  
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) {
    console.warn("[Undo] No messages to undo")
    return
  }
  
  console.log(`[Undo] Reverting to message: ${lastMessage.id}`)
  postMessage({
    type: "revert",
    sessionId: currentSessionId,
    messageId: lastMessage.id
  })
  
  undoButton.disabled = true
  redoButton.disabled = true
})

redoButton.addEventListener("click", () => {
  if (!currentSessionId || currentSessionId.startsWith("temp_")) {
    console.warn("[Redo] Cannot redo: no active session or placeholder session")
    return
  }
  
  console.log(`[Redo] Unreverting session: ${currentSessionId}`)
  postMessage({
    type: "unrevert",
    sessionId: currentSessionId
  })
  
  undoButton.disabled = true
  redoButton.disabled = true
})

function updateUndoRedoButtons(): void {
  undoButton.disabled = !canUndo || !currentSessionId || currentSessionId.startsWith("temp_") || messages.length === 0
  redoButton.disabled = !canRedo || !currentSessionId || currentSessionId.startsWith("temp_")
}

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
    return
  }

  // Handle Ctrl+Z for undo
  if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    if (!undoButton.disabled) {
      undoButton.click()
    }
    return
  }

  // Handle Ctrl+Y or Ctrl+Shift+Z for redo
  if ((e.key === "y" && (e.ctrlKey || e.metaKey)) ||
      (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
    e.preventDefault()
    if (!redoButton.disabled) {
      redoButton.click()
    }
    return
  }

  // Handle Backspace and Delete for file mentions
  if (e.key === "Backspace") {
    handleBackspace(e)
  } else if (e.key === "Delete") {
    handleDelete(e)
  }
})

function handleBackspace(e: KeyboardEvent): void {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return
  
  const range = selection.getRangeAt(0)
  
  // First check if there's a selected mention (not collapsed selection)
  if (!range.collapsed) {
    // Check if the selection contains or is within a file mention
    const container = range.commonAncestorContainer
    const mentionElement = findMentionElement(container)
    if (mentionElement) {
      e.preventDefault()
      mentionElement.remove()
      return
    }
    return
  }
  
  // Check if cursor is immediately after a file mention
  let nodeBefore = range.startContainer.previousSibling
  
  // If we're at the start of a text node, check the previous sibling
  if (range.startOffset === 0 && range.startContainer !== messageInput) {
    nodeBefore = range.startContainer.previousSibling
  }
  
  // Check if the previous sibling is a file mention
  if (nodeBefore && (nodeBefore as HTMLElement).classList?.contains("file-mention")) {
    e.preventDefault()
    nodeBefore.remove()
    return
  }
  
  // Check if we're inside a file mention (shouldn't happen with contenteditable="false", but just in case)
  const parent = range.startContainer.parentElement
  if (parent && parent.classList?.contains("file-mention")) {
    e.preventDefault()
    parent.remove()
  }
}

function handleDelete(e: KeyboardEvent): void {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return
  
  const range = selection.getRangeAt(0)
  
  // First check if there's a selected mention (not collapsed selection)
  if (!range.collapsed) {
    // Check if the selection contains or is within a file mention
    const container = range.commonAncestorContainer
    const mentionElement = findMentionElement(container)
    if (mentionElement) {
      e.preventDefault()
      mentionElement.remove()
      return
    }
    return
  }
  
  // Check if cursor is immediately before a file mention
  let nodeAfter = range.startContainer.nextSibling
  
  // If we're at the end of a text node, check the next sibling
  const textLength = range.startContainer.textContent?.length || 0
  if (range.startOffset >= textLength && range.startContainer !== messageInput) {
    nodeAfter = range.startContainer.nextSibling
  }
  
  // Check if the next sibling is a file mention
  if (nodeAfter && (nodeAfter as HTMLElement).classList?.contains("file-mention")) {
    e.preventDefault()
    nodeAfter.remove()
    return
  }
  
  // Check if we're inside a file mention (shouldn't happen with contenteditable="false", but just in case)
  const parent = range.startContainer.parentElement
  if (parent && parent.classList?.contains("file-mention")) {
    e.preventDefault()
    parent.remove()
  }
}

function findMentionElement(node: Node): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== messageInput) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement
      if (el.classList?.contains("file-mention")) {
        return el
      }
    }
    current = current.parentNode
  }
  return null
}

function sendMessage(): void {
  const text = getMessageText().trim()
  if (!text) return

  postMessage({
    type: "sendMessage",
    text
  })

  messageInput.innerHTML = ""
  sendButton.disabled = true
  setTimeout(() => {
    sendButton.disabled = false
  }, 500)
}

function getMessageText(): string {
  let text = ""
  
  const walker = document.createTreeWalker(messageInput, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null)
  
  let node: Node | null = null
  while (node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.classList.contains("file-mention")) {
        const path = el.getAttribute("data-path")
        const lineRange = el.querySelector(".line-range")?.textContent || ""
        if (path) {
          text += `@${path}${lineRange}`
        }
      } else if (el.tagName === "BR") {
        text += "\n"
      } else if (el.tagName === "DIV") {
        // Handle div elements (new lines in contenteditable)
        if (text && !text.endsWith("\n")) {
          text += "\n"
        }
      }
    }
  }
  
  return text
}

messageInput.addEventListener("input", (e) => {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) {
    fileSuggestions.hidden = true
    currentMention = null
    return
  }
  
  const range = selection.getRangeAt(0)
  const textContent = messageInput.textContent || ""
  
  // Get the text before the cursor
  let textBeforeCursor = ""
  const preRange = document.createRange()
  preRange.setStart(messageInput, 0)
  preRange.setEnd(range.endContainer, range.endOffset)
  textBeforeCursor = preRange.toString()
  
  // Check for mention pattern
  const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/)
  
  if (mentionMatch) {
    const searchTerm = mentionMatch[1]
    const startOffset = textBeforeCursor.length - mentionMatch[0].length
    
    // Save the current range for later use when inserting
    const savedRange = range.cloneRange()
    
    currentMention = {
      startOffset,
      searchTerm,
      textBefore: textBeforeCursor.substring(0, startOffset),
      savedRange
    }
    
    postMessage({
      type: "requestFileSuggestions",
      searchTerm
    })
  } else {
    fileSuggestions.hidden = true
    currentMention = null
  }
})

document.addEventListener("click", (e) => {
  if (!fileSuggestions.contains(e.target as Node)) {
    fileSuggestions.hidden = true
    currentMention = null
  }
})
