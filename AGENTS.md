# OpenCode Agent Guidelines

## Build/Test Commands

- **Install dependencies**: `cd extension && bun install`
- **Watch (dev)**: `bun run watch:esbuild` (auto-rebuild on changes)
- **Typecheck**: `bun run check-types`
- **Lint**: `bun run lint` (eslint src)
- **Test**: `bun run test` (vscode-test)
- **Run single test**: `bun test test/path/to/test.test.ts`
- **Package**: `bun run package`
- **Extension Dev**: Press `F5` in VS Code (opens Extension Development Host)

## Code Style

### Runtime & Modules
- **Runtime**: Node.js with TypeScript ESM (`"type": "module"`)
- **Package manager**: Bun
- **Build**: esbuild with tree-shaking

### Import Style
- Relative imports: `import { Foo } from "./foo.js"`
- VS Code API: `import * as vscode from "vscode"`
- SDK imports: `import { createOpencodeClient } from "@opencode-ai/sdk/v2"`
- Add `.js` extension to relative imports

### Type System
- Use TypeScript with `@typescript-eslint/eslint-plugin`
- Prefer explicit types over `any` (warned by linter)
- Unused parameters: prefix with `_` to suppress warnings
- Interface naming: `PascalCase` (e.g., `SessionInfo`, `BusEvent`)

### Naming Conventions
- Classes: `PascalCase` (e.g., `OpenCodeClient`)
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Commands: `opencode.<category>.<action>` (e.g., `opencode.session.create`)
- Test files: `*.test.ts` (e.g., `OpenCodeClient.test.ts`)

### Error Handling
- Wrap SDK calls with try/catch
- Use `vscode.window.showErrorMessage()` for user-facing errors
- Use `vscode.window.showInformationMessage()` for success feedback
- Log errors to console, avoid exposing secrets

### File Structure & Architecture
- Main entry: `extension/src/main.ts`
- Client wrapper: `extension/src/client/OpenCodeClient.ts` (singleton pattern)
- Session management: `extension/src/session/`
- Chat UI: `extension/src/chat/`
- Commands: `extension/src/commands/index.ts`
- Webviews: `extension/webviews/`
- Tests: `extension/test/` mirroring src structure

### Formatting
- **ESLint**: Configured with `@typescript-eslint/no-explicit-any: warn`
- **No semicolons**: Follow existing patterns in codebase
- **Line length**: Keep reasonable (~120 chars suggested)

### Tool Implementation
- Define tools using SDK via `@opencode-ai/sdk`
- Client singleton: `OpenCodeClient.getInstance(baseUrl)`
- Always include sessionID in context
- Handle async operations with proper error propagation

### Testing
- Use `bun:test` framework: `import { describe, it, expect } from "bun:test"`
- Test structure: `describe("ClassName", () => { it("should...", () => { ... } })`
- Run tests via `bun test` command

### Best Practices
- Use singleton pattern for `OpenCodeClient`
- Lazy-load webview components
- Dispose subscriptions in cleanup: `context.subscriptions.push(...)`
- Use VS Code's OutputChannel for logging: `vscode.window.createOutputChannel("OpenCode")`
- Store sensitive data in VS Code secrets API, never logs
- Handle file paths using `vscode.Uri.fsPath`

### Commands & Contributes
- Register commands in `src/commands/index.ts`
- Update `package.json` contributes for new commands
- Command format: `opencode.<category>.<action>`
- Use `when` clauses for context-aware commands (e.g., `editorHasSelection`)
- Add to appropriate menus: `editor/context`, `explorer/context`, `commandPalette`

### Webview Communication
- Extension → Webview: `webview.postMessage({ type: "...", ... })`
- Webview → Extension: `webviewPanel.onDidReceiveMessage()`
- Message types: `sessionUpdate`, `messagePart`, `sendMessage`, `openFile`
- Handle message types with switch statements

### Event Streaming (SSE)
- Use `client.subscribeEvents()` for real-time updates
- Handle events: `message.part.updated`, `session.idle`, `permission.asked`
- Store event stream reference to cleanup on disposal
