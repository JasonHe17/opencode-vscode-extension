# Module H: VS Code集成 (VS Code Integration)

## 概述
本模块是扩展的入口点，负责初始化所有子系统，注册命令、状态栏指示器，并整合所有其他模块。

**Phase**: 3
**依赖**: 所有之前模块 (A, B, C, D, E, F, G)
**后续依赖**: 无（最终集成模块）

---

## 文件所有权

```
extension/src/
├── main.ts                     [此模块独有]
└── ui/
    └── Icons.ts                [此模块独有]
```

---

## 任务列表

### Task 1: Icons.ts
**文件**: `extension/src/ui/Icons.ts`

**职责**: 定义所有UI图标和主题适配

**接口定义**:

```typescript
import * as vscode from "vscode"

export class Icons {
  // === OpenCode Logo ===
  static readonly logo = {
    light: vscode.Uri.file(
      __dirname + "/../../images/logo-dark.svg"
    ),
    dark: vscode.Uri.file(
      __dirname + "/../../images/logo-light.svg"
    )
  }

  // === Session Icons ===
  static session = {
    active: new vscode.ThemeIcon("radio-tower"),
    idle: new vscode.ThemeIcon("circle-outline"),
    archived: new vscode.ThemeIcon("archive", new vscode.ThemeColor("descriptionForeground"))
  }

  // === Agent Icons ===
  static agent = {
    build: new vscode.ThemeIcon("rocket", new vscode.ThemeColor("terminal.ansiRed")),
    plan: new vscode.ThemeIcon("list-tree", new vscode.ThemeColor("terminal.ansiGreen")),
    explore: new vscode.ThemeIcon("search", new vscode.ThemeColor("terminal.ansiBlue")),
    general: new vscode.ThemeIcon("package", new vscode.ThemeColor("terminal.ansiYellow")),
    default: new vscode.ThemeIcon("symbol-class")
  }

  // === Tool Icons ===
  static tool = {
    pending: new vscode.ThemeIcon("loading~spin"),
    running: new vscode.ThemeIcon("sync~spin"),
    completed: new vscode.ThemeIcon("pass"),
    error: new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground"))
  }

  // === Status Icons ===
  static status = {
    connected: new vscode.ThemeIcon("check"),
    disconnected: new vscode.ThemeIcon("x"),
    busy: new vscode.ThemeIcon("loading~spin")
  }

  // === Permission Icons ===
  static permission = {
    allowed: new vscode.ThemeIcon("shield"),
    denied: new vscode.ThemeIcon("lock"),
    pending: new vscode.ThemeIcon("shield", new vscode.ThemeColor("editorWarning.foreground"))
  }
}
```

---

### Task 2: main.ts
**文件**: `extension/src/main.ts`

**职责**: 扩展初始化，整合所有模块

**接口定义**:

