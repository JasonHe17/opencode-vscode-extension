(() => {
  // webviews/chat/main.ts
  var vscodeApi = acquireVsCodeApi();
  function resetState() {
    messages = [];
    messagesContainer.innerHTML = "";
  }
  var messagesContainer = document.getElementById("messages");
  var messageInput = document.getElementById("messageInput");
  var sendButton = document.getElementById("sendButton");
  var attachButton = document.getElementById("attachButton");
  var undoButton = document.getElementById("undoButton");
  var redoButton = document.getElementById("redoButton");
  var fileSuggestions = document.getElementById("fileSuggestions");
  var agentSelect = document.getElementById("agentSelect");
  var modelSelect = document.getElementById("modelSelect");
  var messages = [];
  var currentSessionId = null;
  var currentSessionTitle = null;
  var canUndo = false;
  var canRedo = false;
  var currentMention = null;
  agentSelect.addEventListener("change", () => {
    postMessage({
      type: "changeAgent",
      agent: agentSelect.value
    });
  });
  modelSelect.addEventListener("change", () => {
    postMessage({
      type: "changeModel",
      model: modelSelect.value
    });
  });
  function postMessage(message) {
    vscodeApi.postMessage(message);
  }
  function renderMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${message.role}`;
    messageDiv.setAttribute("data-message-id", message.id);
    const roleDiv = document.createElement("div");
    roleDiv.className = "message-role";
    roleDiv.textContent = message.role === "user" ? "You" : "OpenCode";
    messageDiv.appendChild(roleDiv);
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    messageDiv.appendChild(contentDiv);
    message.parts.forEach((part) => {
      if (part.type === "text") {
        const textDiv = renderTextPart(getPartContent(part));
        textDiv.setAttribute("data-part-id", part.id || "");
        textDiv.className = "message-text";
        contentDiv.appendChild(textDiv);
      } else if (part.type === "tool") {
        console.log("[renderMessage] Rendering tool part:", part);
        const toolHtml = renderToolExecution(part.content || part);
        toolHtml.setAttribute("data-part-id", part.id || "");
        contentDiv.appendChild(toolHtml);
      } else if (part.type === "reasoning") {
        const reasoningDiv = renderReasoningPart(getPartContent(part), contentDiv);
        reasoningDiv.setAttribute("data-part-id", part.id || "");
      } else {
        console.log("[renderMessage] Unknown part type:", part.type, part);
      }
    });
    if (message.role === "user" && currentSessionId && !currentSessionId.startsWith("temp_")) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "message-actions";
      const undoBtn = document.createElement("button");
      undoBtn.className = "message-action-btn";
      undoBtn.innerHTML = "\u21A9\uFE0F Undo from here";
      undoBtn.title = "Revert session to before this message";
      undoBtn.addEventListener("click", () => {
        console.log(`[Message Undo] Reverting from user message: ${message.id}`);
        postMessage({
          type: "revert",
          sessionId: currentSessionId,
          messageId: message.id
        });
        undoButton.disabled = true;
        redoButton.disabled = true;
      });
      actionsDiv.appendChild(undoBtn);
      contentDiv.appendChild(actionsDiv);
    }
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  function renderTextPart(text) {
    const pre = document.createElement("div");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = text;
    return pre;
  }
  function getPartContent(part) {
    if (part?.content && typeof part.content === "string") return part.content;
    if (part?.text && typeof part.text === "string") return part.text;
    if (part?.content?.html && typeof part.content.html === "string") return part.content.html;
    return part?.content ? String(part.content) : "";
  }
  function renderReasoningPart(content, container) {
    const reasoningDiv = document.createElement("div");
    reasoningDiv.className = "reasoning-container";
    reasoningDiv.setAttribute("data-collapsed", "true");
    const label = document.createElement("div");
    label.className = "reasoning-label";
    label.innerHTML = `<span class="reasoning-icon">\u{1F9E0}</span> Thinking... <span class="collapse-icon">\u25BC</span>`;
    reasoningDiv.appendChild(label);
    const textDiv = document.createElement("div");
    textDiv.className = "reasoning-content";
    if (content && typeof content === "object" && content.html) {
      textDiv.innerHTML = content.html;
    } else if (typeof content === "string") {
      textDiv.textContent = content;
    } else if (typeof content === "number") {
      textDiv.textContent = String(content);
    }
    reasoningDiv.appendChild(textDiv);
    label.addEventListener("click", (e) => {
      const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true";
      if (isCollapsed) {
        reasoningDiv.setAttribute("data-collapsed", "false");
      } else {
        reasoningDiv.setAttribute("data-collapsed", "true");
      }
      updateCollapseIcon(reasoningDiv);
      e.stopPropagation();
    });
    container.appendChild(reasoningDiv);
    return reasoningDiv;
  }
  function updateCollapseIcon(reasoningDiv) {
    const icon = reasoningDiv.querySelector(".collapse-icon");
    if (icon) {
      const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true";
      icon.textContent = isCollapsed ? "\u25BC" : "\u25B2";
    }
  }
  function updateMessagePart(messageId, partId, part) {
    if (!partId) return;
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    const contentDiv = messageEl.querySelector(".message-content");
    if (!contentDiv) return;
    let existingPart = message.parts.find((p) => p.id === partId || p.content && p.content.id === partId);
    if (existingPart) {
      Object.assign(existingPart, part);
      if (part.type === "reasoning") {
        const reasoningEl = contentDiv.querySelector(`.reasoning-container[data-part-id="${partId}"]`);
        if (reasoningEl) {
          const textDiv = reasoningEl.querySelector(".reasoning-content");
          if (textDiv) {
            if (part.content && typeof part.content === "object" && part.content.html) {
              textDiv.innerHTML = part.content.html;
            } else if (typeof part.content === "string") {
              textDiv.textContent = part.content;
            } else if (typeof part.text === "string") {
              textDiv.textContent = part.text;
            }
            reasoningEl.scrollTop = reasoningEl.scrollHeight;
          }
        }
      } else if (part.type === "text") {
        const textEl = contentDiv.querySelector(`.message-text[data-part-id="${partId}"]`);
        if (textEl) {
          textEl.textContent = getPartContent(part);
        }
      }
    } else {
      message.parts.push(part);
      if (part.type === "reasoning") {
        const reasoningDiv = document.createElement("div");
        reasoningDiv.className = "reasoning-container";
        reasoningDiv.setAttribute("data-part-id", partId);
        const label = document.createElement("div");
        label.className = "reasoning-label";
        label.innerHTML = `<span class="reasoning-icon">\u{1F9E0}</span> Thinking... <span class="collapse-icon">\u25BC</span>`;
        reasoningDiv.appendChild(label);
        const textDiv = document.createElement("div");
        textDiv.className = "reasoning-content";
        if (part.content && typeof part.content === "object" && part.content.html) {
          textDiv.innerHTML = part.content.html;
        } else if (typeof part.content === "string") {
          textDiv.textContent = part.content;
        } else if (typeof part.text === "string") {
          textDiv.textContent = part.text;
        }
        reasoningDiv.appendChild(textDiv);
        label.addEventListener("click", (e) => {
          const isCollapsed = reasoningDiv.getAttribute("data-collapsed") === "true";
          if (isCollapsed) {
            reasoningDiv.setAttribute("data-collapsed", "false");
          } else {
            reasoningDiv.setAttribute("data-collapsed", "true");
          }
          updateCollapseIcon(reasoningDiv);
          e.stopPropagation();
        });
        contentDiv.appendChild(reasoningDiv);
      } else if (part.type === "tool" && part.content) {
        contentDiv.querySelectorAll(".reasoning-container").forEach((r) => r.setAttribute("data-collapsed", "true"));
        contentDiv.querySelectorAll(".reasoning-container").forEach((r) => updateCollapseIcon(r));
        const toolDiv = document.createElement("div");
        toolDiv.innerHTML = constructToolHtml(part.content);
        contentDiv.appendChild(toolDiv);
      } else if (part.type === "text") {
        contentDiv.querySelectorAll(".reasoning-container").forEach((r) => r.setAttribute("data-collapsed", "true"));
        contentDiv.querySelectorAll(".reasoning-container").forEach((r) => updateCollapseIcon(r));
        const textDiv = renderTextPart(getPartContent(part));
        textDiv.setAttribute("data-part-id", partId);
        textDiv.className = "message-text";
        contentDiv.appendChild(textDiv);
      }
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  function renderToolExecution(content) {
    const div = document.createElement("div");
    try {
      const toolHtml = content.html || constructToolHtml(content);
      div.innerHTML = toolHtml;
    } catch (error) {
      console.error("[renderToolExecution] Error rendering tool:", error, content);
      div.innerHTML = `<div class="tool-execution tool-error">
      <div class="tool-header">
        <span class="tool-icon">\u26A0\uFE0F</span>
        <span class="tool-name">Error rendering tool</span>
      </div>
      <pre class="tool-output">${escapeHtml(String(content) || "Unknown error")}</pre>
    </div>`;
    }
    return div;
  }
  function constructToolHtml(content) {
    console.log("[constructToolHtml] Input content:", JSON.stringify(content, null, 2));
    const state = content.state || content;
    const toolName = content.tool || content.toolName || content.toolData?.name || "Unknown Tool";
    const stateStatus = state?.status || "pending";
    const title = state?.title || content.title || "";
    const output = state?.output || content.output || "";
    const error = state?.error || content.error || "";
    const toolInput = state?.input || content.input || {};
    const stateIcons = {
      pending: "\u23F3",
      running: "\u{1F504}",
      completed: "\u2713",
      error: "\u2717"
    };
    const icon = getToolIcon(toolName);
    const stateIcon = stateIcons[stateStatus] || "\u23F3";
    let html = `
    <div class="tool-execution" data-state="${stateStatus}">
      <div class="tool-header">
        <span class="tool-icon">${icon}</span>
        <span class="tool-name">${escapeHtml(toolName)}</span>
        <span class="tool-state">${stateIcon}</span>
      </div>
  `;
    if (title) {
      html += `<div class="tool-title">${escapeHtml(title)}</div>`;
    }
    const shouldRenderCommandOutput = toolName === "bash" && toolInput?.command || (toolInput?.command || toolInput?.description || toolInput?.location);
    if (shouldRenderCommandOutput) {
      html += `
      <div class="tool-content">
        <div class="tool-command-section">
          <div class="tool-command-label">Command</div>
          <pre class="tool-command">${escapeHtml(toolInput.command || toolInput.description || toolInput.location || "")}</pre>
        </div>
    `;
    }
    if (stateStatus === "error" && error) {
      if (shouldRenderCommandOutput) {
        html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Error</div>
          <pre class="tool-output tool-error">${escapeHtml(error)}</pre>
        </div>
      `;
      } else {
        html += `
        <div class="tool-error">
          <pre>${escapeHtml(error)}</pre>
        </div>
      `;
      }
    } else if (output) {
      const shouldCollapse = output.length > 500 || output.split("\n").length > 20;
      if (shouldCollapse) {
        html += `
        <div class="tool-output-section" data-collapsed="true">
          <div class="output-toggle" onclick="toggleToolSection(this)">
            <span class="toggle-icon">\u25B6</span>
            <span class="tool-output-label">Output</span>
          </div>
          <pre class="tool-output">${escapeHtml(output)}</pre>
        </div>
      `;
      } else {
        html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Output</div>
          <pre class="tool-output">${escapeHtml(output)}</pre>
        </div>
      `;
      }
    } else if (stateStatus === "pending") {
      if (shouldRenderCommandOutput) {
        html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Output</div>
          <div class="tool-pending">Waiting for execution...</div>
        </div>
      `;
      } else {
        html += `<div class="tool-pending">Waiting for execution...</div>`;
      }
    } else if (stateStatus === "running") {
      if (shouldRenderCommandOutput) {
        html += `
        <div class="tool-output-section">
          <div class="tool-output-label">Output</div>
          <div class="tool-running">Executing...</div>
        </div>
      `;
      } else {
        html += `<div class="tool-running">Executing...</div>`;
      }
    }
    if (shouldRenderCommandOutput) {
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }
  function getToolIcon(toolName) {
    const icons = {
      bash: "\u{1F4BB}",
      read: "\u{1F4C4}",
      write: "\u{1F4DD}",
      edit: "\u270F\uFE0F",
      glob: "\u{1F50D}",
      grep: "\u{1F50E}",
      webfetch: "\u{1F310}",
      websearch: "\u{1F50D}",
      codesearch: "\u{1F50D}",
      task: "\u{1F527}",
      question: "\u2753",
      default: "\u{1F527}"
    };
    return icons[toolName] || icons.default;
  }
  function escapeHtml(text) {
    const escaped = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (char) => escaped[char]);
  }
  window.toggleToolSection = function(toggle) {
    const section = toggle.parentElement;
    if (section) {
      const isCollapsed = section.getAttribute("data-collapsed") === "true";
      console.log("[toggleToolSection] Current state:", isCollapsed, "section:", section.className);
      if (isCollapsed) {
        section.removeAttribute("data-collapsed");
      } else {
        section.setAttribute("data-collapsed", "true");
      }
      const newState = section.getAttribute("data-collapsed") === "true";
      console.log("[toggleToolSection] New state:", newState);
      const icon = toggle.querySelector(".toggle-icon");
      if (icon) {
        icon.textContent = isCollapsed ? "\u25BC" : "\u25B6";
      }
    }
  };
  window.toggleToolOutput = function(toggle) {
    const content = toggle.parentElement;
    if (content) {
      content.toggleAttribute("data-collapsed");
    }
  };
  window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("[Webview] Received message type:", message.type);
    switch (message.type) {
      case "init":
        console.log("[init] Switching to session:", message.sessionId, "Previous:", currentSessionId);
        currentSessionId = message.sessionId || null;
        currentSessionTitle = message.sessionTitle || "New Session";
        const titleEl = document.getElementById("sessionTitle");
        if (titleEl) titleEl.textContent = currentSessionTitle;
        resetState();
        messages = message.messages || [];
        messagesContainer.innerHTML = "";
        messages.forEach(renderMessage);
        console.log("[init] Initialized with", messages.length, "messages, sessionId:", currentSessionId);
        canUndo = messages.length > 0 && !!currentSessionId && !currentSessionId.startsWith("temp_");
        canRedo = false;
        updateUndoRedoButtons();
        if (currentSessionId) {
          console.log("[init] Focusing input for session:", currentSessionId);
          messageInput.innerHTML = "";
          messageInput.focus();
        }
        break;
      case "message":
        if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
          break;
        }
        renderMessage(message);
        messages.push(message);
        if (currentSessionId && !currentSessionId.startsWith("temp_")) {
          canUndo = true;
          canRedo = false;
          updateUndoRedoButtons();
        }
        break;
      case "messagePart":
        if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
          break;
        }
        updateMessagePart(message.messageId, message.partId || message.part?.id, message.part);
        break;
      case "toolUpdate":
        if (message.sessionId && currentSessionId && message.sessionId !== currentSessionId) {
          break;
        }
        if (message.toolId && message.updates) {
          updateMessagePart(message.messageId, message.toolId, {
            id: message.toolId,
            type: "tool",
            content: message.updates
          });
        }
        break;
      case "sessionIdle":
        messagesContainer.querySelectorAll(".reasoning-container").forEach((r) => {
          r.setAttribute("data-collapsed", "true");
          updateCollapseIcon(r);
        });
        break;
      case "fileSuggestions":
        showFileSuggestions(message.files || message.suggestions || []);
        break;
      case "insertText":
        insertText(message.text);
        break;
      case "clearSuggestions":
        fileSuggestions.hidden = true;
        currentMention = null;
        break;
      case "serverStatus":
        updateSelectors(message.agents || [], message.models || []);
        break;
      case "revertSuccess":
        console.log("[Webview] Revert successful", message);
        if (message.removedMessages) {
          message.removedMessages.forEach((removedMsg) => {
            const msgEl = messagesContainer.querySelector(`[data-message-id="${removedMsg.id}"]`);
            if (msgEl) {
              msgEl.remove();
            }
          });
        }
        if (message.remainingMessages) {
          messages = message.remainingMessages;
        }
        if (message.userMessageToRestore) {
          messageInput.innerHTML = "";
          insertText(message.userMessageToRestore);
          messageInput.focus();
        }
        canUndo = messages.length > 0;
        canRedo = true;
        updateUndoRedoButtons();
        break;
      case "unrevertSuccess":
        console.log("[Webview] Unrevert (redo) successful", message);
        if (message.restoredMessages) {
          message.restoredMessages.forEach((restoredMsg) => {
            const existingEl = messagesContainer.querySelector(`[data-message-id="${restoredMsg.id}"]`);
            if (!existingEl) {
              renderMessage(restoredMsg);
            }
          });
        }
        if (message.allMessages) {
          messages = message.allMessages;
        }
        messageInput.innerHTML = "";
        canUndo = true;
        canRedo = false;
        updateUndoRedoButtons();
        break;
      case "error":
        console.error("[Webview] Error:", message.error);
        updateUndoRedoButtons();
        break;
    }
  });
  function updateSelectors(agents, modelGroups) {
    console.log(`[updateSelectors] Updating selectors with ${modelGroups.length} providers`);
    const currentAgent = agentSelect.value;
    agentSelect.innerHTML = "";
    agents.forEach((agent) => {
      const option = document.createElement("option");
      option.value = agent;
      option.textContent = agent;
      if (agent === currentAgent) option.selected = true;
      agentSelect.appendChild(option);
    });
    const currentModel = modelSelect.value;
    modelSelect.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Default Model";
    modelSelect.appendChild(defaultOpt);
    if (modelGroups && modelGroups.length > 0) {
      modelGroups.forEach((group) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = group.providerID;
        group.models.forEach((model) => {
          const option = document.createElement("option");
          const value = `${group.providerID}/${model}`;
          option.value = value;
          option.textContent = model;
          if (value === currentModel) option.selected = true;
          optgroup.appendChild(option);
        });
        modelSelect.appendChild(optgroup);
      });
    }
  }
  setTimeout(() => {
    console.log("Sending init request...");
    vscodeApi.postMessage({ type: "init" });
  }, 100);
  function showFileSuggestions(suggestions) {
    fileSuggestions.innerHTML = "";
    if (suggestions.length === 0) {
      fileSuggestions.hidden = true;
      return;
    }
    suggestions.forEach((suggestion) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `
      <span class="suggestion-icon">\u{1F4C4}</span>
      <span class="suggestion-path">${escapeHtml(suggestion.path)}</span>
      ${suggestion.lineRange ? `<span class="suggestion-range">${suggestion.lineRange}</span>` : ""}
    `;
      div.addEventListener("click", () => {
        insertFileMention(suggestion.path, suggestion.lineRange);
        fileSuggestions.hidden = true;
        currentMention = null;
        messageInput.focus();
      });
      fileSuggestions.appendChild(div);
    });
    fileSuggestions.hidden = false;
  }
  function insertFileMention(path, lineRange) {
    let range = null;
    if (currentMention?.savedRange) {
      range = currentMention.savedRange.cloneRange();
    } else {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      range = selection.getRangeAt(0);
    }
    if (!range) return;
    messageInput.focus();
    if (currentMention) {
      const deleteRange = document.createRange();
      let currentOffset = 0;
      let startNode = null;
      let startOffsetInNode = 0;
      const walker = document.createTreeWalker(messageInput, NodeFilter.SHOW_TEXT, null, false);
      let textNode = null;
      while (textNode = walker.nextNode()) {
        const nodeLength = textNode.textContent?.length || 0;
        if (currentOffset <= currentMention.startOffset && currentMention.startOffset < currentOffset + nodeLength) {
          startNode = textNode;
          startOffsetInNode = currentMention.startOffset - currentOffset;
          break;
        }
        currentOffset += nodeLength;
      }
      if (startNode) {
        deleteRange.setStart(startNode, startOffsetInNode);
        deleteRange.setEnd(range.endContainer, range.endOffset);
        deleteRange.deleteContents();
      }
    }
    const mentionSpan = document.createElement("span");
    mentionSpan.className = "file-mention";
    mentionSpan.setAttribute("data-path", path);
    mentionSpan.setAttribute("contenteditable", "false");
    mentionSpan.setAttribute("tabindex", "-1");
    const pathText = document.createTextNode(`@${path}`);
    mentionSpan.appendChild(pathText);
    if (lineRange) {
      const rangeSpan = document.createElement("span");
      rangeSpan.className = "line-range";
      rangeSpan.textContent = lineRange;
      mentionSpan.appendChild(rangeSpan);
    }
    const newSelection = window.getSelection();
    if (newSelection && newSelection.rangeCount > 0) {
      const newRange = newSelection.getRangeAt(0);
      newRange.insertNode(mentionSpan);
      newRange.setStartAfter(mentionSpan);
      newRange.setEndAfter(mentionSpan);
      const spaceNode = document.createTextNode(" ");
      newRange.insertNode(spaceNode);
      newRange.setStartAfter(spaceNode);
      newRange.setEndAfter(spaceNode);
      newSelection.removeAllRanges();
      newSelection.addRange(newRange);
    }
    mentionSpan.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectMention(mentionSpan);
    });
  }
  function selectMention(mentionSpan) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNode(mentionSpan);
    selection.removeAllRanges();
    selection.addRange(range);
    mentionSpan.classList.add("selected");
    const removeSelection = (e) => {
      if (!mentionSpan.contains(e.target)) {
        mentionSpan.classList.remove("selected");
        document.removeEventListener("click", removeSelection);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", removeSelection);
    }, 0);
  }
  messageInput.addEventListener("dblclick", (e) => {
    const target = e.target;
    const mentionElement = findMentionElement(target);
    if (mentionElement) {
      e.preventDefault();
      e.stopPropagation();
      selectMention(mentionElement);
    }
  });
  function insertText(text) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      const fileMentionMatch2 = text.match(/^@([^\s]+)(\s*)$/);
      if (fileMentionMatch2) {
        const path = fileMentionMatch2[1];
        const trailingSpace = fileMentionMatch2[2];
        insertFileMentionAtEnd(path);
        if (trailingSpace) {
          messageInput.appendChild(document.createTextNode(trailingSpace));
        }
      } else {
        messageInput.innerHTML += escapeHtml(text);
      }
      return;
    }
    const range = selection.getRangeAt(0);
    const fileMentionMatch = text.match(/^@([^\s]+)(\s*)$/);
    if (fileMentionMatch) {
      const path = fileMentionMatch[1];
      const trailingSpace = fileMentionMatch[2];
      const mentionSpan = document.createElement("span");
      mentionSpan.className = "file-mention";
      mentionSpan.setAttribute("data-path", path);
      mentionSpan.setAttribute("contenteditable", "false");
      mentionSpan.setAttribute("tabindex", "-1");
      const pathText = document.createTextNode(`@${path}`);
      mentionSpan.appendChild(pathText);
      range.insertNode(mentionSpan);
      range.setStartAfter(mentionSpan);
      range.setEndAfter(mentionSpan);
      if (trailingSpace) {
        const spaceNode = document.createTextNode(trailingSpace);
        range.insertNode(spaceNode);
        range.setStartAfter(spaceNode);
        range.setEndAfter(spaceNode);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      mentionSpan.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectMention(mentionSpan);
      });
    } else {
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  function insertFileMentionAtEnd(path, lineRange) {
    const mentionSpan = document.createElement("span");
    mentionSpan.className = "file-mention";
    mentionSpan.setAttribute("data-path", path);
    mentionSpan.setAttribute("contenteditable", "false");
    mentionSpan.setAttribute("tabindex", "-1");
    const pathText = document.createTextNode(`@${path}`);
    mentionSpan.appendChild(pathText);
    if (lineRange) {
      const rangeSpan = document.createElement("span");
      rangeSpan.className = "line-range";
      rangeSpan.textContent = lineRange;
      mentionSpan.appendChild(rangeSpan);
    }
    messageInput.appendChild(mentionSpan);
    mentionSpan.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectMention(mentionSpan);
    });
  }
  sendButton.addEventListener("click", sendMessage);
  attachButton.addEventListener("click", () => {
    postMessage({
      type: "attachFile"
    });
  });
  undoButton.addEventListener("click", () => {
    if (!currentSessionId || currentSessionId.startsWith("temp_")) {
      console.warn("[Undo] Cannot undo: no active session or placeholder session");
      return;
    }
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      console.warn("[Undo] No messages to undo");
      return;
    }
    console.log(`[Undo] Reverting to message: ${lastMessage.id}`);
    postMessage({
      type: "revert",
      sessionId: currentSessionId,
      messageId: lastMessage.id
    });
    undoButton.disabled = true;
    redoButton.disabled = true;
  });
  redoButton.addEventListener("click", () => {
    if (!currentSessionId || currentSessionId.startsWith("temp_")) {
      console.warn("[Redo] Cannot redo: no active session or placeholder session");
      return;
    }
    console.log(`[Redo] Unreverting session: ${currentSessionId}`);
    postMessage({
      type: "unrevert",
      sessionId: currentSessionId
    });
    undoButton.disabled = true;
    redoButton.disabled = true;
  });
  function updateUndoRedoButtons() {
    undoButton.disabled = !canUndo || !currentSessionId || currentSessionId.startsWith("temp_") || messages.length === 0;
    redoButton.disabled = !canRedo || !currentSessionId || currentSessionId.startsWith("temp_");
  }
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      if (!undoButton.disabled) {
        undoButton.click();
      }
      return;
    }
    if (e.key === "y" && (e.ctrlKey || e.metaKey) || e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      if (!redoButton.disabled) {
        redoButton.click();
      }
      return;
    }
    if (e.key === "Backspace") {
      handleBackspace(e);
    } else if (e.key === "Delete") {
      handleDelete(e);
    }
  });
  function handleBackspace(e) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      const container = range.commonAncestorContainer;
      const mentionElement = findMentionElement(container);
      if (mentionElement) {
        e.preventDefault();
        mentionElement.remove();
        return;
      }
      return;
    }
    let nodeBefore = range.startContainer.previousSibling;
    if (range.startOffset === 0 && range.startContainer !== messageInput) {
      nodeBefore = range.startContainer.previousSibling;
    }
    if (nodeBefore && nodeBefore.classList?.contains("file-mention")) {
      e.preventDefault();
      nodeBefore.remove();
      return;
    }
    const parent = range.startContainer.parentElement;
    if (parent && parent.classList?.contains("file-mention")) {
      e.preventDefault();
      parent.remove();
    }
  }
  function handleDelete(e) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      const container = range.commonAncestorContainer;
      const mentionElement = findMentionElement(container);
      if (mentionElement) {
        e.preventDefault();
        mentionElement.remove();
        return;
      }
      return;
    }
    let nodeAfter = range.startContainer.nextSibling;
    const textLength = range.startContainer.textContent?.length || 0;
    if (range.startOffset >= textLength && range.startContainer !== messageInput) {
      nodeAfter = range.startContainer.nextSibling;
    }
    if (nodeAfter && nodeAfter.classList?.contains("file-mention")) {
      e.preventDefault();
      nodeAfter.remove();
      return;
    }
    const parent = range.startContainer.parentElement;
    if (parent && parent.classList?.contains("file-mention")) {
      e.preventDefault();
      parent.remove();
    }
  }
  function findMentionElement(node) {
    let current = node;
    while (current && current !== messageInput) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current;
        if (el.classList?.contains("file-mention")) {
          return el;
        }
      }
      current = current.parentNode;
    }
    return null;
  }
  function sendMessage() {
    const text = getMessageText().trim();
    if (!text) return;
    postMessage({
      type: "sendMessage",
      text
    });
    messageInput.innerHTML = "";
    sendButton.disabled = true;
    setTimeout(() => {
      sendButton.disabled = false;
    }, 500);
  }
  function getMessageText() {
    let text = "";
    const walker = document.createTreeWalker(messageInput, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
    let node = null;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (el.classList.contains("file-mention")) {
          const path = el.getAttribute("data-path");
          const lineRange = el.querySelector(".line-range")?.textContent || "";
          if (path) {
            text += `@${path}${lineRange}`;
          }
        } else if (el.tagName === "BR") {
          text += "\n";
        } else if (el.tagName === "DIV") {
          if (text && !text.endsWith("\n")) {
            text += "\n";
          }
        }
      }
    }
    return text;
  }
  messageInput.addEventListener("input", (e) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      fileSuggestions.hidden = true;
      currentMention = null;
      return;
    }
    const range = selection.getRangeAt(0);
    const textContent = messageInput.textContent || "";
    let textBeforeCursor = "";
    const preRange = document.createRange();
    preRange.setStart(messageInput, 0);
    preRange.setEnd(range.endContainer, range.endOffset);
    textBeforeCursor = preRange.toString();
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);
    if (mentionMatch) {
      const searchTerm = mentionMatch[1];
      const startOffset = textBeforeCursor.length - mentionMatch[0].length;
      const savedRange = range.cloneRange();
      currentMention = {
        startOffset,
        searchTerm,
        textBefore: textBeforeCursor.substring(0, startOffset),
        savedRange
      };
      postMessage({
        type: "requestFileSuggestions",
        searchTerm
      });
    } else {
      fileSuggestions.hidden = true;
      currentMention = null;
    }
  });
  document.addEventListener("click", (e) => {
    if (!fileSuggestions.contains(e.target)) {
      fileSuggestions.hidden = true;
      currentMention = null;
    }
  });
})();
//# sourceMappingURL=main.js.map
