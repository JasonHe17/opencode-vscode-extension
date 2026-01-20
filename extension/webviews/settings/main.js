(function() {
  const vscode = acquireVsCodeApi();

  let serverConfig = {
    mode: 'auto',
    url: 'http://localhost:4096'
  };

  let apiKeys = {
    openai: '',
    anthropic: '',
    google: '',
    custom: ''
  };

  let availableModels = [];
  let defaultAgent = 'build';
  let chatSettings = {
    showToolOutput: true
  };

  const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    serverUrl: document.getElementById('serverUrl'),
    refreshButton: document.getElementById('refreshButton'),
    refreshSpinner: document.getElementById('refreshSpinner'),
    serverMode: document.getElementById('serverMode'),
    serverUrlInput: document.getElementById('serverUrlInput'),
    serverUrlGroup: document.getElementById('serverUrlGroup'),
    saveServerConfig: document.getElementById('saveServerConfig'),
    providerSelect: document.getElementById('providerSelect'),
    apiKey: document.getElementById('apiKey'),
    addApiKey: document.getElementById('addApiKey'),
    modelsList: document.getElementById('modelsList'),
    loadModelsButton: document.getElementById('loadModelsButton'),
    defaultAgent: document.getElementById('defaultAgent'),
    saveDefaultAgent: document.getElementById('saveDefaultAgent'),
    showToolOutput: document.getElementById('showToolOutput'),
    saveChatSettings: document.getElementById('saveChatSettings')
  };

  function init() {
    loadState();
    setupEventListeners();
    loadServerStatus();
  }

  function loadState() {
    const state = vscode.getState();
    if (state) {
      serverConfig = state.serverConfig || serverConfig;
      apiKeys = state.apiKeys || apiKeys;
      availableModels = state.availableModels || [];
      defaultAgent = state.defaultAgent || defaultAgent;
      chatSettings = state.chatSettings || chatSettings;
    }

    updateUI();
  }

  function saveState() {
    vscode.setState({
      serverConfig,
      apiKeys,
      availableModels,
      defaultAgent,
      chatSettings
    });
  }

  function updateUI() {
    elements.serverMode.value = serverConfig.mode;
    elements.serverUrlInput.value = serverConfig.url;
    elements.serverUrl.textContent = serverConfig.url;
    elements.defaultAgent.value = defaultAgent;
    elements.showToolOutput.checked = chatSettings.showToolOutput;

    if (serverConfig.mode === 'auto') {
      elements.serverUrlInput.disabled = true;
    } else {
      elements.serverUrlInput.disabled = false;
    }

    renderModels();
  }

  function renderModels() {
    if (availableModels.length === 0) {
      elements.modelsList.innerHTML = `
        <p style="color: var(--vscode-descriptionForeground);">
          No models loaded. Click "Refresh Models" to load available models from the OpenCode server.
        </p>
      `;
      return;
    }

    elements.modelsList.innerHTML = availableModels.map(provider => `
      <div class="model-item">
        <div class="model-info">
          <div class="model-provider">${provider.providerID}</div>
          <div class="model-name">${provider.models.length} models available</div>
        </div>
        <span class="status-badge status-connected">Available</span>
      </div>
    `).join('');
  }

  function setupEventListeners() {
    elements.serverMode.addEventListener('change', (e) => {
      serverConfig.mode = e.target.value;
      
      if (serverConfig.mode === 'auto') {
        elements.serverUrlInput.disabled = true;
        elements.serverUrlInput.value = 'http://localhost:4096';
      } else {
        elements.serverUrlInput.disabled = false;
      }
    });

    elements.serverUrlInput.addEventListener('input', (e) => {
      serverConfig.url = e.target.value;
    });

    elements.saveServerConfig.addEventListener('click', () => {
      saveState();
      vscode.postMessage({
        type: 'saveServerConfig',
        config: serverConfig
      });
    });

    elements.providerSelect.addEventListener('change', (e) => {
      const provider = e.target.value;
      elements.apiKey.value = apiKeys[provider] || '';
    });

    elements.addApiKey.addEventListener('click', () => {
      const provider = elements.providerSelect.value;
      const key = elements.apiKey.value.trim();
      
      if (!key) {
        alert('Please enter an API key');
        return;
      }

      apiKeys[provider] = key;
      elements.apiKey.value = '';
      saveState();
      
      vscode.postMessage({
        type: 'saveApiKey',
        provider,
        key
      });
    });

    elements.loadModelsButton.addEventListener('click', () => {
      loadModels();
    });

    elements.defaultAgent.addEventListener('change', (e) => {
      defaultAgent = e.target.value;
    });

    elements.saveDefaultAgent.addEventListener('click', () => {
      saveState();
      vscode.postMessage({
        type: 'saveDefaultAgent',
        agent: defaultAgent
      });
    });

    elements.showToolOutput.addEventListener('change', (e) => {
      chatSettings.showToolOutput = e.target.checked;
    });

    elements.saveChatSettings.addEventListener('click', () => {
      saveState();
      vscode.postMessage({
        type: 'saveChatSettings',
        settings: chatSettings
      });
    });

    elements.refreshButton.addEventListener('click', () => {
      loadServerStatus();
    });

    window.addEventListener('message', handleVsCodeMessage);
  }

  function loadServerStatus() {
    elements.refreshButton.disabled = true;
    elements.refreshSpinner.classList.remove('hidden');
    elements.connectionStatus.textContent = 'Checking...';
    elements.connectionStatus.className = 'status-badge status-disconnected';

    vscode.postMessage({
      type: 'checkServerStatus'
    });
  }

  function loadModels() {
    vscode.postMessage({
      type: 'loadModels'
    });
  }

  function handleVsCodeMessage(message) {
    switch (message.type) {
      case 'serverStatus':
        handleServerStatus(message.status);
        break;

      case 'modelsLoaded':
        handleModelsLoaded(message.models);
        break;

      case 'configSaved':
        vscode.window.showInformationMessage('Configuration saved');
        break;

      case 'error':
        handleError(message.error);
        break;
    }
  }

  function handleServerStatus(status) {
    elements.refreshButton.disabled = false;
    elements.refreshSpinner.classList.add('hidden');

    if (status.connected) {
      elements.connectionStatus.textContent = 'Connected';
      elements.connectionStatus.className = 'status-badge status-connected';
      elements.serverUrl.textContent = status.url;
    } else {
      elements.connectionStatus.textContent = 'Disconnected';
      elements.connectionStatus.className = 'status-badge status-disconnected';
    }
  }

  function handleModelsLoaded(models) {
    availableModels = models;
    saveState();
    renderModels();
  }

  function handleError(error) {
    console.error('[Settings] Error:', error);
    alert(error);
  }
})();
