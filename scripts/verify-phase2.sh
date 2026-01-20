#!/bin/bash

set -e

echo "=== Phase 2 Verification (Module B + E + F) ==="
echo ""

echo "1. Checking file structure..."
test -f extension/src/session/SessionManager.ts || { echo "❌ SessionManager.ts missing"; exit 1; }
test -f extension/src/session/SessionWebview.ts || { echo "❌ SessionWebview.ts missing"; exit 1; }
test -f extension/src/agent/AgentSelector.ts || { echo "❌ AgentSelector.ts missing"; exit 1; }
test -f extension/src/agent/AgentManager.ts || { echo "❌ AgentManager.ts missing"; exit 1; }
test -f extension/src/provider/ProviderSelector.ts || { echo "❌ ProviderSelector.ts missing"; exit 1; }
test -f extension/src/provider/ModelConfig.ts || { echo "❌ ModelConfig.ts missing"; exit 1; }
test -f extension/src/chat/PermissionDialog.ts || { echo "❌ PermissionDialog.ts missing"; exit 1; }
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
echo "5. Verifying module dependencies..."
node -e "
// 检查SessionManager是否依赖OpenCodeClient
const sm = require('fs').readFileSync('src/session/SessionManager.ts', 'utf-8');
if (!sm.includes('OpenCodeClient') || !sm.includes('ExtensionConfig')) {
  console.error('SessionManager missing dependencies');
  process.exit(1);
}
console.log('✓ SessionManager dependencies verified');

// 检查AgentSelector是否依赖OpenCodeClient
const as = require('fs').readFileSync('src/agent/AgentSelector.ts', 'utf-8');
if (!as.includes('OpenCodeClient')) {
  console.error('AgentSelector missing dependency');
  process.exit(1);
}
console.log('✓ AgentSelector dependencies verified');

// 检查PermissionDialog是否依赖OpenCodeClient
const pd = require('fs').readFileSync('src/chat/PermissionDialog.ts', 'utf-8');
if (!pd.includes('OpenCodeClient')) {
  console.error('PermissionDialog missing dependency');
  process.exit(1);
}
console.log('✓ PermissionDialog dependencies verified');
"

echo ""
echo "=== Phase 2 Verification Complete ==="
echo "✅ All checks passed"
