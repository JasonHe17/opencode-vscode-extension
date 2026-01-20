# Module G: 命令注册框架 (Command Registration)

## 概述
本模块负责VS Code扩展的所有命令注册和组织。为后续模块提供命令调用的入口点。

**Phase**: 1
**可以并行开发**: Module A (基础设施层)
**后续依赖**: Module H (main.ts)

---

## 文件所有权

```
extension/src/commands/
├── index.ts                    [此模块独有]
├── sessionCommands.ts          [此模块独有]
├── chatCommands.ts             [此模块独有]
└── configCommands.ts           [此模块独有]

package.json                    [与Module A共享，合并时协商]
```

---

## 任务列表

### Task 1: commands/index.ts
**文件**: `extension/src/commands/index.ts`

**职责**: 注册所有命令，按功能分组

**接口定义**:

```typescript
import * as vscode from "vscode"

/**
 * 注册所有命令
 */
export function registerAllCommands(context: vscode.ExtensionContext): void {
  registerSessionCommands(context)
  registerChatCommands(context)
  registerConfigCommands(context)
}

/**
 * 会话相关命令注册
 */
function registerSessionCommands(context: vscode.ExtensionContext): void {
  // 创建新会话
  const createSessionCommand = vscode.commands.registerCommand(
    "opencode.session.create",
    async (options?: { title?: string }) => {
      // 占位函数，由Module B实现
      vscode.window.showInformationMessage("Session create command (TBD)")
    }
  )

  // set active session
  const setActiveSessionCommand = vscode.commands.registerCommand(
    "opencode.session.setActive",
    async (sessionId: string) => {
      vscode.window.showInformationMessage(`Set active session: ${sessionId}`)
    }
  )

  // 删除会话
  const deleteSessionCommand = vscode.commands.registerCommand(
    "opencode.session.delete",
    async (sessionId: string) => {
      vscode.window.showInformationMessage(`Delete session: ${sessionId}`)
    }
  )

  // 分支会话
  const forkSessionCommand = vscode.commands.registerCommand(
    "opencode.session.fork",
    async (sessionId: string, messageId?: string) => {
      vscode.window.showInformationMessage(`Fork session: ${sessionId}`)
    }
  )

  // 显示会话
  const showSessionCommand = vscode.commands.registerCommand(
    "opencode.session.show",
    async (sessionId: string) => {
      vscode.window.showInformationMessage(`Show session: ${sessionId}`)
    }
  )

  context.subscriptions.push(
    createSessionCommand,
    setActiveSessionCommand,
    deleteSessionCommand,
    forkSessionCommand,
    showSessionCommand
  )
}

/**
 * 聊天相关命令注册
 */
function registerChatCommands(context: vscode.ExtensionContext): void {
  // 打开聊天面板
  const openChatCommand = vscode.commands.registerCommand(
    "opencode.chat.open",
    async (sessionId?: string) => {
      vscode.window.showInformationMessage("Open chat (TBD)")
    }
  )

  // 发送消息
  const sendMessageCommand = vscode.commands.registerCommand(
    "opencode.chat.send",
    async (sessionId: string, message: string) => {
      vscode.window.showInformationMessage(`Send message: ${message}`)
    }
  )

  // 附加文件
  const attachFileCommand = vscode.commands.registerCommand(
    "opencode.chat.attachFile",
    async () => {
      vscode.window.showInformationMessage("Attach file (TBD)")
    }
  )

  // 解释选中内容
  const explainSelectionCommand = vscode.commands.registerCommand(
    "opencode.chat.explainSelection",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage("Please select some text")
        return
      }
      vscode.window.showInformationMessage("Explain selection (TBD)")
    }
  )

  // 重构选中内容
  const refactorSelectionCommand = vscode.commands.registerCommand(
    "opencode.chat.refactorSelection",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage("Please select some text")
        return
      }
      vscode.window.showInformationMessage("Refactor selection (TBD)")
    }
  )

  // 生成测试
  const generateTestsCommand = vscode.commands.registerCommand(
    "opencode.chat.generateTests",
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage("Please select some code")
        return
      }
      vscode.window.showInformationMessage("Generate tests (TBD)")
    }
  )

  context.subscriptions.push(
    openChatCommand,
    sendMessageCommand,
    attachFileCommand,
    explainSelectionCommand,
    refactorSelectionCommand,
    generateTestsCommand
  )
}

/**
 * 配置相关命令注册
 */
function registerConfigCommands(context: vscode.ExtensionContext): void {
  // 打开设置
  const openSettingsCommand = vscode.commands.registerCommand(
    "opencode.config.openSettings",
    async () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "opencode")
    }
  )

  // 选择Agent
  const selectAgentCommand = vscode.commands.registerCommand(
    "opencode.config.selectAgent",
    async (sessionId?: string) => {
      vscode.window.showInformationMessage("Select agent (TBD)")
    }
  )

  // 选择Model
  const selectModelCommand = vscode.commands.registerCommand(
    "opencode.config.selectModel",
    async (sessionId?: string) => {
      vscode.window.showInformationMessage("Select model (TBD)")
    }
  )

  // 设置API Key
  const setApiKeyCommand = vscode.commands.registerCommand(
    "opencode.config.setApiKey",
    async (provider?: string) => {
      vscode.window.showInformationMessage("Set API key (TBD)")
    }
  )

  context.subscriptions.push(
    openSettingsCommand,
    selectAgentCommand,
    selectModelCommand,
    setApiKeyCommand
  )
}
```

