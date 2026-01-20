# 模块验收指南

## 验收概述

每个Phase的验收分为三个层级：

1. **L1: 代码完整性** - 文件和代码结构检查
2. **L2: 自动化测试** - 编译、类型检查、语法检查
3. **L3: 功能验证** - 手动测试和集成验证

---

## Phase 1: 基础设施层验收

### Module A: 基础设施层

#### L1: 代码完整性检查

```bash
# 检查文件是否存在
cd extension
ls -la src/client/
ls -la src/config/
ls -la src/utils/

# 预期输出：
# src/client/
#   OpenCodeClient.ts
#   SSEHandler.ts
# src/config/
#   ExtensionConfig.ts
#   SettingsManager.ts
# src/utils/
#   UriUtils.ts
#   SelectionUtils.ts
```

**检查点清单**:
- [ ] OpenCodeClient.ts 存在且至少包含所有public方法
- [ ] SSEHandler.ts 存在且实现connect/on/disconnect
- [ ] ExtensionConfig.ts 实现get/set/loadConfig/saveConfig
- [ ] SettingsManager.ts 实现get/set/watch/refresh
- [ ] UriUtils.ts 实现toAbsolutePath/toRelativePath/getWorkspaceFolder/toUri
- [ ] SelectionUtils.ts 实现getFileMention/getActiveSelection/hasSelection/insertIntoEditor

#### L2: 自动化测试

```bash
cd extension
bun install

# 类型检查
bun run check-types
# 预期: 无输出（成功）

# ESLint检查
bun run lint
# 预期: 无错误（可能有warning）

# 编译测试
bun run compile
# 预期: 生成dist/extension.js
```

**预期结果标准**:
- ✅ `check-types` 无错误
- ✅ `lint` 无error（warning可忽略）
- ✅ `compile` 成功生成dist目录

#### L3: 功能验证

创建测试文件 `test/module-a-test.js`:

```javascript
// 注意：这是临时功能测试文件，验收后可删除

import { OpenCodeClient } from "../src/client/OpenCodeClient"
import { SSEHandler } from "../src/client/SSEHandler"
import { ExtensionConfig } from "../src/config/ExtensionConfig"
import { SettingsManager } from "../src/config/SettingsManager"
import { UriUtils } from "../src/utils/UriUtils"
import { SelectionUtils } from "../src/utils/SelectionUtils"

// 测试1: OpenCodeClient单例
const client1 = OpenCodeClient.getInstance()
const client2 = OpenCodeClient.getInstance()
console.assert(client1 === client2, "OpenCodeClient should be singleton")
console.log("✓ OpenCodeClient singleton test passed")

// 测试2: UriUtils基本功能
const testUri = { fsPath: "/home/user/project/src/index.ts" }
const relative = UriUtils.toRelativePath(testUri, { fsPath: "/home/user/project" })
console.assert(relative === "src/index.ts", "toRelativePath failed")
console.log("✓ UriUtils test passed")

// 测试3: SettingsManager
const settings = SettingsManager.getInstance()
const mode = settings.get("opencode.server.mode")
console.assert(mode === "auto" || mode === "remote", "SettingsManager failed")
console.log("✓ SettingsManager test passed")

console.log("\n=== Module A Functional Tests Passed ===")
```

执行测试：
```bash
node test/module-a-test.js
```

---

### Module G: 命令注册框架

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/commands/

# 预期输出：
# commands/
#   index.ts
#   sessionCommands.ts
#   chatCommands.ts
#   configCommands.ts
```

**检查点清单**:
- [ ] commands/index.ts 包含registerAllCommands并调用所有子模块注册
- [ ] sessionCommands.ts 包含createSession/setActiveSession/deleteSession/forkSession/showSession
- [ ] chatCommands.ts 包含openChat/sendMessage/attachFile/explainSelection/refactorSelection/generateTests
- [ ] configCommands.ts 包含openSettings/selectAgent/selectModel/setApiKey
- [ ] package.json包含所有contributes定义

#### L2: 自动化测试

```bash
cd extension

