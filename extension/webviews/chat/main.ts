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

// 当前 session 的 agent 名称
let currentAgentName = "OpenCode"

function resetState(): void {
  messages = []
  messagesContainer.innerHTML = ""
  currentAgentName = "OpenCode"
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
  currentAgentName = agentSelect.value || "OpenCode"
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
  const lastMsgEl = messagesContainer.lastElementChild as HTMLElement
  const isLastAssistant = lastMsgEl && lastMsgEl.classList.contains("assistant")
  
  const shouldMerge = isLastAssistant && message.role === "assistant"

  console.log("[renderMessage] shouldMerge:", shouldMerge, "isLastAssistant:", isLastAssistant)

  let messageDiv: HTMLElement
  let contentDiv: HTMLElement

  if (shouldMerge) {
    messageDiv = lastMsgEl
    contentDiv = messageDiv.querySelector(".message-content") as HTMLElement
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

  // Add message actions for user messages
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

  // 添加 Agent Header (仅 assistant 消息)
  if (message.role === "assistant") {
    const agentHeader = document.createElement("div")
    agentHeader.className = "agent-header"
    
    const iconSpan = document.createElement("span")
    iconSpan.className = "agent-icon"
    iconSpan.textContent = getAgentIcon(currentAgentName)
    
    const nameSpan = document.createElement("span")
    nameSpan.className = "agent-name"
    // 使用消息中的 agent 名称或当前选中的 agent
    const agentName = message.agent || currentAgentName || "OpenCode"
    nameSpan.textContent = formatAgentName(agentName)
    
    agentHeader.appendChild(iconSpan)
    agentHeader.appendChild(nameSpan)
    messageDiv.appendChild(agentHeader)
  }

  const contentDiv = document.createElement("div")
  contentDiv.className = "message-content"
  messageDiv.appendChild(contentDiv)

  return messageDiv
}

function formatAgentName(name: string): string {
  // 将 snake_case 或 camelCase 转换为显示名称
  if (name === "build") return "Build"
  if (name === "test") return "Test"
  if (name === "optimize") return "Optimize"
  if (name === "explain") return "Explain"
  if (name === "code") return "Code"
  if (name === "architect") return "Architect"
  if (name === "ask") return "Ask"
  if (name === "debug") return "Debug"
  // 首字母大写
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function getAgentIcon(agentName: string): string {
  const icons: Record<string, string> = {
    build: "🔨",
    test: "🧪",
    optimize: "⚡",
    explain: "📖",
    code: "💻",
    architect: "🏗️",
    ask: "❓",
    debug: "🐛",
    default: "🤖"
  }
  return icons[agentName.toLowerCase()] || icons.default
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

  const toggle = document.createElement("div")
  toggle.className = "reasoning-toggle"
  toggle.innerHTML = `<span>思考过程</span><span class="reasoning-toggle-icon">▼</span>`
  reasoningDiv.appendChild(toggle)

  const contentDiv = document.createElement("div")
  contentDiv.className = "reasoning-content"
  
  if (content && typeof content === "object" && content.html) {
    contentDiv.innerHTML = content.html
  } else {
    const contentText = getPartContent({ content })
    // 解析思考内容，支持多个 thought 步骤
    const thoughts = parseThoughts(contentText)
    if (thoughts.length > 0) {
      contentDiv.innerHTML = thoughts.map(t => `
        <div class="thought-item">
          <span class="thought-icon">💭</span>
          <div class="thought-content">${marked.parse(t)}</div>
        </div>
      `).join("")
    } else {
      contentDiv.innerHTML = marked.parse(contentText) as string
    }
  }

  reasoningDiv.appendChild(contentDiv)

  toggle.addEventListener("click", (e) => {
    const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true"
    reasoningDiv.setAttribute("data-collapsed", isCollapsed ? "false" : "true")
    e.stopPropagation()
  })

  container.appendChild(reasoningDiv)
  return reasoningDiv
}

function parseThoughts(content: string): string[] {
  // 尝试解析多个思考步骤
  // 支持 "Thought:" 或 "思考:" 或 "---" 分隔符
  const patterns = [
    /(?:Thought:|思考:|💭)\s*(.+?)(?=(?:Thought:|思考:|💭|$))/gs,
    /(?:^|\n)\s*[-=]{3,}\s*\n?/g
  ]
  
  // 先尝试按分隔符分割
  const parts = content.split(/(?:\n|^)\s*(?:Thought:|思考:|💭)\s*/).filter(p => p.trim())
  if (parts.length > 1) {
    return parts.map(p => p.trim())
  }
  
  // 如果没有明确分隔，返回整个内容
  return content.trim() ? [content] : []
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
            const contentText = getPartContent(part)
            const thoughts = parseThoughts(contentText)
            if (thoughts.length > 0) {
              textDiv.innerHTML = thoughts.map(t => `
                <div class="thought-item">
                  <span class="thought-icon">💭</span>
                  <div class="thought-content">${marked.parse(t)}</div>
                </div>
              `).join("")
            } else {
              textDiv.innerHTML = marked.parse(contentText) as string
            }
          }
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
      renderReasoningPart(getPartContent(part), contentDiv as HTMLElement)
    } else if (part.type === "tool" && part.content) {
      // Auto-collapse reasoning when tool appears
      contentDiv.querySelectorAll(".reasoning-container").forEach(r => r.setAttribute("data-collapsed", "true"))
      
      const toolDiv = renderToolExecution(part.content)
      toolDiv.setAttribute("data-part-id", partId)
      contentDiv.appendChild(toolDiv)
    } else if (part.type === "text") {
      contentDiv.querySelectorAll(".reasoning-container").forEach(r => r.setAttribute("data-collapsed", "true"))

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
    const toolHtml = constructToolHtml(content)
    div.innerHTML = toolHtml
    
    // 绑定输出折叠事件
    div.querySelectorAll(".tool-output-header").forEach(header => {
      header.addEventListener("click", () => {
        const container = header.parentElement as HTMLElement
        if (container) {
          const isCollapsed = container.getAttribute("data-collapsed") === "true"
          container.setAttribute("data-collapsed", isCollapsed ? "false" : "true")
        }
      })
    })
  } catch (error) {
    console.error("[renderToolExecution] Error rendering tool:", error, content)
    div.innerHTML = `<div class="tool-item">
      <div class="tool-header">
        <span class="tool-icon">⚠️</span>
        <span class="tool-name">Error rendering tool</span>
      </div>
      <div class="tool-output">${escapeHtml(String(content) || "Unknown error")}</div>
    </div>`
  }
  
  return div.firstElementChild as HTMLElement || div
}

