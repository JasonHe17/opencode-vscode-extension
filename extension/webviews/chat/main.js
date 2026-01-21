(function() {
  const vscode = acquireVsCodeApi();
  
  let currentSessionId = null;
  let currentAgent = 'build';
  let currentModel = null;
  let isTyping = false;

  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const attachButton = document.getElementById('attachButton');
  const agentSelect = document.getElementById('agentSelect');
  const modelSelect = document.getElementById('modelSelect');
  const sessionTitle = document.getElementById('sessionTitle');
  const fileSuggestions = document.getElementById('fileSuggestions');

  let selectedSuggestionIndex = -1;

  function init() {
    loadState();
    setupEventListeners();
    setupFileMentions();
  }

  function loadState() {
    const state = vscode.getState();
    if (state) {
      currentSessionId = state.sessionId;
      currentAgent = state.agent || 'build';
      currentModel = state.model || null;
      if (state.sessionTitle) {
        sessionTitle.textContent = state.sessionTitle;
      }
      agentSelect.value = currentAgent;
    }
  }

  function saveState() {
    vscode.setState({
      sessionId: currentSessionId,
      agent: currentAgent,
      model: currentModel,
      sessionTitle: sessionTitle.textContent
    });
  }

  function setupEventListeners() {
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('input', () => {
      updateSendButton();
      handleFileMentionInput();
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    attachButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'attachFile'
      });
    });

    agentSelect.addEventListener('change', (e) => {
      currentAgent = e.target.value;
      saveState();
      vscode.postMessage({
        type: 'changeAgent',
        agent: currentAgent
      });
    });

    modelSelect.addEventListener('change', (e) => {
      currentModel = e.target.value;
      saveState();
      vscode.postMessage({
        type: 'changeModel',
        model: currentModel
      });
    });

    window.addEventListener('message', handleVsCodeMessage);
  }

  function handleFileMentionInput() {
    const text = messageInput.value;
    const cursorPosition = messageInput.selectionStart;
    
    const beforeCursor = text.substring(0, cursorPosition);
    const mentionMatch = beforeCursor.match(/@([^\s]*)$/);
    
    if (mentionMatch) {
      const searchTerm = mentionMatch[1];
      vscode.postMessage({
        type: 'requestFileSuggestions',
        searchTerm: searchTerm
      });
    } else {
      hideFileSuggestions();
    }
  }

  function setupFileMentions() {
    fileSuggestions.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        selectFileSuggestion(item.dataset.path);
      }
    });

    messageInput.addEventListener('keydown', (e) => {
      if (fileSuggestions.hidden) return;
      
      const items = fileSuggestions.querySelectorAll('.suggestion-item');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
        updateSuggestionSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, 0);
        updateSuggestionSelection(items);
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        const selectedItem = items[selectedSuggestionIndex];
        if (selectedItem) {
          selectFileSuggestion(selectedItem.dataset.path);
        }
      } else if (e.key === 'Escape') {
        hideFileSuggestions();
      }
    });

    document.addEventListener('click', (e) => {
      if (!messageInput.contains(e.target) && !fileSuggestions.contains(e.target)) {
        hideFileSuggestions();
      }
    });
  }

  function showFileSuggestions(files) {
    fileSuggestions.innerHTML = files.map(file => `
      <div class="suggestion-item" data-path="${file.path}">
        <span class="suggestion-icon">${getFileIcon(file.path)}</span>
        <span class="suggestion-path">${file.path}</span>
      </div>
    `).join('');
    selectedSuggestionIndex = 0;
    updateSuggestionSelection(fileSuggestions.querySelectorAll('.suggestion-item'));
    fileSuggestions.hidden = false;
  }

  function hideFileSuggestions() {
    fileSuggestions.hidden = true;
    selectedSuggestionIndex = -1;
  }

  function updateSuggestionSelection(items) {
    items.forEach((item, index) => {
      if (index === selectedSuggestionIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  function selectFileSuggestion(filePath) {
    const text = messageInput.value;
    const cursorPosition = messageInput.selectionStart;
    
    const beforeCursor = text.substring(0, cursorPosition);
    const afterCursor = text.substring(cursorPosition);
    
    const beforeMention = beforeCursor.replace(/@[^\s]*$/, '');
    const newText = beforeMention + '@' + filePath + ' ' + afterCursor;
    
    messageInput.value = newText;
    messageInput.selectionStart = messageInput.selectionEnd = beforeMention.length + '@' + filePath.length + 1;
    messageInput.focus();
    
    hideFileSuggestions();
    updateSendButton();
  }

  function getFileIcon(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const icons = {
      'ts': '📝',
      'js': '📝',
      'tsx': '⚛️',
      'jsx': '⚛️',
      'py': '🐍',
      'rs': '🦀',
      'go': '🐹',
      'json': '📄',
      'md': '📖',
      'css': '🎨',
      'html': '🌐',
      'default': '📁'
    };
    return icons[ext] || icons.default;
  }

  function updateSendButton() {
    const hasContent = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasContent || isTyping;
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isTyping) return;

    isTyping = true;
    updateSendButton();

    addMessage('user', text);
    messageInput.value = '';

    vscode.postMessage({
      type: 'sendMessage',
      sessionId: currentSessionId,
      agent: currentAgent,
      model: currentModel,
      text: text
    });
  }

  function addMessage(role, content, parts = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.id = 'msg-' + Math.random().toString(36).substr(2, 9);

    const header = document.createElement('div');
    header.className = 'message-header';
    const icon = role === 'user' ? '👤' : '🤖';
    const name = role === 'user' ? 'You' : (messageDiv.dataset.agent || currentAgent);
    header.innerHTML = `<span>${icon}</span> <span>${name}</span>`;
    messageDiv.appendChild(header);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    messageDiv.appendChild(contentDiv);

    if (parts && parts.length > 0) {
      parts.forEach(part => renderPart(contentDiv, part));
    } else if (content) {
      renderPart(contentDiv, { type: 'text', text: content });
    }

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
  }

  function renderPart(container, part) {
    let partEl = container.querySelector(`[data-part-id="${part.id}"]`);
    
    if (part.type === 'text') {
      if (!partEl) {
        partEl = document.createElement('div');
        partEl.className = 'message-text';
        if (part.id) partEl.dataset.partId = part.id;
        container.appendChild(partEl);
      }
      partEl.innerHTML = formatMessage(part.text || '');
    } else if (part.type === 'reasoning') {
      if (!partEl) {
        partEl = document.createElement('div');
        partEl.className = 'reasoning-container';
        if (part.id) partEl.dataset.partId = part.id;
        partEl.dataset.collapsed = 'true';
        container.appendChild(partEl);
      }
      
      const isCompleted = part.state?.status === 'completed';
      if (isCompleted && !partEl.dataset.completed) {
        partEl.dataset.completed = 'true';
      }
      
      const collapsed = partEl.dataset.collapsed === 'true';
      partEl.innerHTML = `<span class="reasoning-header"><span>Thinking...</span><span class="collapse-icon">${collapsed ? '▼' : '▲'}</span></span><div class="reasoning-content">${formatMessage(part.text || '')}</div>`;
      
      const header = partEl.querySelector('.reasoning-header');
      if (header) {
        header.onclick = (e) => {
          const isCollapsed = partEl.dataset.collapsed === 'true';
          if (isCollapsed) {
            partEl.dataset.collapsed = 'false';
          } else {
            partEl.dataset.collapsed = 'true';
          }
          updateCollapseIcon(partEl);
          e.stopPropagation();
        };
      }
      
      if (!isCompleted && partEl.dataset.collapsed !== 'true') {
        partEl.scrollTop = partEl.scrollHeight;
      }
    } else if (part.type === 'tool') {
      renderToolPart(container, part);
    } else if (part.type === 'compaction') {
      const divider = document.createElement('div');
      divider.className = 'compaction-divider';
      container.appendChild(divider);
    }
  }

  function updateCollapseIcon(reasoningDiv) {
    const icon = reasoningDiv.querySelector('.collapse-icon');
    if (icon) {
      const isCollapsed = reasoningDiv.dataset.collapsed === 'true';
      icon.textContent = isCollapsed ? '▼' : '▲';
    }
  }

  function renderToolPart(container, part) {
    let partEl = container.querySelector(`[data-part-id="${part.id}"]`);
    const state = part.state?.status || 'pending';
    
    // Bash specialized rendering
    if (part.tool === 'bash') {
      if (!partEl) {
        partEl = document.createElement('div');
        partEl.className = 'tool-bash-container';
        partEl.dataset.partId = part.id;
        container.appendChild(partEl);
      }
      const command = part.state?.input?.command || '';
      const output = part.state?.output || '';
      partEl.innerHTML = `
        <div class="tool-bash-input">$ ${escapeHtml(command)}</div>
        ${output ? `<div class="tool-bash-output">${escapeHtml(output)}</div>` : ''}
      `;
      const outputEl = partEl.querySelector('.tool-bash-output');
      if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
      return;
    }

    // Read specialized rendering (files only)
    if (part.tool === 'read') {
      if (!partEl) {
        partEl = document.createElement('div');
        partEl.className = 'tool-execution tool-inline';
        partEl.dataset.partId = part.id;
        container.appendChild(partEl);
      }
      const filePath = part.state?.input?.filePath || '...';
      partEl.innerHTML = `<span>→</span> <span>read ${escapeHtml(filePath)}</span>`;
      return;
    }

    // TUI styles for specific tools
    if (part.tool === 'todowrite' && part.state?.status === 'completed') {
      renderTodoList(container, part);
      return;
    }

    if (['edit', 'write', 'apply_patch'].includes(part.tool) && part.state?.status === 'completed') {
      renderDiffSummary(container, part);
      return;
    }

    const isInline = !part.state?.output || part.state.status !== 'completed';
    
    if (!partEl) {
      partEl = document.createElement('div');
      partEl.dataset.partId = part.id;
      container.appendChild(partEl);
    }

    const iconMap = {
      bash: '$',
      read: '→',
      write: '←',
      edit: '←',
      glob: '✱',
      grep: '✱',
      todowrite: '⚙',
      task: '◉'
    };
    const icon = iconMap[part.tool] || '⚙';
    
    if (isInline) {
      partEl.className = `tool-execution tool-inline ${state}`;
      const inputStr = formatToolInput(part.state?.input || {});
      partEl.innerHTML = `<span>${icon}</span> <span>${part.tool} ${inputStr}</span>`;
    } else {
      partEl.className = 'tool-execution tool-block';
      const title = part.state.metadata?.title || `# ${part.tool}`;
      partEl.innerHTML = `
        <div class="tool-header">
          <span class="tool-name">${title}</span>
        </div>
        <div class="tool-output">${escapeHtml(part.state.output)}</div>
      `;
    }
  }

  function renderTodoList(container, part) {
    let partEl = container.querySelector(`[data-part-id="${part.id}"]`);
    if (!partEl) {
      partEl = document.createElement('div');
      partEl.className = 'todo-list';
      partEl.dataset.partId = part.id;
      container.appendChild(partEl);
    }
    
    const todos = part.state.input?.todos || [];
    partEl.innerHTML = todos.map(todo => {
      const icon = {
        completed: '☑',
        in_progress: '⏳',
        pending: '☐',
        cancelled: '☒'
      }[todo.status] || '☐';
      return `<div class="todo-item"><span class="todo-status">${icon}</span> ${escapeHtml(todo.content)}</div>`;
    }).join('');
  }

  function renderDiffSummary(container, part) {
    let partEl = container.querySelector(`[data-part-id="${part.id}"]`);
    if (!partEl) {
      partEl = document.createElement('div');
      partEl.className = 'diff-summary';
      partEl.dataset.partId = part.id;
      container.appendChild(partEl);
    }

    const filePath = part.state.input?.filePath || 'file';
    partEl.innerHTML = `<span>📝</span> <span>Modified ${filePath}</span>`;
    partEl.onclick = () => {
      vscode.postMessage({
        type: 'openFile',
        filePath: part.state.input?.filePath,
        content: part.state.input?.content || part.state.output
      });
    };
  }

  function formatToolInput(input) {
    const entries = Object.entries(input)
      .filter(([_, v]) => typeof v !== 'object')
      .map(([k, v]) => `${k}=${v}`);
    return entries.length > 0 ? `[${entries.join(', ')}]` : '';
  }

  function formatMessage(content) {
    // Basic Markdown Rendering (Simple subset)
    let html = escapeHtml(content);
    
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${code}</code>`;
    });

    // Mentions
    html = html.replace(/@([^\s]+)/g, (match, path) => {
      return `<span class="mention">@${path}</span>`;
    });

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    messagesContainer.appendChild(indicator);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function handleVsCodeMessage(event) {
    const message = event.data;

    switch (message.type) {
      case 'init':
        currentSessionId = message.sessionId;
        if (message.sessionTitle) {
          sessionTitle.textContent = message.sessionTitle;
        }
        if (message.agent) {
          currentAgent = message.agent;
          agentSelect.value = currentAgent;
        }
        saveState();
        if (message.messages && message.messages.length > 0) {
          messagesContainer.innerHTML = '';
          message.messages.forEach(msg => {
            const role = msg.role === 'user' ? 'user' : 'assistant';
            const content = msg.parts ? '' : (msg.content || '');
            const parts = msg.parts || [];
            const msgEl = addMessage(role, content, parts);
            if (msg.id) msgEl.id = 'msg-' + msg.id;
          });
        } else if (message.messages) {
          messagesContainer.innerHTML = '';
        }
        break;

      case 'message':
        hideTypingIndicator();
        if (message.parts) {
          // Streaming or full message with parts
          const existingMsg = document.getElementById('msg-' + message.messageId);
          if (existingMsg) {
            const contentDiv = existingMsg.querySelector('.message-content');
            message.parts.forEach(part => renderPart(contentDiv, part));
          } else {
            const newMsg = addMessage(message.role, message.content, message.parts);
            if (message.messageId) newMsg.id = 'msg-' + message.messageId;
          }
        } else {
          addMessage(message.role, message.content);
        }
        isTyping = false;
        updateSendButton();
        break;

      case 'messagePart':
        hideTypingIndicator();
        const msgId = 'msg-' + message.messageId;
        let msgEl = document.getElementById(msgId);
        if (!msgEl) {
          msgEl = addMessage(message.role || 'assistant', '');
          msgEl.id = msgId;
        }
        const container = msgEl.querySelector('.message-content');
        renderPart(container, message.part);
        scrollToBottom();
        break;

      case 'toolUpdate':
        // Reuse messagePart logic if tool is part of a message
        if (message.messageId) {
          const msgId = 'msg-' + message.messageId;
          const msgEl = document.getElementById(msgId);
          if (msgEl) {
            const container = msgEl.querySelector('.message-content');
            renderPart(container, { type: 'tool', ...message.updates, id: message.toolId });
          }
        }
        break;

      case 'started':
        showTypingIndicator();
        break;

      case 'fileSuggestions':
        if (message.files && message.files.length > 0) {
          showFileSuggestions(message.files);
        } else {
          hideFileSuggestions();
        }
        break;

      case 'sessionUpdated':
        if (message.title) {
          sessionTitle.textContent = message.title;
          saveState();
        }
        break;

      case 'serverStatus':
        if (message.agents) {
          agentSelect.innerHTML = message.agents.map(agent => 
            `<option value="${agent}" ${agent === currentAgent ? 'selected' : ''}>${agent}</option>`
          ).join('');
        }
        if (message.models) {
          modelSelect.innerHTML = '<option value="">Default Model</option>' + 
            message.models.map(p => 
              p.models.map(m => {
                const value = `${p.providerID}/${m}`;
                return `<option value="${value}" ${value === currentModel ? 'selected' : ''}>${p.providerID}: ${m}</option>`;
              }).join('')
            ).join('');
        }
        break;

      case 'sessionIdle':
        messagesContainer.querySelectorAll('.reasoning-container').forEach(r => {
          r.dataset.collapsed = 'true';
          updateCollapseIcon(r);
        });
        break;

      case 'error':
        hideTypingIndicator();
        isTyping = false;
        updateSendButton();
        addMessage('system', message.error);
        break;
    }
  }

  init();
})();