# 类型检查
bun run check-types

# ESLint检查
bun run lint

# 编译测试
bun run compile
```

**预期结果标准**:
- ✅ `check-types` 无错误
- ✅ `lint` 无error
- ✅ `compile` 成功

#### L3: 功能验证

检查package.json contributes:

```bash
# 提取并验证package.json中的commands
node -e "
const pkg = require('./package.json');
console.log('Commands defined:', pkg.contributes.commands.length);
console.log('Keybindings defined:', pkg.contributes.keybindings?.length || 0);
console.log('Menus defined:', Object.keys(pkg.contributes.menus || {}).length);
console.log('Configuration properties:', Object.keys(pkg.contributes.configuration?.properties || {}).length);

// 验证必备命令
const requiredCmds = [
  'opencode.session.create',
  'opencode.chat.open',
  'opencode.chat.explainSelection',
  'opencode.config.selectModel'
];
const definedCmds = pkg.contributes.commands.map(c => c.command);
const missing = requiredCmds.filter(c => !definedCmds.includes(c));
if (missing.length > 0) {
  console.error('Missing commands:', missing);
  process.exit(1);
}
console.log('✓ All required commands defined');
"
```

---

## Phase 1 综合验收

### 验收命令（一键执行）

创建 `scripts/verify-phase1.sh`:

```bash
#!/bin/bash

set -e

echo "=== Phase 1 Verification ==="
echo ""

echo "1. Checking file structure..."
test -f extension/src/client/OpenCodeClient.ts || { echo "❌ OpenCodeClient.ts missing"; exit 1; }
test -f extension/src/client/SSEHandler.ts || { echo "❌ SSEHandler.ts missing"; exit 1; }
test -f extension/src/config/ExtensionConfig.ts || { echo "❌ ExtensionConfig.ts missing"; exit 1; }
test -f extension/src/config/SettingsManager.ts || { echo "❌ SettingsManager.ts missing"; exit 1; }
test -f extension/src/utils/UriUtils.ts || { echo "❌ UriUtils.ts missing"; exit 1; }
test -f extension/src/utils/SelectionUtils.ts || { echo "❌ SelectionUtils.ts missing"; exit 1; }
test -f extension/src/commands/index.ts || { echo "❌ commands/index.ts missing"; exit 1; }
echo "✓ All files present"

echo ""
echo "2. Running type check..."
cd extension
bun run check-types || { echo "❌ Type check failed"; exit 1; }
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
```

执行验收：
```bash
chmod +x scripts/verify-phase1.sh
./scripts/verify-phase1.sh
```

### Phase 1 签署清单

- [ ] Module A文件完整性 ✅
- [ ] Module G文件完整性 ✅
- [ ] package.json包含所有contributes ✅
- [ ] 类型检查通过 ✅
- [ ] ESLint检查通过 ✅
- [ ] 编译成功 ✅
- [ ] 基础功能测试通过 ✅

**验收人**: ____________  日期: ____________

---

## Phase 2: 核心管理层验收

### Module B: 会话管理

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/session/

# 预期输出：
# session/
#   SessionManager.ts
#   SessionWebview.ts
```

**检查点清单**:
- [ ] SessionManager.ts 实现createSession/loadSessions/setActiveSession/deleteSession/forkSession
- [ ] SessionManager.ts 实现事件系统(onSessionEvent)
- [ ] SessionWebview.ts 实现show/updatePanel/getHtmlContent
- [ ] 依赖Module A的OpenCodeClient和ExtensionConfig

#### L2: 自动化测试

```bash
cd extension
bun run check-types
bun run lint
bun run compile
```

#### L3: 功能验证