function constructToolHtml(content: any): string {
  console.log("[constructToolHtml] Input content:", JSON.stringify(content, null, 2))
  
  const state = content.state || content
  
  const toolName = content.tool || content.toolName || content.toolData?.name || "Unknown Tool"
  
  const stateStatus = state?.status || content.status || "pending"
  const title = state?.title || content.title || ""
  const output = state?.output || content.output || ""
  const error = state?.error || content.error || ""
  const toolInput = state?.input || content.input || {}
  const autoRun = content.approval === "auto" || content.autoRun
  
  // 状态标签显示
  const statusLabels: Record<string, string> = {
    pending: "等待中",
    running: "运行中",
    completed: "已完成",
    error: "错误"
  }
  
  const icon = getToolIcon(toolName)
  const statusText = statusLabels[stateStatus] || stateStatus
  
  let html = `
    <div class="tool-item" data-state="${stateStatus}">
      <div class="tool-header">
        <span class="tool-icon">${icon}</span>
        <span class="tool-name">${escapeHtml(title || toolName)}</span>
        <span class="tool-status ${stateStatus}">${statusText}</span>
      </div>
  `
  
  // 命令栏
  const command = toolInput?.command || toolInput?.cmd || toolInput?.description || toolInput?.location || ""
  if (command) {
    html += `
      <div class="tool-command-bar">
        <code class="tool-command">$ ${escapeHtml(command)}</code>
        ${autoRun ? '<span class="tool-auto-run">⚡ 自动运行</span>' : ''}
      </div>
    `
  }
  
  // 输出区域
  if (output || error) {
    const displayOutput = error || output
    const label = error ? "错误" : "输出"
    
    html += `
      <div class="tool-output-container" data-collapsed="true">
        <div class="tool-output-header">
          <span>${label}</span>
          <span class="tool-output-toggle">▼</span>
        </div>
        <pre class="tool-output ${error ? 'tool-error' : ''}">${escapeHtml(displayOutput)}</pre>
      </div>
    `
  } else if (stateStatus === "pending") {
    html += `
      <div class="tool-output-container">
        <div class="tool-output" style="color: var(--vscode-descriptionForeground);">等待执行...</div>
      </div>
    `
  } else if (stateStatus === "running") {
    html += `
      <div class="tool-output-container">
        <div class="tool-output" style="color: var(--vscode-descriptionForeground);">执行中...</div>
      </div>
    `
  }
  
  html += `</div>`
  
  return html
}

