# OpenCode Agent Guidelines

## Build/Test Commands

- **Install**: `bun install`
- **Dev (opencode CLI)**: `bun run --cwd packages/opencode --conditions=browser src/index.ts`
- **Dev (web app)**: `bun run --cwd packages/app dev` or `vite`
- **Typecheck**: `bun run typecheck` (runs `bun turbo typecheck`)
- **Test**: `bun test` (runs all tests in packages/opencode)
- **Single test**: `bun test test/agent/agent.test.ts` (specific test file)
- **Build (opencode)**: `bun run --cwd packages/opencode build`
- **Build (web app)**: `bun run --cwd packages/app build`
- **Regenerate JS SDK**: `./packages/sdk/js/script/build.ts`
- **Default branch**: `dev`

## Code Style

### Runtime & Modules
- **Runtime**: Bun with TypeScript ESM modules (type: "module")
- **Package manager**: Bun 1.3.5

### Import Style
- Use relative imports for local modules: `import { foo } from "../bar"`
- Named imports preferred: `import { Tool, Session } from "opencode"`
- Workspace imports use `workspace:*` pattern in package.json

### Type System
- **Validation**: All inputs validated with Zod schemas
- **Schemas**: Use discriminated unions with `z.discriminatedUnion("type", [...])`
- **Type inference**: Use `z.infer<typeof schema>` for type extraction
- **Zod meta**: Use `.meta({ ref: "Name" })` for schema documentation
- Add `.meta()` to zod objects for API documentation

### Naming Conventions
- Variables/functions: `camelCase`
- Classes/Types: `PascalCase`
- Namespaces: `PascalCase` (e.g., `Tool.define()`, `Session.create()`, `Auth.Info`)
- Constants: `SCREAMING_SNAKE_CASE`
- Test files: `*.test.ts` next to source files

### Error Handling
- **Tool errors**: Use Result patterns, avoid throwing exceptions in tools
- **Validation**: Wrap with `z.safeParse()` and handle safely
- **Zod errors**: Customize via `formatValidationError()` in tool definition
- Provide descriptive error messages explaining what went wrong

### File Structure & Architecture
- **Namespace pattern**: Organize related functions in namespaces (e.g., `Tool`, `Session`, `Auth`)
- **Tools**: Implement `Tool.Info` interface with `execute()` method
- **Context**: Always pass `sessionID` in tool context
- **DI**: Use `App.provide()` for dependency injection
- **Logging**: Use `Log.create({ service: "name" })` pattern for structured logging
- **Storage**: Use `Storage` namespace for persistence operations

### Formatting
- **Prettier**: `semi: false`, `printWidth: 120`
- Avoid semicolons
- Max line length: 120 characters

### SolidJS (web app)
- **State**: Always prefer `createStore` over multiple `createSignal` calls
- Use SolidJS primitives from `@solid-primitives/*` packages
- Follow SolidJS reactivity patterns carefully

### Tool Implementation
- Define tools using `Tool.define(id, initFunction)`
- Return object with `description`, `parameters`, `execute`, optional `formatValidationError`
- Validate parameters at execute time (or rely on framework)
- Return object with `title`, `metadata`, `output`, optional `attachments`
- Handle truncation for large outputs via returned metadata

### API Communication
- TypeScript TUI (SolidJS + OpenTUI) communicates with OpenCode server via `@opencode-ai/sdk`
- When adding/modifying server endpoints in `packages/opencode/src/server/server.ts`:
  - Run `./script/generate.ts` to regenerate SDK and related files

### Testing
- Place test files in `test/` directory adjacent to source
- Use `bun test` with file paths for single test execution
- Test structure: Follow existing patterns in `packages/opencode/test/`

### Best Practices
- **ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE** - batch independent operations
- Use Zod's `.pipe()` for complex transformations
- Prefer async/await over Promise chains
- Log important operations with context
- Handle file permissions explicitly (chmod 0o600 for sensitive files)
- Use ` Bun.file()` for file operations
- Validate all external inputs before processing

### Debugging (web app)
- App runs at http://localhost:3000 when developing
- NEVER restart the app or server process - use existing playwright MCP server if needed

---

## 文档索引

### 开发文档
- [TODO.md](docs/TODO.md) - 并行开发任务清单
- [VERIFICATION_GUIDE.md](docs/VERIFICATION_GUIDE.md) - 模块验收指南