---

### Task 2: commands/sessionCommands.ts
**文件**: `extension/src/commands/sessionCommands.ts`

**职责**: 会话相关命令的具体实现（占位函数，由Module B补充）

**接口定义**:

```typescript
import * as vscode from "vscode"

/**
 * 创建新会话
 */
export async function createSession(
  options?: { title?: string; agent?: string; model?: { providerID: string; modelID: string } }
): Promise<void> {
  // TODO: 由Module B实现
  // const sessionManager = getSessionManager()
  // await sessionManager.createSession(options)

  vscode.window.showInformationMessage("Session created (placeholder)")
}

/**
 * 设置活跃会话
 */
export async function setActiveSession(sessionId: string): Promise<void> {
  // TODO: 由Module B实现
  // const sessionManager = getSessionManager()
  // sessionManager.setActiveSession(sessionId)

  vscode.window.showInformationMessage(`Active session: ${sessionId}`)
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // TODO: 由Module B实现

  const confirm = await vscode.window.showWarningMessage(
    "Are you sure you want to delete this session?",
    "Delete",
    "Cancel"
  )

  if (confirm !== "Delete") return

  vscode.window.showInformationMessage(`Session ${sessionId} deleted (placeholder)`)
}

/**
 * 分支会话
 */
export async function forkSession(
  sessionId: string,
  messageId?: string
): Promise<void> {
  // TODO: 由Module B实现
  // const sessionManager = getSessionManager()
  // await sessionManager.forkSession(sessionId, messageId)

  vscode.window.showInformationMessage(`Session forked from ${sessionId} (placeholder)`)
}

/**
 * 显示会话
 */
export async function showSession(sessionId: string): Promise<void> {
  // TODO: 由Module B实现
  // const chatPanel = getChatPanel()
  // await chatPanel.show(sessionId)

  vscode.window.showInformationMessage(`Show session ${sessionId} (placeholder)`)
}
```

---

### Task 3: commands/chatCommands.ts
**文件**: `extension/src/commands/chatCommands.ts`

**职责**: 聊天相关命令的具体实现（占位函数，由Module C补充）

**接口定义**:

```typescript
import * as vscode from "vscode"

/**
 * 打开聊天面板
 */
export async function openChat(sessionId?: string): Promise<void> {
  // TODO: 由Module C实现
  // const chatPanel = getChatPanel()
  // await chatPanel.show(sessionId)

  vscode.window.showInformationMessage("Open chat (placeholder)")
}

/**
 * 发送消息
 */
export async function sendMessage(sessionId: string, message: string): Promise<void> {
  // TODO: 由Module C实现
  // const chatPanel = getChatPanel()
  // await chatPanel.sendMessage(message)

  vscode.window.showInformationMessage(`Send: ${message}`)
}

/**
 * 附加文件
 */
export async function attachFile(): Promise<void> {
  // TODO: 由Module C实现
  const fileUri = await vscode.window.showOpenDialog({
    title: "Select file to attach",
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false
  })

  if (fileUri && fileUri.length > 0) {
    vscode.window.showInformationMessage(`Attached: ${fileUri[0].fsPath}`)
  }
}

/**
 * 解释选中内容
 */
export async function explainSelection(editor?: vscode.TextEditor): Promise<void> {
  const activeEditor = editor || vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  if (activeEditor.selection.isEmpty) {
    vscode.window.showWarningMessage("Please select some text")
    return
  }

  const selectionText = activeEditor.document.getText(activeEditor.selection)

  // TODO: 由Module C实现
  // 打开聊天并发送："Explain this code:\n\`${selectionText}\`"

  vscode.window.showInformationMessage("Explain selection (placeholder)")
}

/**
 * 重构选中内容
 */
export async function refactorSelection(editor?: vscode.TextEditor): Promise<void> {
  const activeEditor = editor || vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  if (activeEditor.selection.isEmpty) {
    vscode.window.showWarningMessage("Please select some text to refactor")
    return
  }

  const selectionText = activeEditor.document.getText(activeEditor.selection)

  // TODO: 由Module C实现
  // 打开聊天并发送："Refactor this code to improve readability:\n\`${selectionText}\`"

  vscode.window.showInformationMessage("Refactor selection (placeholder)")
}

/**
 * 生成测试
 */
export async function generateTests(editor?: vscode.TextEditor): Promise<void> {
  const activeEditor = editor || vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  if (activeEditor.selection.isEmpty) {
    vscode.window.showWarningMessage("Please select code to generate tests for")
    return
  }

  const selectionText = activeEditor.document.getText(activeEditor.selection)

  // TODO: 由Module C实现
  // 打开聊天并发送："Generate unit tests for this code:\n\`${selectionText}\`"

  vscode.window.showInformationMessage("Generate tests (placeholder)")
}

/**
 * 插入文件引用
 */
export async function addFilepathToTerminal(): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showWarningMessage("No active editor")
    return
  }

  // TODO: 由Module C实现
  // 获取文件引用并插入到聊天输入框

  vscode.window.showInformationMessage("Add filepath (placeholder)")
}
```