创建单元测试 `test/session/SessionManager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test"
import { SessionManager } from "../../src/session/SessionManager"

describe("SessionManager", () => {
  let manager: SessionManager

  // 注意：需要模拟vscode API和OpenCodeClient

  it("should create singleton instance", () => {
    const manager1 = SessionManager.getInstance(mockContext)
    const manager2 = SessionManager.getInstance()
    expect(manager1).toBe(manager2)
  })

  it("should return null for active session initially", () => {
    const active = manager.getActiveSession()
    expect(active).toBeNull()
  })

  it("should have getActiveSession method", () => {
    expect(typeof manager.getActiveSession).toBe("function")
  })

  it("should have createSession method", () => {
    expect(typeof manager.createSession).toBe("function")
  })

  it("should have deleteSession method", () => {
    expect(typeof manager.deleteSession).toBe("function")
  })

  it("should have forkSession method", () => {
    expect(typeof manager.forkSession).toBe("function")
  })

  it("should have onSessionEvent method", () => {
    expect(typeof manager.onSessionEvent).toBe("function")
  })
})
```

运行测试：
```bash
bun test test/session/SessionManager.test.ts
```

---

### Module E: AI配置管理

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/agent/
ls -la src/provider/

# 预期输出：
# agent/
#   AgentSelector.ts
#   AgentManager.ts
# provider/
#   ProviderSelector.ts
#   ModelConfig.ts
```

**检查点清单**:
- [ ] AgentSelector.ts 实现showAgentPicker/getAgentList/setAgent/getAgentInfo
- [ ] AgentManager.ts 实现createAgent/updateAgent/deleteAgent/showAgentConfigUI
- [ ] ProviderSelector.ts 实现showProviderPicker/showModelPicker/setModel
- [ ] ModelConfig.ts 实现showModelConfig/updateModelOptions/getModelConfig

#### L2: 自动化测试

```bash
bun run check-types
bun run lint
bun run compile
```

---

### Module F: 权限系统

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/chat/

# 预期输出：
# chat/
#   PermissionDialog.ts
```

**检查点清单**:
- [ ] PermissionDialog.ts 实现showPermissionRequest
- [ ] 支持4种PermissionAction（allowOnce/allowAll/deny/denyTool）
- [ ] 依赖Module A的OpenCodeClient

#### L2: 自动化测试

```bash
bun run check-types
bun run lint
bun run compile
```

---

## Phase 2 综合验收

### 验收命令

创建 `scripts/verify-phase2.sh`:

```bash
#!/bin/bash

set -e

echo "=== Phase 2 Verification ==="
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
bun run check-types || { echo "❌ Type check failed"; exit 1; }
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
echo "5. Running unit tests..."
bun test test/session/ || { echo "❌ Tests failed"; exit 1; }
echo "✓ Unit tests passed"

echo ""
echo "6. Verifying module dependencies..."
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
```

---

## Phase 3: UI集成层验收

### Module C: 聊天面板

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/chat/
ls -la webviews/chat/

# 预期输出：
# chat/
#   ChatPanel.ts
#   ChatInput.ts
#   ToolRenderer.ts
# webviews/chat/
#   index.html
#   styles.css
#   main.ts
```

**检查点清单**:
- [ ] ChatPanel.ts 实现show/switchSession/sendMessage/addMessage/updateMessagePart
- [ ] ChatInput.ts 实现handleTextInput/showFileSuggestions/insertFileReference
- [ ] ToolRenderer.ts 实现renderItem/renderToolOutput/renderAttachments
- [ ] webview文件完整且语法正确

#### L2: 自动化测试

```bash
bun run check-types
bun run lint
bun run compile
```

---

### Module D: 会话侧边栏

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/session/

# 预期输出：
# session/
#   SessionTreeProvider.ts
#   SessionTreeItem.ts
```

**检查点清单**:
- [ ] SessionTreeItem.ts 实现TreeItem接口和图标
- [ ] SessionTreeProvider.ts 实现TreeDataProvider接口
- [ ] SessionTreeProvider.ts 实现openSession/forkSession/deleteSession/exportSession

#### L2: 自动化测试

```bash
bun run check-types
bun run lint
bun run compile
```

---

### Module H: VS Code集成