### 模块开发指南
- [Module A: 基础设施层](docs/modules/module-a-infrastructure.md)
- [Module G: 命令注册框架](docs/modules/module-g-commands.md)
- [Module B: 会话管理](docs/modules/module-b-session.md)
- [Module E: AI配置管理](docs/modules/module-e-ai-config.md)
- [Module F: 权限系统](docs/modules/module-f-permissions.md)
- [Module C: 聊天面板](docs/modules/module-c-chat.md)
- [Module D: 会话侧边栏](docs/modules/module-d-sidebar.md)
- [Module H: VS Code集成](docs/modules/module-h-vscode-integration.md)

### 验证脚本
- [验证脚本使用指南](docs/VERIFICATION_SCRIPTS.md)
- `./scripts/verify-phase1.sh` - Phase 1自动化验证
- `./scripts/verify-phase2.sh` - Phase 2自动化验证
- `./scripts/verify-phase3.sh` - Phase 3自动化验证
- `./scripts/verify-final.sh` - 全量验证

---

# VSCode Extension Development (opencode-gui)

## Overview

This VSCode extension provides a **graphical user interface** for OpenCode, replacing the command-line terminal with rich UI panels and dialogs while fully leveraging VS Code's native features.

## Architecture

### Extension Structure

```
extension/
├── src/
│   ├── main.ts              # Extension entry point
│   ├── client/
│   │   ├── OpenCodeClient.ts    # API client wrapper (uses @opencode-ai/sdk)
│   │   └── SSEHandler.ts        # Server-Sent Events stream handler
│   ├── session/
│   │   ├── SessionManager.ts    # Session lifecycle management
│   │   ├── SessionTreeProvider.ts  # Sessions sidebar tree view
│   │   └── SessionWebview.ts    # Session chat history webview panel
│   ├── chat/
│   │   ├── ChatPanel.ts         # Main chat input/output webview
│   │   ├── ChatInput.ts         # Message input component (with @-mentions)
│   │   ├── ToolRenderer.ts      # Tool execution status and results display
│   │   └── PermissionDialog.ts  # Permission request UI
│   ├── agent/
│   │   ├── AgentSelector.ts     # Agent quick pick and dropdown
│   │   └── AgentManager.ts      # Agent configuration management
│   ├── provider/
│   │   ├── ProviderSelector.ts  # AI provider/model selector
│   │   └── ModelConfig.ts       # Model configuration UI
│   ├── commands/
│   │   ├── index.ts             # Command registration
│   │   ├── sessionCommands.ts   # Session-related commands
│   │   ├── chatCommands.ts      # Chat-related commands
│   │   └── configCommands.ts    # Configuration commands
│   ├── config/
│   │   ├── ExtensionConfig.ts   # Extension workspace state
│   │   └── SettingsManager.ts   # VS Code settings integration
│   ├── ui/
│   │   ├── ThemeProvider.ts     # Dark/light theme support
│   │   └── Icons.ts             # Icon definitions
│   └── utils/
│       ├── UriUtils.ts          # URI/file path utilities
│       └── SelectionUtils.ts    # Editor selection utilities
├── webviews/
│   ├── chat/
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── main.ts              # Webview TypeScript (with @opencode-ai/sdk)
│   ├── session-history.html
│   └── components/
│       ├── ToolExecution.tsx
│       ├── MessageBubble.tsx
│       └── PermissionRequest.tsx
├── package.json
├── tsconfig.json
└── esbuild.js
```

### Core Components

#### 1. OpenCodeClient (`src/client/OpenCodeClient.ts`)

Wrapper around `@opencode-ai/sdk` with error handling, retries, and connection management.

```typescript
class OpenCodeClient {
  constructor(options: { baseUrl?: string, fetch?: typeof fetch })
  
  // Session operations
  createSession(opts: { title?, permission?, agent?, model? })
  listSessions(): Promise<SessionInfo[]>
  getSession(id: string): Promise<SessionInfo>
  deleteSession(id: string)
  forkSession(id: string)
  
  // Message operations
  prompt(id: string, opts: { agent?, model?, parts: Part[] })
  attachFile(id: string, file: FilePart)
  
  // Server status
  getServerStatus(): Promise<{ version, agents, providers }>
  
  // Event streaming
  subscribeEvents(): AsyncIterable<BusEvent>
}
```

#### 2. SessionManager (`src/session/SessionManager.ts`)

Manages session lifecycle with VS Code integration:

```typescript
class SessionManager {
  // Create sessions
  async createSession(options?)
  
  // Track active session
  activeSession: SessionInfo | null
  setActiveSession(id: string)
  
  // Sync with storage
  syncSessions()
  
  // VS Code integration
  openSessionInWebview(sessionId: string)
  showSessionHistoryPanel()
}
```

#### 3. ChatPanel (`src/chat/ChatPanel.ts`)

