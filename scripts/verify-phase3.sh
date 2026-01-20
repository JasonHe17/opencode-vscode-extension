#!/bin/bash

set -e

echo "=== Phase 3 Verification (Module C + D + H) ==="
echo ""

echo "1. Checking file structure..."
test -f extension/src/main.ts || { echo "❌ main.ts missing"; exit 1; }
test -f extension/src/ui/Icons.ts || { echo "❌ Icons.ts missing"; exit 1; }
test -f extension/src/chat/ChatPanel.ts || { echo "❌ ChatPanel.ts missing"; exit 1; }
test -f extension/src/chat/ChatInput.ts || { echo "❌ ChatInput.ts missing"; exit 1; }
test -f extension/src/chat/ToolRenderer.ts || { echo "❌ ToolRenderer.ts missing"; exit 1; }
test -f extension/src/session/SessionTreeProvider.ts || { echo "❌ SessionTreeProvider.ts missing"; exit 1; }
test -f extension/src/session/SessionTreeItem.ts || { echo "❌ SessionTreeItem.ts missing"; exit 1; }
test -f extension/webviews/chat/index.html || { echo "❌ webview index.html missing"; exit 1; }
test -f extension/webviews/chat/styles.css || { echo "❌ webview styles.css missing"; exit 1; }
test -f extension/webviews/chat/main.ts || { echo "❌ webview main.ts missing"; exit 1; }
echo "✓ All files present"

echo ""
echo "2. Running type check..."
cd extension
npx tsc --noEmit 2>&1 | grep -v "../packages/opencode-sdk" | grep -v "^$" | wc -l | xargs -I {} test {} -eq 0 || { echo "❌ Type check failed"; exit 1; }
echo "✓ Type check passed"

echo ""
echo "3. Running lint..."
bun run lint || { echo "❌ Lint failed"; exit 1; }
echo "✓ Lint passed"

echo ""
echo "4. Running compile..."
bun run compile || { echo "❌ Compile failed"; exit 1; }
echo "✓ Compilation successful"

echo ""
echo "5. Verifying package.json contributes..."
node -e "
const pkg = require('./package.json');

// 检查views
if (!pkg.contributes.viewsContainers || !pkg.contributes.views) {
  console.error('Missing views configuration');
  process.exit(1);
}

// 检查commands
const cmds = pkg.contributes.commands.map(c => c.command);
const essentialCmds = [
  'opencode.session.create',
  'opencode.chat.open',
  'opencode.session.delete',
  'opencode.session.fork'
];
const missing = essentialCmds.filter(c => !cmds.includes(c));
if (missing.length > 0) {
  console.error('Missing essential commands:', missing);
  process.exit(1);
}
console.log('✓ Package.json contributes verified');

// 检查menus
const menus = Object.keys(pkg.contributes.menus || {});
console.log('Menus defined:', menus.join(', '));
"

echo ""
echo "6. Verifying main.ts initialization..."
node -e "
const main = require('fs').readFileSync('src/main.ts', 'utf-8');

// 检查关键初始化函数
const requiredInits = [
  'initializeInfrastructure',
  'initializeConfiguration',
  'initializeSessionManager',
  'initializeAIConfig',
  'initializePermissionSystem',
  'initializeChatPanel',
  'initializeSidebar',
  'initializeCommands',
  'initializeStatusBar'
];

const missing = requiredInits.filter(init => !main.includes(init));
if (missing.length > 0) {
  console.error('Missing initialization functions:', missing);
  process.exit(1);
}
console.log('✓ All initialization functions present');

// 检查命令注册
if (!main.includes('registerAllCommands')) {
  console.error('Missing registerAllCommands call');
  process.exit(1);
}
console.log('✓ Command registration verified');
"

echo ""
echo "=== Phase 3 Verification Complete ==="
echo "✅ All checks passed"
echo ""
echo "⚠️  Manual testing required:"
echo "   1. Press F5 to launch Extension Development Host"
echo "   2. Verify status bar indicators"
echo "   3. Test command palette (OpenCode commands)"
echo "   4. Test sidebar tree view"
echo "   5. Test chat panel (Cmd+Escape)"
