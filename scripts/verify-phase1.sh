#!/bin/bash

set -e

echo "=== Phase 1 Verification (Module A + G) ==="
echo ""

echo "1. Checking file structure..."
test -f extension/src/client/OpenCodeClient.ts || { echo "❌ OpenCodeClient.ts missing"; exit 1; }
test -f extension/src/client/SSEHandler.ts || { echo "❌ SSEHandler.ts missing"; exit 1; }
test -f extension/src/config/ExtensionConfig.ts || { echo "❌ ExtensionConfig.ts missing"; exit 1; }
test -f extension/src/config/SettingsManager.ts || { echo "❌ SettingsManager.ts missing"; exit 1; }
test -f extension/src/utils/UriUtils.ts || { echo "❌ UriUtils.ts missing"; exit 1; }
test -f extension/src/utils/SelectionUtils.ts || { echo "❌ SelectionUtils.ts missing"; exit 1; }
test -f extension/src/commands/index.ts || { echo "❌ commands/index.ts missing"; exit 1; }
test -f extension/src/commands/sessionCommands.ts || { echo "❌ sessionCommands.ts missing"; exit 1; }
test -f extension/src/commands/chatCommands.ts || { echo "❌ chatCommands.ts missing"; exit 1; }
test -f extension/src/commands/configCommands.ts || { echo "❌ configCommands.ts missing"; exit 1; }
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
test -f dist/extension.js || { echo "❌ dist/extension.js not generated"; exit 1; }
echo "✓ Compilation successful"

echo ""
echo "5. Verifying package.json..."
node -e "
const pkg = require('./package.json');
const requiredCmds = ['opencode.session.create', 'opencode.chat.open', 'opencode.chat.explainSelection'];
const definedCmds = pkg.contributes.commands.map(c => c.command);
const missing = requiredCmds.filter(c => !definedCmds.includes(c));
if (missing.length > 0) {
  console.error('Missing commands:', missing);
  process.exit(1);
}
console.log('✓ All required commands defined');
"
echo ""

echo "=== Phase 1 Verification Complete ==="
echo "✅ All checks passed"