Main webview panel for chat interaction:

- **Input area**: Text input with `@` file/code mentions
- **Output display**: Streaming AI responses
- **Tool execution**: Status indicators, attachments, results
- **Agent switcher**: Quick agent selection dropdown
- **Model selector**: Provider/model configuration

#### 4. SessionTreeProvider (`src/session/SessionTreeProvider.ts`)

Sidebar tree view showing:

```
OpenCode Sessions
├── [Active] Fix header bug
│   ├── Messages (12)
│   └── Tools: bash, read, write
├── Archive: Initial setup
└── [Idle] Code review
```

Features:
- Session metadata (title, agent, timestamps)
- Message count and summary
- Active session highlighting
- Right-click actions (fork, delete, share, export)

#### 5. ToolRenderer (`src/chat/ToolRenderer.ts`)

Display tool execution in chat:

```typescript
// Pending tool (waiting for user input)
└─ read
    ℹ️ Ready to read src/index.ts:1-50

// Running tool (in progress)
└─ bash
    ⏳ Running: npm test...

// Completed tool (success)
└─ read ✓
    📄 src/index.ts:1-50 (lines shown)

// Failed tool (error)
└─ bash ✗
    ❌ Command failed: npm test
    Error: Tests failed in 3/5 cases
```

#### 6. PermissionDialog (`src/chat/PermissionDialog.ts`)

Interactive permission request UI:

```typescript
interface PermissionRequest {
  tool: string
  operation: string
  targets: string[]
  rule?: string
  askTime: number
}

// Dialog UI:
┌─────────────────────────────────┐
│ Permission Required             │
├─────────────────────────────────┤
│ Tool:    bash                   │
│ Command: rm -rf node_modules    │
│ Risk:    Destructive operation  │
│                                 │
│ [Allow once]  [Allow all]       │
│ [Deny]        [Deny tool]       │
└─────────────────────────────────┘
```

### Build/Test Commands

- **Install**: `cd extension && bun install`
- **Dev (compile)**: `bun run watch:esbuild` (auto-rebuild on changes)
- **Dev (typecheck)**: `bun run check-types`
- **Dev (test)**: `bun run test`
- **Package**: `bun run package` (production build)
- **Extension Dev**: Press `F5` in VS Code (opens Extension Development Host)

### Code Style

#### Modules & Runtime
- **Runtime**: Node.js with TypeScript (ESM)
- **Module**: `"module": "Node16"` in tsconfig.json
- **Build**: esbuild with tree-shaking

#### Import Style
- Relative imports: `import { SessionManager } from "../session/SessionManager"`
- VS Code API: `import * as vscode from "vscode"`
- SDK: `import { createOpencodeClient } from "@opencode-ai/sdk/v2"`

#### Naming Conventions
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Commands: `opencode.<category>.<action>` (e.g., `opencode.session.create`)
- Configuration keys: `opencode.<category>.<setting>` (e.g., `opencode.server.port`)

#### Error Handling
- Wrap SDK calls with try/catch
- Show `vscode.window.showErrorMessage()` for user-facing errors
- Use `vscode.window.showInformationMessage()` for success feedback
- Log errors with `vscode.window.createOutputChannel("OpenCode")`

### Key Features Implementation

#### 1. Integration with OpenCode Server

**Connection Modes:**
- **Auto (default)**: Start local OpenCode server (`opencode serve --port 4096`)
- **Remote**: Connect to existing server via URL
- **Embedded**: Use in-memory server (advanced)

**Configuration (package.json contributes):**

```json
{
  "configuration": {
    "title": "OpenCode",
    "properties": {
      "opencode.server.mode": {
        "type": "string",
        "enum": ["auto", "remote", "embedded"],
        "default": "auto"
      },
      "opencode.server.baseUrl": {
        "type": "string",
        "default": "http://localhost:4096"
      },
      "opencode.server.autoStart": {
        "type": "boolean",
        "default": true,
        "description": "Auto-start opencode server on extension activation"
      },
      "opencode.defaultAgent": {
        "type": "string",
        "default": "build"
      },
      "opencode.chat.showToolOutput": {
        "type": "boolean",
        "default": true
      }
    }
  }
}
```

#### 2. Chat/@ Mentions Integration

**File mention parsing:**

```typescript
// User types: "Fix the bug in @utils/helpers.ts#L42-50"
// → Detected as file reference with selection

// User types: "Explain @"
// → Show quick pick with open files:
//   - src/index.ts
//   - components/Button.tsx
//   - utils/helpers.ts

// User selects file → insert: "@src/index.ts"
// User adds selection → insert: "@src/index.ts#L12-45"
```

