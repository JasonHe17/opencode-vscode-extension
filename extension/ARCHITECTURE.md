# OpenCode VS Code Extension Architecture

## Scope

This document defines the target architecture for the OpenCode VS Code extension (the GUI integration for the OpenCode CLI/server). It is the source of truth for module boundaries, data flow, and extension/webview responsibilities.

## Goals

- Stable rendering and predictable UI state.
- Clear layering and ownership of data flow.
- Minimal coupling to the OpenCode server API.
- Testable units with explicit dependencies.
- Safe concurrent session updates without UI regressions.

## Constraints

- The OpenCode server is an external dependency and cannot be modified.
- The extension must work in VS Code’s webview and extension host constraints.
- Network latency and SSE ordering are variable.

## Layered Architecture

```
Extension Host (Node)
  ├─ App Composition (activation, DI, lifecycle)
  ├─ Domain (session, message, tool, permission state)
  ├─ Services (OpenCode client, server manager, settings)
  ├─ Adapters (VS Code API, storage, telemetry, file system)
  └─ UI Bridges (webview messaging + state sync)

Webview (Browser)
  ├─ UI Shell (HTML/CSS)
  ├─ State Store (single source of truth)
  └─ Views (chat, sidebar, settings, tool output)
```

### 1) App Composition
**Responsibility**: Compose dependencies and own lifecycle.
- Activation should only call a single `bootstrap()`.
- All services are created once and injected into modules.
- `deactivate()` disposes all resources via a single `App.dispose()`.

### 2) Domain Layer
**Responsibility**: Pure data models, invariants, and reducers.
- Session state: `Session`, `SessionSummary`.
- Message state: `Message`, `MessagePart`, `ToolState`.
- Permission state: `PermissionRequest`, `PermissionDecision`.
- Reducers: single entry for state transitions.

**Rule**: No VS Code API, no network. Domain is deterministic.

### 3) Services Layer
**Responsibility**: IO and external dependencies.
- `OpenCodeService`: wraps SDK, SSE, and polling.
- `SessionService`: API for session CRUD.
- `SettingsService`: VS Code settings + cached config.
- `ServerService`: auto-start and health checks.

**Rule**: Services expose narrow interfaces and return typed results.

### 4) Adapters Layer
**Responsibility**: Integration with VS Code APIs and storage.
- Tree view provider, status bar, quick picks.
- Workspace file access and selection utilities.
- Extension storage and secret management.

### 5) UI Bridge Layer
**Responsibility**: Webview messaging and state sync.
- `WebviewBridge`: serialize state, handle postMessage.
- `WebviewRouter`: route incoming UI events to services.
- `SyncController`: pushes domain state to webview, diffs optional.

## Webview Architecture

- Single state store in webview; UI renders from it only.
- UI does not call OpenCode APIs directly; all requests go through the bridge.
- Webview actions are declarative (e.g., `dispatch({ type: "sendMessage" })`).
- Webview receives state snapshots or patch updates (no raw SSE events).

## Data Flow

### Event Ingestion
1. `OpenCodeService` receives SSE events.
2. Events are validated and mapped to domain events.
3. Domain reducers update state.
4. `SyncController` pushes new state to webview.

### User Action
1. Webview sends action to `WebviewRouter`.
2. Router calls a service method (e.g., `sendMessage`).
3. Service returns a result and emits domain events.
4. Domain state updates and syncs back to webview.

## Rendering Stability Principles

- **Single Source of Truth**: No UI-only duplication of session/message state.
- **Event Ordering**: SSE events are buffered per session; stale events dropped.
- **Session Isolation**: Only the active session updates the active webview view.
- **Idempotency**: Replaying events must not duplicate UI rows.
- **Atomic Update**: Message parts update only through the reducer.

## Proposed Folder Layout (extension/src)

```
app/
  bootstrap.ts
  container.ts
  lifecycle.ts

domain/
  session.ts
  message.ts
  tool.ts
  permission.ts
  reducers.ts

services/
  opencode/
    OpenCodeService.ts
    SSEStream.ts
    models.ts
  SessionService.ts
  SettingsService.ts
  ServerService.ts

adapters/
  vscode/
    StatusBar.ts
    TreeView.ts
    Commands.ts
    Webview.ts
  storage/
    ExtensionStorage.ts

bridge/
  WebviewBridge.ts
  WebviewRouter.ts
  SyncController.ts

ui/
  chat/
  sidebar/
  settings/

shared/
  types.ts
  events.ts
  utils/
```

## Integration Contracts

### Domain Events
- `SessionCreated`, `SessionLoaded`, `SessionSwitched`
- `MessageCreated`, `MessagePartUpdated`, `ToolUpdated`
- `PermissionRequested`, `PermissionResolved`

### Webview Actions
- `init`, `sendMessage`, `changeAgent`, `changeModel`
- `attachFile`, `requestFileSuggestions`, `openFile`

## Testing Strategy

- Unit tests for reducers and services (no VS Code APIs).
- Integration tests for `OpenCodeService` with mocked SSE.
- Adapter tests only for VS Code-specific behavior.

## Migration Strategy

1. Introduce new `domain/` and `services/` without changing UI behavior.
2. Route SSE events through domain reducers.
3. Centralize webview state sync through `SyncController`.
4. Simplify `main.ts` to only call `bootstrap()`.
5. Remove legacy direct calls from UI to services.

## Non-Goals

- Changing OpenCode server behavior.
- Rebuilding the webview UI framework.

