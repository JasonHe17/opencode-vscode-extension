# Changelog

All notable changes to the opencode-gui extension will be documented in this file.

## [0.1.1] - 2025-01-23

### Added
- Tool output section labels with improved styling
- Command section for bash/tool execution showing the command being run
- Toggle functionality for collapsing tool output sections
- Error display in tool output sections with dedicated formatting
- CSS link handling in webview HTML template

### Changed
- Improved tool execution data parsing to correctly access state properties
- Enhanced tool HTML construction with better state/status handling
- Refactored tool output rendering with collapsible sections
- Improved error handling for tool rendering failures
- Better visual separation between command and output sections
- Terminal-like styling for tool output

### Fixed
- Fixed tool state data access (now correctly reads from state.input/output/error)
- Fixed tool update event handling to properly merge tool data
- Fixed webview CSS loading by adding proper URI replacement

---

## [0.1.0] - 2025-01-22

### Added
- Domain-driven design architecture refactoring
- Module structure (A-H) for better code organization

### Changed
- Restructured extension architecture
- Improved separation of concerns across modules

---

## [0.0.3] - 2025-01-22

### Fixed
- Corrected message role display for historical session messages in chat panel
- Messages now display with proper role (user/assistant) when loading session history

### Fixed
- Session history loading now correctly preserves message roles from API response

---

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