---

### Task 4: commands/configCommands.ts
**文件**: `extension/src/commands/configCommands.ts`

**职责**: 配置相关命令的具体实现（占位函数，由Module E补充）

**接口定义**:

```typescript
import * as vscode from "vscode"

/**
 * 打开VS Code设置
 */
export async function openSettings(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.openSettings", "opencode")
}

/**
 * 选择Agent
 */
export async function selectAgent(sessionId?: string): Promise<void> {
  // TODO: 由Module E实现
  // const agentSelector = getAgentSelector()
  // await agentSelector.showAgentPicker(sessionId)

  const agent = await vscode.window.showQuickPick(
    ["build", "plan", "explore", "general"],
    {
      placeHolder: "Select an agent"
    }
  )

  if (agent) {
    vscode.window.showInformationMessage(`Selected agent: ${agent}`)
  }
}

/**
 * 选择Model
 */
export async function selectModel(sessionId?: string): Promise<void> {
  // TODO: 由Module E实现
  // const providerSelector = getProviderSelector()
  // await providerSelector.showProviderPicker(sessionId)

  const provider = await vscode.window.showQuickPick(
    ["OpenAI", "Anthropic", "Google"],
    {
      placeHolder: "Select a provider"
    }
  )

  if (provider) {
    vscode.window.showInformationMessage(`Selected provider: ${provider}`)
  }
}

/**
 * 设置API Key
 */
export async function setApiKey(provider?: string): Promise<void> {
  if (!provider) {
    const providers = await vscode.window.showQuickPick(
      ["OpenAI", "Anthropic", "Google", "GitHub Copilot"],
      {
        placeHolder: "Select a provider"
      }
    )
    if (!providers) return
    provider = providers
  }

  const apiKey = await vscode.window.showInputBox({
    placeHolder: "Enter your API key",
    password: true,
    prompt: `Enter API key for ${provider}`
  })

  if (apiKey) {
    // TODO: 使用vscode.secretStorage存储
    vscode.window.showInformationMessage(`API key set for ${provider}`)
  }
}
```

---

### Task 5: package.json contributes
**文件**: `package.json`

**职责**: 定义所有命令、菜单、快捷键

**⚠️ 重要**: 此文件与Module A共享，需要在Phase 1结束后协商合并