**Implementation:**

```typescript
// In ChatInput webview:
onTextChange(text: string) {
  const mentionMatch = text.match(/@([^\s]*)$/)
  if (mentionMatch) {
    const searchTerm = mentionMatch[1]
    this.showFileSuggestions(searchTerm)
  }
}
```

#### 3. VS Code Context Integration

**Right-click menu (context menus):**

```json
{
  "menus": {
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
      }
    ],
    "explorer/context": [
      {
        "command": "opencode.analyzeFile",
        "when": "resourceExtname =~ /\\.(ts|tsx|js|jsx|py|rs|go)$/i",
        "group": "opencode"
      }
    ]
  }
}
```

**Status Bar Integration:**

```typescript
// Status bar items
const sessionIndicator = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
sessionIndicator.text = "$(rocket) OpenCode: Active"
sessionIndicator.command = "opencode.session.show"
sessionIndicator.show()

const agentIndicator = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99)
agentIndicator.text = "$(sparkle) Agent: build"
agentIndicator.command = "opencode.agent.change"
agentIndicator.show()
```

#### 4. Tools Visualization

**Tool Execution States:**

| State | Icon | Display |
|-------|------|---------|
| pending | `⏳` | Ready to execute, waiting for user confirmation |
| running | `🔄` | Currently executing, shows spinner |
| completed | `✓` | Success, shows output in collapsible section |
| error | `✗` | Failed, shows error in collapsible section |

**Example display in webview:**

```html
<div class="tool-container" data-state="running">
  <div class="tool-header">
    <span class="tool-icon">🔄</span>
    <span class="tool-name">bash</span>
    <span class="tool-time">2s ago</span>
  </div>
  <div class="tool-output collapsible">
    <pre>npm run test...</pre>
  </div>
</div>
```

#### 5. Permission Flow

1. **Server** sends `permission.asked` event via SSE
2. **Extension** catches event → shows `PermissionDialog`
3. **User** chooses action (Allow/Deny)
4. **Extension** sends `POST /permission/:id/respond` with user choice
5. **Server** proceeds with tool execution

**Visual indicators:**
- Status bar: `🔒 Waiting for permission`
- Tool icon: `⏸️ Pending approval`
- Notification: Bell icon with "Permission required" message

#### 6. Session Management

**Create session:**

```typescript
// Command: opencode.session.create
async function createSession(options?: {
  title?: string
  agent?: string
  model?: { providerID, modelID }
}) {
  const client = await getOpenCodeClient()
  const session = await client.createSession(options)
  
  SessionManager.setActiveSession(session.id)
  SessionTreeProvider.refresh()
  
  // Open chat webview
  ChatPanel.show(session.id)
}
```

**Fork session:**

```typescript
// Command: opencode.session.fork
async function forkSessionAtMessage(sessionId: string, messageId: string) {
  const client = await getOpenCodeClient()
  const newSession = await client.forkSession(sessionId, messageId)
  
  vscode.window.showInformationMessage(`Created session: ${newSession.title}`)
}
```

#### 7. Webview Communication Protocol

**Extension → Webview (send to webview):**

```typescript
webviewPanel.postMessage({
  type: "sessionUpdate",
  session: sessionInfo
})

webviewPanel.postMessage({
  type: "messagePart",
  part: {
    id: string,
    type: "tool" | "text" | "reasoning",
    state: "running" | "completed" | "error",
    content: any
  }
})
```

**Webview → Extension (receive from webview):**

```typescript
webviewPanel.onDidReceiveMessage(async (message) => {
  switch (message.type) {
    case "sendMessage":
      await sendPrompt(message.sessionId, message.parts)
      break
    case "permissionResponse":
      await respondToPermission(message.permissionId, message.allowed)
      break
    case "openFile":
      await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(message.filePath)
      )
      break
    case "applyPatch":
      await applyPatchToEditor(message.patch)
      break
  }
})
```

### Development Workflow

#### Getting Started

1. **Setup project**:
   ```bash
   cd extension
   bun install
   ```

2. **Open as extension dev**:
   - Open VS Code
   - File → Open Folder
   - Select `extension/` directory
   - Press `F5` → Opens Extension Development Host

3. **Dev loop**:
   - Edit TypeScript files → auto-compiled by esbuild watcher
   - In Extension Dev Host: `Cmd+Shift+P` → "Developer: Reload Window"

#### Adding New Features

1. **Add command** (`src/commands/index.ts`):

```typescript
vscode.commands.registerCommand("opencode.feature.action", async () => {
  const client = await getOpenCodeClient()
  // ... implement
})
```