```typescript
import * as vscode from "vscode"
import { getOpenCodeClient } from "./client/OpenCodeClient"
import { getExtensionConfig } from "./config/ExtensionConfig"
import { getSettingsManager } from "./config/SettingsManager"
import { getSessionManager } from "./session/SessionManager"
import { getSessionWebview } from "./session/SessionWebview"
import { getChatPanel } from "./chat/ChatPanel"
import { getPermissionDialog } from "./chat/PermissionDialog"
import { getAgentSelector, getAgentManager } from "./agent/AgentSelector"
import { getProviderSelector, getModelConfig } from "./provider/ProviderSelector"
import { getSessionTreeProvider } from "./session/SessionTreeProvider"
import { registerAllCommands } from "./commands"
import { Icons } from "./ui/Icons"

// 状态栏项目
let sessionStatusBarItem: vscode.StatusBarItem
let agentStatusBarItem: vscode.StatusBarItem
let serverStatusBarItem: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
  console.log("[OpenCode] Extension is activating...")

  try {
    // 1. 初始化基础设施
    initializeInfrastructure(context)

    // 2. 初始化配置
    initializeConfiguration(context)

    // 3. 初始化会话管理
    initializeSessionManager(context)

    // 4. 初始化AI配置
    initializeAIConfig(context)

    // 5. 初始化权限系统
    initializePermissionSystem()

    // 6. 初始化聊天面板
    initializeChatPanel(context)

    // 7. 初始化侧边栏
    initializeSidebar(context)

    // 8. 初始化命令
    initializeCommands(context)

    // 9. 初始化状态栏
    initializeStatusBar()

    console.log("[OpenCode] Extension activated successfully!")

    // 欢迎消息
    vscode.window.showInformationMessage(
      "OpenCode GUI is ready! Press Cmd+Escape to open chat."
    )
  } catch (error) {
    console.error("[OpenCode] Failed to activate extension:", error)
    vscode.window.showErrorMessage(
      `Failed to activate OpenCode: ${error}`
    )
  }
}

export function deactivate() {
  console.log("[OpenCode] Extension is deactivating...")

  // 清理状态栏
  sessionStatusBarItem?.dispose()
  agentStatusBarItem?.dispose()
  serverStatusBarItem?.dispose()

  console.log("[OpenCode] Extension deactivated")
}

// === Initialization Functions ===

function initializeInfrastructure(context: vscode.ExtensionContext): void {
  const settingsManager = getSettingsManager()
  const serverMode = settingsManager.get<string>("opencode.server.mode", "auto")

  console.log(`[OpenCode] Server mode: ${serverMode}`)

  // 根据模式初始化OpenCode客户端
  if (serverMode === "auto") {
    const baseUrl = settingsManager.get<string>("opencode.server.baseUrl", "http://localhost:4096")
    getOpenCodeClient(baseUrl)
    console.log(`[OpenCode] Client initialized with base URL: ${baseUrl}`)
  }
}

function initializeConfiguration(context: vscode.ExtensionContext): void {
  const config = getExtensionConfig(context)

  // 监听配置变化
  const settings = getSettingsManager()
  const disposable = settings.watch("opencode.server.mode", (value) => {
    console.log(`[OpenCode] Server mode changed to: ${value}`)
    // TODO: 重新连接到服务器
  })

  context.subscriptions.push(disposable)
}

function initializeSessionManager(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)

  // 加载历史会话
  sessionManager.loadSessions().then(() => {
    console.log("[OpenCode] Sessions loaded")
  })

  // 监听会话事件更新状态栏
  sessionManager.onSessionEvent((event) => {
    updateSessionStatusBar()
  })
}

function initializeAIConfig(context: vscode.ExtensionContext): void {
  const agentSelector = getAgentSelector()
  const agentManager = getAgentManager(context)
  const providerSelector = getProviderSelector()
  const modelConfig = getModelConfig(context)

  // 从服务器加载可用的agents和providers
  const client = getOpenCodeClient()

  agentSelector.setClient(client)
  agentSelector.loadAgentsFromServer()

  providerSelector.setClient(client)
  providerSelector.loadProvidersFromServer()

  console.log("[OpenCode] AI config initialized")
}

function initializePermissionSystem(): void {
  const permissionDialog = getPermissionDialog()
  const client = getOpenCodeClient()

  permissionDialog.setClient(client)

  console.log("[OpenCode] Permission system initialized")
}

function initializeChatPanel(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)
  const chatPanel = getChatPanel(sessionManager)

  context.subscriptions.push(
    {
      dispose: () => chatPanel.dispose()
    }
  )

  console.log("[OpenCode] Chat panel initialized")
}

function initializeSidebar(context: vscode.ExtensionContext): void {
  const sessionManager = getSessionManager(context)
  const treeProvider = getSessionTreeProvider(sessionManager)

  // 注册树视图
  const treeView = vscode.window.createTreeView("opencodeSessions", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  })

  // 监听树视图选择事件
  treeView.onDidChangeSelection((e) => {
    if (e.selection.length > 0) {
      const selected = e.selection[0] as any
      if (selected.item?.id) {
        // 可以在状态栏显示选中会话的信息
      }
    }
  })

  context.subscriptions.push(treeView)
  context.subscriptions.push(treeProvider)

  console.log("[OpenCode] Sidebar initialized")
}

function initializeCommands(context: vscode.ExtensionContext): void {
  registerAllCommands(context)

  console.log("[OpenCode] Commands registered")
}

function initializeStatusBar(): void {
  // 会话状态指示器
  sessionStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  sessionStatusBarItem.command = "opencode.chat.open"
  sessionStatusBarItem.tooltip = "Open Chat"
  updateSessionStatusBar()
  sessionStatusBarItem.show()

  // Agent状态指示器
  agentStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99
  )
  agentStatusBarItem.command = "opencode.config.selectAgent"
  agentStatusBarItem.tooltip = "Select AI Agent"
  updateAgentStatusBar()
  agentStatusBarItem.show()

  // 服务器状态指示器
  serverStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    98
  )
  serverStatusBarItem.command = "opencode.config.openSettings"
  serverStatusBarItem.tooltip = "OpenCode Server Status"
  updateServerStatusBar()
  serverStatusBarItem.show()

  console.log("[OpenCode] Status bar initialized")
}

// === Status Bar Update Functions ===

function updateSessionStatusBar(): void {
  const sessionManager = getSessionManager()
  const activeSession = sessionManager.getActiveSession()

  if (activeSession) {
    sessionStatusBarItem.text = `$rocket OpenCode: ${activeSession.title}`
    sessionStatusBarItem.show()
  } else {
    sessionStatusBarItem.text = "$rocket OpenCode"
    sessionStatusBarItem.show()
  }
}

function updateAgentStatusBar(): void {
  const config = getExtensionConfig()
  const defaultAgent = config.get("defaultAgent") || "build"

  const icon = Icons.agent[defaultAgent as keyof typeof Icons.agent] || Icons.agent.default
  agentStatusBarItem.text = `$ ${icon.label} ${defaultAgent}`.trim()
}

function updateServerStatusBar(): void {
  const settings = getSettingsManager()
  const mode = settings.get<string>("opencode.server.mode", "auto")

  const icons = {
    auto: "$(cloud-upload)",
    remote: "$(globe)",
    embedded: "$(server)"
  }

  const serverModeText = mode.charAt(0).toUpperCase() + mode.slice(1)
  serverStatusBarItem.text = `${icons[mode as keyof typeof icons]} OpenCode: ${serverModeText}`
}

// 注册命令实现更新

// 注册命令：获取活跃会话
const getActiveSessionCommand = vscode.commands.registerCommand(
  "opencode.session.getActive",
  () => {
    const sessionManager = getSessionManager()
    return sessionManager.getActiveSession()
  }
)

// 导出到context（如果需要）
export function getSessionManagerForCommand() {
  return getSessionManager()
}
```