```json
{
  "name": "opencode-gui",
  "displayName": "OpenCode GUI",
  "description": "Graphical user interface for OpenCode",
  "version": "0.0.1",
  "publisher": "your-publisher",
  "engines": {
    "vscode": "^1.94.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "opencode.session.create",
        "title": "Create New Session",
        "category": "OpenCode"
      },
      {
        "command": "opencode.chat.open",
        "title": "Open Chat",
        "category": "OpenCode",
        "icon": "$(comment-discussion)"
      },
      {
        "command": "opencode.chat.explainSelection",
        "title": "Explain Selection",
        "category": "OpenCode"
      },
      {
        "command": "opencode.chat.refactorSelection",
        "title": "Refactor Selection",
        "category": "OpenCode"
      },
      {
        "command": "opencode.chat.generateTests",
        "title": "Generate Tests",
        "category": "OpenCode"
      },
      {
        "command": "opencode.config.selectModel",
        "title": "Select AI Model",
        "category": "OpenCode"
      },
      {
        "command": "opencode.config.setApiKey",
        "title": "Set API Key",
        "category": "OpenCode"
      }
    ],
    "keybindings": [
      {
        "command": "opencode.chat.open",
        "key": "cmd+escape",
        "mac": "cmd+escape",
        "win": "ctrl+escape",
        "linux": "ctrl+escape"
      },
      {
        "command": "opencode.session.create",
        "key": "cmd+shift+escape",
        "mac": "cmd+shift+escape",
        "win": "ctrl+shift+escape",
        "linux": "ctrl+shift+escape"
      },
      {
        "command": "opencode.chat.explainSelection",
        "when": "editorHasSelection",
        "key": "cmd+k cmd+e",
        "mac": "cmd+k cmd+e",
        "win": "ctrl+k ctrl+e",
        "linux": "ctrl+k ctrl+e"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "opencode.chat.explainSelection",
          "when": "editorHasSelection"
        },
        {
          "command": "opencode.chat.refactorSelection",
          "when": "editorHasSelection"
        },
        {
          "command": "opencode.chat.generateTests",
          "when": "editorHasSelection"
        }
      ],
      "editor/context": [
        {
          "command": "opencode.chat.explainSelection",
          "when": "editorHasSelection",
          "group": "opencode@1"
        },
        {
          "command": "opencode.chat.refactorSelection",
          "when": "editorHasSelection",
          "group": "opencode@2"
        },
        {
          "command": "opencode.chat.generateTests",
          "when": "editorHasSelection",
          "group": "opencode@3"
        }
      ]
    },
    "configuration": {
      "title": "OpenCode",
      "properties": {
        "opencode.server.mode": {
          "type": "string",
          "enum": ["auto", "remote", "embedded"],
          "default": "auto",
          "description": "How to connect to the OpenCode server"
        },
        "opencode.server.baseUrl": {
          "type": "string",
          "default": "http://localhost:4096",
          "description": "URL of the OpenCode server (for remote mode)"
        },
        "opencode.server.autoStart": {
          "type": "boolean",
          "default": true,
          "description": "Automatically start the local OpenCode server"
        },
        "opencode.defaultAgent": {
          "type": "string",
          "default": "build",
          "description": "Default AI agent to use"
        },
        "opencode.chat.showToolOutput": {
          "type": "boolean",
          "default": true,
          "description": "Show tool execution output in chat"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "bun run package",
    "compile": "bun run check-types && bun run lint && node esbuild.js",
    "watch:esbuild": "node esbuild.js --watch",
    "watch:tsc": "tsc --noEmit --watch --project tsconfig.json",
    "package": "bun run check-types && bun run lint && node esbuild.js --production",
    "check-types": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vscode-test"
  },
  "devDependencies": {
    "@types/vscode": "^1.94.0",
    "@types/node": "20.x",
    "typescript": "^5.8.3",
    "esbuild": "^0.25.3",
    "eslint": "^9.25.1"
  },
  "dependencies": {
    "@opencode-ai/sdk/v2": "workspace:*"
  }
}
```

---

## 测试清单

```bash
cd extension
bun install

# 类型检查
bun run check-types

# 语法检查
bun run lint
```

---

## 与其他模块的接口

### 提供:
1. `registerAllCommands()` - 用于Module H (main.ts) 的activate函数
2. 所有命令的占位函数 - 后续由Module B/C/E补充实现

### 依赖:
- `vscode` - VS Code API

---

## Phase 1 合并协调

与Module A协商完成以下内容：

1. **package.json合并**:
   - Module G: 添加所有commands/keybindings/menus/contributes
   - Module A: 添加dependencies (如需要)
   - Module A: 添加devDependencies (typescript, esbuild等)

2. **导入路径**:
   - Module G的命令实现函数将来会导入:
     - Module A: `OpenCodeClient`, `ExtensionConfig`
     - Module B: `SessionManager`
     - Module C: `ChatPanel`
     - Module E: `AgentSelector`, `ProviderSelector`

---

## 完成 Checklist

- [ ] commands/index.ts 注册所有命令
- [ ] commands/sessionCommands.ts 实现会话命令占位
- [ ] commands/chatCommands.ts 实现聊天命令占位
- [ ] commands/configCommands.ts 实现配置命令占位
- [ ] package.json 添加所有contributes定义
- [ ] 与Module A协商合并package.json
- [ ] 类型检查通过
- [ ] 准备交付Module H集成

---

## 注意事项

1. **占位函数**: 当前所有命令都是占位函数，显示"TBD"提示
2. **后续集成**: Module H (main.ts) 会调用 `registerAllCommands()`
3. **模块独立**: 命令注册不依赖其他模块的实现细节
4. **类型安全**: 使用string联合类型定义ConfigKey
5. **用户友好**: 添加命令分类和图标，提升用户体验