#### L1: 代码完整性检查

```bash
cd extension
ls -la src/
ls -la src/ui/

# 预期输出：
# main.ts
# ui/
#   Icons.ts
```

**检查点清单**:
- [ ] main.ts 实现activate函数并调用所有初始化函数
- [ ] main.ts 实现deactivate函数并正确清理资源
- [ ] Icons.ts 定义所有图标类
- [ ] 导出activate和deactivate

#### L2: 自动化测试

```bash
bun run check-types
bun run lint
bun run compile
```

#### L3: 扩展测试

```bash
# 在VS Code Extension Development Host中测试
cd extension
code .

# 按F5启动Extension Development Host

# 在新窗口中测试：
# 1. 检查左侧活动栏是否有OpenCode图标
# 2. 检查右侧状态栏是否有3个指示器
# 3. 打开命令面板(Ctrl+Shift+P)，搜索"OpenCode"
# 4. 确认所有命令都注册成功
# 5. 按Cmd+Escape打开聊天面板
```

---

## Phase 3 综合验收

### 验收命令

创建 `scripts/verify-phase3.sh`:

```bash
#!/bin/bash

set -e

echo "=== Phase 3 Verification ==="
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
bun run check-types || { echo "❌ Type check failed"; exit 1; }
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
  process.exit(1;
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
```

---

## 最终集成验收

### 验收命令

创建 `scripts/verify-final.sh`:

```bash
#!/bin/bash

set -e

echo "=== Final Integration Verification ==="
echo ""

echo "Running all phase verifications..."

echo ""
echo "--- Phase 1 ---"
./scripts/verify-phase1.sh || exit 1

echo ""
echo "--- Phase 2 ---"
./scripts/verify-phase2.sh || exit 1

echo ""
echo "--- Phase 3 ---"
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
echo "Chat Panel Tests (with mock server):"
echo "  [ ] Chat input accepts text"
echo "  [ ] @file mention shows suggestions"
echo "  [ ] Tool execution displays correctly"
echo "  [ ] Session switching works"
echo ""
echo "Sidebar Tests:"
echo "  [ ] Session list displays"
echo "  [ ] Active session highlighted"
echo "  [ ] Right-click menu shows options"
echo "  [ ] Session deletion confirms"
echo ""
echo "=== Final Verification Complete ==="
```

---

## 验收报告模板

```markdown
# Phase N 验收报告

## 基本信息
- **Phase**: N
- **验收日期**: 2025-01-19
- **开发人员**: [姓名]
- **验收人员**: [姓名]

## 验收结果

### 自动化检查
- [ ] 文件完整性检查 ✅/❌
- [ ] 类型检查 ✅/❌
- [ ] ESLint检查 ✅/❌
- [ ] 编译测试 ✅/❌
- [ ] 单元测试 ✅/❌

### 手动测试
- [ ] 功能1测试 ✅/❌ - 描述
- [ ] 功能2测试 ✅/❌ - 描述
- [ ] 功能3测试 ✅/❌ - 描述

### 发现的问题
1. 问题描述
   - 严重程度: High/Medium/Low
   - 状态: Open/Resolved/Fixed

## 签署
- **开发人员**: ____________签名______________  日期: ________
- **验收人员**: ____________签名______________  日期: ________

## 结论
✅ 通过 / ❌ 不通过（需返工）
```

---

## 验收失败处理流程

1. **L1失败（文件缺失）**:
   - 立即补充缺失文件
   - 复验L1

2. **L2失败（编译/类型错误）**:
   - 修复编译错误
   - 运行 `bun run check-types` 查看具体错误
   - 复验L2

3. **L2失败（Lint错误）**:
   - 修复或添加 `// eslint-disable-next-line` 忽略
   - 复验L2

4. **L3失败（功能测试）**:
   - 检查实现是否符合规范
   - 重新编写测试用例
   - 复验L3

5. **人工测试失败**:
   - 记录具体问题到验收报告
   - 开发人员修复
   - 重新测试问题场景