function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    bash: "💻",
    shell: "💻",
    cmd: "💻",
    read: "📄",
    write: "📝",
    edit: "✏️",
    search: "🔍",
    glob: "🔍",
    grep: "🔎",
    webfetch: "🌐",
    websearch: "🔍",
    codesearch: "🔍",
    task: "🔧",
    question: "❓",
    file: "📁",
    dir: "📂",
    folder: "📂",
    default: "🔧"
  }
  return icons[toolName.toLowerCase()] || icons.default
}

function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

window.addEventListener("message", (event) => {
  const message = event.data
  console.log("[Webview] Received message type:", message.type)

  switch (message.type) {
    case "init":
      console.log("[init] Switching to session:", message.sessionId, "Previous:", currentSessionId)
      currentSessionId = message.sessionId || null
      currentSessionTitle = message.sessionTitle || "New Session"
      
      // 更新 agent 名称
      if (message.agent) {
        currentAgentName = message.agent
      }
      
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
          lastMsg.id = msg.id
          if (msg.agent) lastMsg.agent = msg.agent
        } else {
          processedMessages.push({ ...msg })
        }
      })

      messages = processedMessages
      messagesContainer.innerHTML = ""
      messages.forEach(renderMessage)

      console.log("[init] Initialized with", messages.length, "messages, sessionId:", currentSessionId)

      canUndo = messages.length > 0 && !!currentSessionId && !currentSessionId.startsWith("temp_")
      canRedo = false
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
      
      if (message.agent) {
        currentAgentName = message.agent
      }
      
      const lastMsg = messages[messages.length - 1]
      const shouldMerge = lastMsg && 
                        lastMsg.role === "assistant" && 
                        message.role === "assistant"

      console.log("[Webview] Received message, shouldMerge:", shouldMerge)

      renderMessage(message)

      if (shouldMerge) {
        lastMsg.parts = [...(lastMsg.parts || []), ...(message.parts || [])]
        lastMsg.id = message.id
        if (message.agent) lastMsg.agent = message.agent
      } else {
        messages.push(message)
      }

      if (currentSessionId && !currentSessionId.startsWith("temp_")) {
        canUndo = true
        canRedo = false
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
      
      messagesContainer.innerHTML = ""
      
      if (message.remainingMessages) {
        messages = message.remainingMessages
      }
      
      messages.forEach(renderMessage)
      
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
      
      messagesContainer.innerHTML = ""
      
      if (message.allMessages) {
        messages = message.allMessages
      }
      
      messages.forEach(renderMessage)
      
      messageInput.innerHTML = ""
      
      canUndo = true
      canRedo = false
      updateUndoRedoButtons()
      break

    case "error":
      console.error("[Webview] Error:", message.error)
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
    option.textContent = formatAgentName(agent)
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
  let range: Range | null = null
  
  if (currentMention?.savedRange) {
    range = currentMention.savedRange.cloneRange()
  } else {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    range = selection.getRangeAt(0)
  }
  
  if (!range) return
  
  messageInput.focus()
  
  if (currentMention) {
    const deleteRange = document.createRange()
    
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
      
      range.setStart(deleteRange.startContainer, deleteRange.startOffset)
      range.setEnd(deleteRange.startContainer, deleteRange.startOffset)
    }
  }

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

  range.insertNode(mentionSpan)
  
  range.setStartAfter(mentionSpan)
  range.setEndAfter(mentionSpan)
  
  const spaceNode = document.createTextNode(" ")
  range.insertNode(spaceNode)
  
  range.setStartAfter(spaceNode)
  range.setEndAfter(spaceNode)
  
  const newSelection = window.getSelection()
  if (newSelection) {
    newSelection.removeAllRanges()
    newSelection.addRange(range)
  }
  
  mentionSpan.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    selectMention(mentionSpan)
  })
}