---

### Task 3: package.json contributes
**文件**: `extension/package.json`

**职责**: 合并所有模块的contributions定义

**注意**: 需要与Module A和Module G协商合并后的最终版本

```json
{
  "name": "opencode-gui",
  "displayName": "OpenCode",
  "description": "Graphical user interface for OpenCode AI",
  "version": "0.1.0",
  "publisher": "opencode-ai",
  "engines": {
    "vscode": "^1.94.0"
  },
  "categories": ["Machine Learning", "Other"],
  "keywords": ["ai", "coding", "assistant", "copilot"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "icon": "images/icon.png",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "opencodeSessions",
          "title": "OpenCode",
          "icon": "images/logo.svg"
        }
      ]
    },
    "views": {
      "opencodeSessions": [
        {
          "id": "sessionTree",
          "name": "Sessions",
          "when": "opencode.enabled"
        }
      ]
    },
    "commands": [
      {
        "command": "opencode.session.create",
        "title": "Create New Session",
        "category": "OpenCode",
        "icon": "$(add)"
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
      },
      {
        "command": "opencode.session.fork",
        "title": "Fork Session",
        "category": "OpenCode",
        "icon": "$(git-branch)"
      },
      {
        "command": "opencode.session.export",
        "title": "Export Session",
        "category": "OpenCode",
        "icon": "$(save)"
      },
      {
        "command": "opencode.session.delete",
        "title": "Delete Session",
        "category": "OpenCode",
        "icon": "$(trash)"
      },
      {
        "command": "opencode.session.archive",
        "title": "Archive Session",
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
        },
        {
          "command": "opencode.session.delete",
          "when": "false"
        },
        {
          "command": "opencode.session.archive",
          "when": "false"
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
      ],
      "explorer/context": [
        {
          "command": "opencode.analyzeFile",
          "when": "resourceExtname =~ /\\.(ts|tsx|js|jsx|py|rs|go|md|txt)$/i",
          "group": "opencode"
        }
      ],
      "view/item/context": [
        {
          "command": "opencode.chat.open",
          "when": "view == opencodeSessions && viewItem =~ /opencode_session/",
          "group": "opencode@1"
        },
        {
          "command": "opencode.session.fork",
          "when": "view == opencodeSessions && viewItem =~ /opencode_session/ && !viewItem =~ /active/",
          "group": "opencode@2"
        },
        {
          "command": "opencode.session.export",
          "when": "view == opencodeSessions && viewItem =~ /opencode_session/",
          "group": "opencode@3"
        },
        {
          "command": "opencode.session.archive",
          "when": "view == opencodeSessions && viewItem =~ /opencode_session/ && !viewItem =~ /archived/",
          "group": "opencode@4"
        },
        {
          "command": "opencode.session.delete",
          "when": "view == opencodeSessions && viewItem =~ /opencode_session/",
          "group": "opencode@9@1"
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
          "markdownDescription": "How to connect to the OpenCode server:\n- **auto**: Start/manage local server automatically\n- **remote**: Connect to an existing server\n- **embedded**: Use embedded server (advanced)"
        },
        "opencode.server.baseUrl": {
          "type": "string",
          "default": "http://localhost:4096",
          "markdownDescription": "URL of the OpenCode server (for *remote* mode)"
        },
        "opencode.server.autoStart": {
          "type": "boolean",
          "default": true,
          "description": "Automatically start the local OpenCode server"
        },
        "opencode.defaultAgent": {
          "type": "string",
          "default": "build",
          "markdownDescription": "Default AI agent to use:\n- **build**: Full access for development\n- **plan**: Read-only exploration\n- **explore**: Codebase analysis\n- **general**: Multi-step tasks"
        },
        "opencode.chat.showToolOutput": {
          "type": "boolean",
          "default": true,
          "description": "Show tool execution output in chat"
        },
        "opencode.chat.autoScroll": {
          "type": "boolean",
          "default": true,
          "description": "Automatically scroll to new messages"
        },
        "opencode.history.limit": {
          "type": "number",
          "default": 100,
          "description": "Maximum number of sessions to keep in history"
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

# 构建测试
bun run compile

# 按F5启动Extension Development Host
```

