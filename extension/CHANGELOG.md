# Changelog

All notable changes to the opencode-gui extension will be documented in this file.

## [0.0.2] - 2025-01-21

### Added

- **Reasoning Display** - Collapsible thinking UI for agent reasoning
  - Header with "Thinking..." label and collapse toggle
  - Auto-collapse on completion with expandable content
  - Max-height limit with scroll for long reasoning
  - Session idle auto-collapse all reasoning boxes

- **Session History** - Full session message history support
  - `getSessionMessages()` API client方法
  - Session switch loads historical messages
  - Message history restored on webview init

- **Enhanced Webview Layout** - Improved message part rendering
  - Separate header/content structure for reasoning parts
  - Visual collapse icons (▼/▲)
  - Hover effects on reasoning headers
  - Better content separation and readability

### Changed

- **Command Implementation** - Promoted session commands from placeholders to functional implementations
  - `createSession` - Now creates actual sessions and opens chat panel
  - `setActiveSession` - Properly marks session as active with visual indicators
  - `deleteSession` - Deletes session with confirmation and updates UI
  - `forkSession` - Creates fork from session with optional message ID
  - `showSession` - Opens session in chat panel with proper activation

- **Session Tree Provider** - Integrated with ChatPanel for consistent session opening
- **ChatPanel** - Async session switch with history loading

### Fixed

- **Session Loading** - Ensure sessions map is cleared before reloading to prevent duplicate entries
- **Context Value** - Add support for `archived` status in tree item context values
- **Command Registration** - Fixed delete command to handle both string IDs and tree item objects
- **Reasoning Collapse** - Fixed state management for reason parts with proper ID tracking

---

## [0.0.1] - 2025-01-20

### Initial Release

- Basic infrastructure with OpenCodeClient and SSE event handling
- Session sidebar tree view (placeholder)
- Chat panel (placeholder)
- Agent and provider configuration (placeholder)
- Permission system (placeholder)
- Command registration framework
