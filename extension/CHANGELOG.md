# Changelog

All notable changes to the opencode-gui extension will be documented in this file.

## [0.0.2] - 2025-01-21

### Added

- **Session Management UI** - Enhanced session sidebar with improved UX
  - "新建任务" (Create Session) command with plus icon
  - Session list refresh functionality
  - Inline delete button in tree view items

### Changed

- **Command Implementation** - Promoted session commands from placeholders to functional implementations
  - `createSession` - Now creates actual sessions and opens chat panel
  - `setActiveSession` - Properly marks session as active with visual indicators
  - `deleteSession` - Deletes session with confirmation and updates UI
  - `forkSession` - Creates fork from session with optional message ID
  - `showSession` - Opens session in chat panel with proper activation

### Fixed

- **Session Loading** - Ensure sessions map is cleared before reloading to prevent duplicate entries
- **Context Value** - Add support for `archived` status in tree item context values
- **Command Registration** - Fixed delete command to handle both string IDs and tree item objects

---

## [0.0.1] - 2025-01-20

### Initial Release

- Basic infrastructure with OpenCodeClient and SSE event handling
- Session sidebar tree view (placeholder)
- Chat panel (placeholder)
- Agent and provider configuration (placeholder)
- Permission system (placeholder)
- Command registration framework