---

## 与其他模块的接口

### 提供:
- 作为扩展入口，不对外提供接口

### 依赖:
- 所有其他模块

---

## 完成 Checklist

- [x] main.ts 实现activate/deactivate
- [x] main.ts 初始化所有子系统
- [x] main.ts 注册状态栏指示器
- [x] Icons.ts 定义所有UI图标
- [x] package.json 最终合并所有contributes
- [x] 所有文件通过 `bun run check-types`
- [x] 扩展可以在Extension Development Host中启动

---

## 注意事项

1. **初始化顺序**: 严格按照基础设施→配置→会话→AI→权限→聊天→侧边栏→命令→状态栏的顺序初始化
2. **错误处理**: activate函数中有try/catch包裹，初始化失败时显示友好错误
3. **资源清理**: dispose时正确释放所有状态栏和disposables
4. **单例导出**: 导出getSessionManagerForCommand等函数供命令模块使用
5. **合并协调**: package.json需要与Module A和Module G协商最终内容

---

## 集成要点

### 启动顺序:
```
1. initializeInfrastructure()    - 创建OpenCodeClient
2. initializeConfiguration()      - 初始化配置和设置
3. initializeSessionManager()     - 加载历史会话
4. initializeAIConfig()           - 初始化Agent/Provider
5. initializePermissionSystem()   - 初始化权限对话框
6. initializeChatPanel()          - 创建聊天面板（但不显示）
7. initializeSidebar()            - 注册TreeView
8. initializeCommands()           - 注册所有命令
9. initializeStatusBar()          - 显示状态栏指示器
```

### 错误恢复:
- 任何子系统初始化失败后，继续初始化其他子系统
- 显示错误消息但不阻止扩展激活
- 使用try/catch确保其他子系统能正常工作