2. **Update package.json**:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "opencode.feature.action",
        "title": "My Feature Action"
      }
    ]
  }
}
```

3. **Add UI component**:

```bash
# For webview:
touch webviews/components/MyComponent.tsx

# Register in webviews/chat/main.ts:
import { MyComponent } from "../components/MyComponent"
```

#### Testing

```bash
# Run tests
bun run test

# Run with coverage
bun run test --coverage

# Run specific test file
bun run test session/SessionManager.test.ts
```

**Test structure:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { SessionManager } from "../src/session/SessionManager"

describe("SessionManager", () => {
  let manager: SessionManager
  
  beforeEach(() => {
    manager = new SessionManager()
  })
  
  afterEach(() => {
    manager.dispose()
  })
  
  it("should create a new session", async () => {
    const session = await manager.createSession({ title: "Test" })
    expect(session.title).toBe("Test")
  })
})
```

### Packaging & Publishing

1. **Build production bundle**:
   ```bash
   bun run package
   # Creates dist/extension.js
   ```

2. **Package vsix**:
   ```bash
   vsce package
   # Creates opencode-gui-{version}.vsix
   ```

3. **Publish to marketplace**:
   ```bash
   vsce publish
   # Requires: vsce login
   ```

### API Integration Notes

#### Using OpenCode SDK

The extension uses `@opencode-ai/sdk/v2` (TypeScript client):

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk/v2"

// Initialize client
const client = createOpencodeClient({
  baseUrl: "http://localhost:4096"
})

// Create session
const session = await client.session.create({
  title: "Fix button bug",
  permission: DEFAULT_PERMISSIONS
})

// Send message
const response = await client.session.prompt({
  sessionID: session.id,
  agent: "build",
  model: {
    providerID: "openai",
    modelID: "gpt-4o"
  },
  parts: [{
    type: "text",
    text: "Fix the button alignment issue"
  }]
})

// Subscribe to events
const { stream } = await client.event.subscribe()
for await (const event of stream) {
  // Handle events: message.part.updated, session.idle, etc.
}
```

#### Event Types

Major SSE events to handle:

| Event | Description | Action |
|-------|-------------|--------|
| `message.part.updated` | Message part state changed | Update webview UI |
| `session.idle` | Session finished | Update status, enable new prompts |
| `permission.asked` | Permission required | Show permission dialog |
| `session.error` | Session error | Show error notification |
| `tool.stdout` | Tool output stream | Display in tool output area |

### Security Considerations

1. **Credential storage**:
   - Store API keys in VS Code's `secrets` API
   - Never log or display API keys
   - Use `vscode.window.showInputBox()` with `password: true`

2. **File operations**:
   - Always confirm destructive operations (write, edit, delete)
   - Show file diff preview before applying changes
   - Implement undo via VS Code's document history

3. **Tool execution**:
   - Sandbox bash commands with timeout limits
   - Require explicit approval for system commands
   - Display command output truncation warning

4. **Network requests**:
   - Use HTTPS for remote OpenCode servers
   - Validate SSL certificates
   - Configure proxy settings via VS Code settings

### Performance Optimization

1. **Webview optimization**:
   - Lazy load components
   - Virtualize long message lists
   - Debounce resize events
   - Use CSS transforms for animations

2. **API caching**:
   - Cache session list (refresh on demand)
   - Cache agent/provider lists
   - Invalidate cache on relevant events

3. **Event streaming**:
   - Buffer SSE events before rendering
   - throttle UI updates (60fps max)
   - Disconnect SSE on webview disposal

4. **Memory management**:
   - Dispose unused webviews
   - Limit message history in webview (last 100 messages)
   - Clear event subscriptions on extension deactivation

### Future Enhancements

**Phase 1: Core Features**
- [x] Basic chat interface
- [x] Session management
- [x] File @ mentions
- [x] Tool visualization
- [x] Permission dialogs

**Phase 2: Advanced Integration**
- [ ] Diff preview for code changes
- [ ] Inline code suggestions (GPT-style)
- [ ] Multi-session comparison view
- [ ] Session export/import
- [ ] Custom agent builder UI

**Phase 3: AI Features**
- [ ] Context-aware suggestions
- [ ] Auto-fix diagnostics on save
- [ ] Code explanation hover actions
- [ ] Refactor quick actions
- [ ] Test generation assistance

**Phase 4: Collaboration**
- [ ] Share sessions via URL
- [ ] Real-time collaboration (multi-user)
- [ ] Comment annotations on code
- [ ] Session reviews and approvals