function selectMention(mentionSpan: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) return
  
  const range = document.createRange()
  range.selectNode(mentionSpan)
  selection.removeAllRanges()
  selection.addRange(range)
  
  mentionSpan.classList.add("selected")
  
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

messageInput.addEventListener("dblclick", (e) => {
  const target = e.target as HTMLElement
  const mentionElement = findMentionElement(target)
  if (mentionElement) {
    e.preventDefault()
    e.stopPropagation()
    selectMention(mentionElement)
  }
})

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

function insertText(text: string): void {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) {
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
  
  const fileMentionMatch = text.match(/^@([^\s]+)(\s*)$/)
  if (fileMentionMatch) {
    const path = fileMentionMatch[1]
    const trailingSpace = fileMentionMatch[2]
    
    const mentionSpan = document.createElement("span")
    mentionSpan.className = "file-mention"
    mentionSpan.setAttribute("data-path", path)
    mentionSpan.setAttribute("contenteditable", "false")
    mentionSpan.setAttribute("tabindex", "-1")
    
    const pathText = document.createTextNode(`@${path}`)
    mentionSpan.appendChild(pathText)
    
    range.insertNode(mentionSpan)
    
    range.setStartAfter(mentionSpan)
    range.setEndAfter(mentionSpan)
    
    if (trailingSpace) {
      const spaceNode = document.createTextNode(trailingSpace)
      range.insertNode(spaceNode)
      range.setStartAfter(spaceNode)
      range.setEndAfter(spaceNode)
    }
    
    selection.removeAllRanges()
    selection.addRange(range)
    
    mentionSpan.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      selectMention(mentionSpan)
    })
  } else {
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

function insertFileMentionAtEnd(path: string, lineRange?: string): void {
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
  
  messageInput.appendChild(mentionSpan)
  
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

  if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    if (!undoButton.disabled) {
      undoButton.click()
    }
    return
  }

  if ((e.key === "y" && (e.ctrlKey || e.metaKey)) ||
      (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
    e.preventDefault()
    if (!redoButton.disabled) {
      redoButton.click()
    }
    return
  }

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
  
  if (!range.collapsed) {
    const container = range.commonAncestorContainer
    const mentionElement = findMentionElement(container)
    if (mentionElement) {
      e.preventDefault()
      mentionElement.remove()
      return
    }
    return
  }
  
  let nodeBefore: Node | null = null
  
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    if (range.startOffset === 0) {
      nodeBefore = range.startContainer.previousSibling
    }
  } else if (range.startContainer === messageInput) {
    nodeBefore = messageInput.childNodes[range.startOffset - 1] || null
  }
  
  if (nodeBefore && nodeBefore.nodeType === Node.ELEMENT_NODE && (nodeBefore as HTMLElement).classList?.contains("file-mention")) {
    e.preventDefault()
    ;(nodeBefore as HTMLElement).remove()
    return
  }
  
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
  
  if (!range.collapsed) {
    const container = range.commonAncestorContainer
    const mentionElement = findMentionElement(container)
    if (mentionElement) {
      e.preventDefault()
      mentionElement.remove()
      return
    }
    return
  }
  
  let nodeAfter = range.startContainer.nextSibling
  
  const textLength = range.startContainer.textContent?.length || 0
  if (range.startOffset >= textLength && range.startContainer !== messageInput) {
    nodeAfter = range.startContainer.nextSibling
  }
  
  if (nodeAfter && (nodeAfter as HTMLElement).classList?.contains("file-mention")) {
    e.preventDefault()
    nodeAfter.remove()
    return
  }
  
  const parent = range.startContainer.parentElement
  if (parent && parent.classList?.contains("file-mention")) {
    e.preventDefault()
    parent.remove()
  }
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
  
  let textBeforeCursor = ""
  const selectionForOffset = window.getSelection()
  if (selectionForOffset && selectionForOffset.rangeCount > 0) {
    const rangeForOffset = selectionForOffset.getRangeAt(0)
    const preRange = document.createRange()
    preRange.setStart(messageInput, 0)
    preRange.setEnd(rangeForOffset.endContainer, rangeForOffset.endOffset)
    textBeforeCursor = preRange.toString()
  }
  
  const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/)
  
  if (mentionMatch) {
    const searchTerm = mentionMatch[1]
    const startOffset = textBeforeCursor.length - mentionMatch[0].length
    
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
