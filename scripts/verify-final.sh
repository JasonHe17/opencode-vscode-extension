#!/bin/bash

set -e

echo "=== Final Integration Verification ==="
echo ""

echo "Running all phase verifications..."

echo ""
echo "--- Phase 1 (Infrastructure + Commands) ---"
./scripts/verify-phase1.sh || exit 1

echo ""
echo "--- Phase 2 (Session + AI Config + Permissions) ---"
./scripts/verify-phase2.sh || exit 1

echo ""
echo "--- Phase 3 (Chat + Sidebar + Integration) ---"
./scripts/verify-phase3.sh || exit 1

echo ""
echo "=== All Automated Checks Passed ==="
echo ""

echo "🎯 Manual Testing Checklist:"
echo ""
echo "VS Code Extension Tests:"
echo "  [ ] Status bar shows 3 indicators (Session, Agent, Server)"
echo "  [ ] Activity bar has OpenCode icon"
echo "  [ ] Sidebar displays session tree view"
echo "  [ ] Command palette shows all OpenCode commands"
echo "  [ ] Context menu on file shows OpenCode options"
echo ""
echo "Hotkey Tests:"
echo "  [ ] Cmd+Escape opens chat panel"
echo "  [ ] Cmd+Shift+Escape creates new session"
echo "  [ ] Cmd+K Cmd+E explains selection"
echo ""
echo "Chat Panel Tests:"
echo "  [ ] Chat input accepts text"
echo "  [ ] @file mention shows suggestions"
echo "  [ ] Session switching works"
echo ""
echo "Sidebar Tests:"
echo "  [ ] Session list displays"
echo "  [ ] Right-click menu shows options"
echo ""

echo "=== Final Verification Complete ==="
echo "🚀 Ready to package the extension!"
