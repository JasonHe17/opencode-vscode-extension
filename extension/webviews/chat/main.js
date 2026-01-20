(function() {
  const vscode = acquireVsCodeApi();
  
  let currentSessionId = null;
  let currentAgent = 'build';
  let isTyping = false;

  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const attachButton = document.getElementById('attachButton');
  const agentSelect = document.getElementById('agentSelect');
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
      text: text
    });
  }

  function addMessage(role, content, attachments = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const icon = role === 'user' ? '👤' : '🤖';
    const roleName = role === 'user' ? 'You' : currentAgent;

    let attachmentsHtml = '';
    if (attachments && attachments.length > 0) {
      attachmentsHtml = attachments.map(attachment => {
        if (attachment.type === 'tool') {
          return renderToolExecution(attachment);
        }
        return '';
      }).join('');
    }

    messageDiv.innerHTML = `
      <div class="message-icon">${icon}</div>
      <div class="message-content">
        <div class="message-role">${roleName}</div>
        <div class="message-text">${formatMessage(content)}</div>
        ${attachmentsHtml}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
  }

  function renderToolExecution(tool) {
    const state = tool.state || 'pending';
    const stateIcon = {
      pending: '⏳',
      running: '🔄',
      completed: '✓',
      error: '✗'
    }[state];

    let outputHtml = '';
    if (tool.output) {
      outputHtml = `<div class="tool-output">${escapeHtml(tool.output)}</div>`;
    }

    return `
      <div class="tool-execution ${state}" data-tool-id="${tool.id}">
        <div class="tool-header">
          <span class="tool-icon">${stateIcon}</span>
          <span class="tool-name">${escapeHtml(tool.name)}</span>
          ${tool.command ? `<span class="tool-command">${escapeHtml(tool.command)}</span>` : ''}
          <span class="tool-state">${state}</span>
        </div>
        ${outputHtml}
      </div>
    `;
  }

  function updateToolExecution(toolId, updates) {
    const toolElement = messagesContainer.querySelector(`[data-tool-id="${toolId}"]`);
    if (!toolElement) return;

    const state = updates.state || 'pending';
    const stateIcon = {
      pending: '⏳',
      running: '🔄',
      completed: '✓',
      error: '✗'
    }[state];

    toolElement.className = `tool-execution ${state}`;
    
    const stateSpan = toolElement.querySelector('.tool-state');
    if (stateSpan) stateSpan.textContent = state;

    const iconSpan = toolElement.querySelector('.tool-icon');
    if (iconSpan) iconSpan.textContent = stateIcon;

    if (updates.output) {
      let outputDiv = toolElement.querySelector('.tool-output');
      if (!outputDiv) {
        const header = toolElement.querySelector('.tool-header');
        outputDiv = document.createElement('div');
        outputDiv.className = 'tool-output';
        header.parentElement.insertBefore(outputDiv, header.nextSibling);
      }
      outputDiv.textContent = updates.output;
    }

    scrollToBottom();
  }

  function formatMessage(content) {
    return escapeHtml(content)
      .replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, (match, code) => {
        return `<code>${escapeHtml(code)}</code>`;
      })
      .replace(/@([^\s]+)/g, (match, path) => {
        return `<span class="mention">@${escapeHtml(path)}</span>`;
      });
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
          message.messages.forEach(msg => {
            addMessage(msg.role, msg.content, msg.attachments);
          });
        }
        break;

      case 'message':
        hideTypingIndicator();
        const messageEl = addMessage(message.role, message.content, message.attachments);
        if (message.toolExecutions) {
          message.toolExecutions.forEach(tool => {
            const attachmentsDiv = messageEl.querySelector('.message-content');
            const toolHtml = renderToolExecution(tool);
            attachmentsDiv.insertAdjacentHTML('beforeend', toolHtml);
          });
        }
        isTyping = false;
        updateSendButton();
        break;

      case 'toolUpdate':
        updateToolExecution(message.toolId, message.updates);
        if (message.updates.state === 'completed' || message.updates.state === 'error') {
          isTyping = false;
          updateSendButton();
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
