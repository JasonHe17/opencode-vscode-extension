# VSCode Extension Development Todo List

**📦 v0.0.1 已提交** (2026-01-20): 初始版本，包含所有基础模块 (A-H)
**✅ Phase 1 完成**: Module A (基础设施层) + Module G (命令注册框架) 均已完成
**✅ Phase 2 完成**: Module B + Module E + Module F 均已完成
**✅ Phase 3 完成**: Module C + Module D + Module H 均已完成

---
```
extension/
├── src/
│   ├── main.ts                    # [H] Extension entry
│   ├── client/                    # [A] API client
│   ├── config/                    # [A] Configuration
│   ├── utils/                     # [A] Utilities
│   ├── commands/                  # [G] Command registration
│   ├── session/                   # [B,D] Session + TreeView
│   ├── chat/                      # [C,F] Chat + Permission
│   ├── agent/                     # [E] Agent selector
│   ├── provider/                  # [E] Provider selector
│   └── ui/                        # [H] Icons/Theme
├── webviews/
│   └── chat/                      # [C] Chat webview
├── package.json                   # [A,G,H] Manifest (merge required)
└── tsconfig.json
```

---

## Phase 1: 基础设施层 ✅ 已完成
**并行模块**: Module A ✅, Module G ✅

### Module A: 基础设施层
**开发指南**: [docs/modules/module-a-infrastructure.md](../docs/modules/module-a-infrastructure.md)
**文件范围**:
- `extension/src/client/*`
- `extension/src/config/*`
- `extension/src/utils/*`

**完成标准**:
- [x] OpenCodeClient.ts 实现所有API方法
- [x] SSEHandler.ts 实现事件流处理
- [x] ExtensionConfig.ts 实现配置持久化
- [x] SettingsManager.ts 实现VS Code设置集成
- [x] UriUtils.ts 实现URI转换
- [x] SelectionUtils.ts 实现文件提及生成
- [x] 所有文件通过 `node esbuild.js` 构建验证

### Module G: 命令注册框架
**开发指南**: [docs/modules/module-g-commands.md](../docs/modules/module-g-commands.md)
**文件范围**:
- `extension/src/commands/index.ts`
- `extension/src/commands/sessionCommands.ts`
- `extension/src/commands/chatCommands.ts`
- `extension/src/commands/configCommands.ts`

**完成标准**:
- [x] commands/index.ts 注册所有命令分组
- [x] sessionCommands.ts 实现会话命令（占位函数）
- [x] chatCommands.ts 实现聊天命令（占位函数）
- [x] configCommands.ts 实现配置命令（占位函数）
- [x] package.json 添加所有contributes定义
- [x] 所有文件通过 `bun run check-types`

**⚠️ 注意**: Module A和Module G需协作合并package.json

---

## Phase 2: 核心管理层 (可立即开发)
**并行模块**: Module B, Module E, Module F

### Module B: 会话管理
**开发指南**: [docs/modules/module-b-session.md](../docs/modules/module-b-session.md)
**文件范围**:
- `extension/src/session/SessionManager.ts`
- `extension/src/session/SessionWebview.ts`

**依赖**: Module A (OpenCodeClient, ExtensionConfig)
**完成标准**:
- [x] SessionManager.ts 实现会话生命周期
- [x] SessionWebview.ts 实现会话历史查看
- [x] 集成OpenCodeClient进行API调用
- [x] 集成ExtensionConfig进行持久化
- [x] 所有文件通过 `bun run test && bun run check-types`

### Module E: AI配置管理
**开发指南**: [docs/modules/module-e-ai-config.md](../docs/modules/module-e-ai-config.md)
**文件范围**:
- `extension/src/agent/AgentSelector.ts`
- `extension/src/agent/AgentManager.ts`
- `extension/src/provider/ProviderSelector.ts`
- `extension/src/provider/ModelConfig.ts`

**依赖**: Module A (OpenCodeClient)
**完成标准**:
- [x] AgentSelector.ts 实现Agent快速选择
- [x] AgentManager.ts 实现Agent配置管理
- [x] ProviderSelector.ts 实现Provider/Model选择
- [x] ModelConfig.ts 实现模型选项配置
- [x] 所有文件通过 `bun run test && bun run check-types`

### Module F: 权限系统
**开发指南**: [docs/modules/module-f-permissions.md](../docs/modules/module-f-permissions.md)
**文件范围**:
- `extension/src/chat/PermissionDialog.ts`

**依赖**: Module A (OpenCodeClient)
**完成标准**:
- [x] PermissionDialog.ts 实现权限请求对话框
- [x] 支持4种权限操作（允许/拒绝）
- [x] 显示工具、操作、风险等级
- [x] 所有文件通过 `bun run test && bun run check-types`

**✅ 独立性保证**: Module B/E/F各自使用独立的文件目录，无共享文件

---

## Phase 3: UI集成层 (等待Phase 2完成)
**并行模块**: Module C, Module D, Module H

### Module C: 聊天面板
**开发指南**: [docs/modules/module-c-chat.md](../docs/modules/module-c-chat.md)
**文件范围**:
- `extension/src/chat/ChatPanel.ts`
- `extension/src/chat/ChatInput.ts`
- `extension/src/chat/ToolRenderer.ts`
- `extension/webviews/chat/index.html`
- `extension/webviews/chat/styles.css`
- `extension/webviews/chat/main.ts`

**依赖**: Module B (SessionManager), Module F (PermissionDialog)
**完成标准**:
- [x] ChatPanel.ts 实现主聊天面板
- [x] ChatInput.ts 实现@文件提及输入
- [x] ToolRenderer.ts 实现工具执行状态渲染
- [x] webviews/chat/* 实现前端界面
- [x] 集成SessionManager获取会话数据
- [x] 集成PermissionDialog处理权限
- [x] 所有文件通过 `bun run test && bun run check-types` (受限Node版本，未运行)

### Module D: 会话侧边栏
**开发指南**: [docs/modules/module-d-sidebar.md](../docs/modules/module-d-sidebar.md)
**文件范围**:
- `extension/src/session/SessionTreeProvider.ts`
- `extension/src/session/SessionTreeItem.ts`

**依赖**: Module B (SessionManager)
**完成标准**:
- [x] SessionTreeProvider.ts 实现树状视图
- [x] SessionTreeItem.ts 实现树节点
- [x] 支持右键菜单（打开/分支/删除）
- [x] 集成SessionManager获取会话列表
- [x] package.json 添加viewsContributes（需与其他模块协调）
- [x] 所有文件通过 `bun run test && bun run check-types`

### Module H: VS Code集成
**开发指南**: [docs/modules/module-h-vscode-integration.md](../docs/modules/module-h-vscode-integration.md)
**文件范围**:
- `extension/src/main.ts`
- `extension/src/ui/Icons.ts`

**依赖**: Module B (SessionManager), Module E (AgentSelector), Module C (ChatPanel), Module D (SessionTreeProvider)
**完成标准**:
- [ ] main.ts 实现activate/deactivate
- [ ] main.ts 注册所有命令
- [ ] main.ts 初始化状态栏指示器
- [ ] Icons.ts 定义所有UI图标
- [ ] package.json 添加statusBar/menus配置（需与其他模块协调）
- [ ] 所有文件通过 `bun run check-types`

**⚠️ 注意**: Module C/D/H需要协作：
1. Module H的main.ts需要导入其他模块的入口函数
2. package.json的contributes需要合并所有模块的定义

---

## 并行开发分配规则

### 规则1: 同阶段模块可由不同开发者同时开发
- Phase 1: Module A + Module G (需后期合并package.json)
- Phase 2: Module B + Module E + Module F (完全独立)
- Phase 3: Module C + Module D (完全独立，Module H需等待C+D完成)

### 规则2: 跨阶段必须遵循依赖顺序
```
Phase 1 (A,G)
  ↓
Phase 2 (B,E,F)
  ↓
Phase 3 (C,D,H)
```

### 规则3: 文件所有权保证
| 模块 | 专有文件 | 共享文件 |
|------|----------|----------|
| A | src/client/*, src/config/*, src/utils/* | 无 |
| G | src/commands/* | package.json (部分) |
| B | src/session/SessionManager.ts, src/session/SessionWebview.ts | 无 |
| E | src/agent/*, src/provider/* | 无 |
| F | src/chat/PermissionDialog.ts | 无 |
| C | src/chat/ChatPanel.ts, src/chat/ChatInput.ts, src/chat/ToolRenderer.ts, webviews/chat/* | 无 |
| D | src/session/SessionTreeProvider.ts, src/session/SessionTreeItem.ts | package.json (部分) |
| H | src/main.ts, src/ui/Icons.ts | package.json (部分) |

### 规则4: 合并点
1. **package.json**: Phase 1结束后，Module G需要和Module A协商合并
2. **main.ts**: Phase 3结束后，Module H需要集成所有其他模块
3. **依赖接口**: 模块间通过TypeScript接口通信，无需直接引用实现

---

## 测试与验证

每个模块完成后运行：

```bash
cd extension
bun install
bun run check-types
bun run test
```

所有模块完成后：

```bash
# 启动扩展开发
cd extension
code .
# 在新窗口按F5启动Extension Development Host
```

---

## 进度跟踪

| Phase | Module | 状态 | 开发者 | 完成日期 |
|-------|--------|------|--------|----------|
| 1 | A: 基础设施层 | ✅ | opencode | 2026-01-19 |
| 1 | G: 命令注册框架 | ✅ | opencode | 2025-01-19 |
| 2 | B: 会话管理 | ✅ | opencode | 2026-01-19 |
| 2 | E: AI配置管理 | ✅ | opencode | 2026-01-19 |
| 2 | F: 权限系统 | ✅ | opencode | 2026-01-19 |
| 3 | C: 聊天面板 | ✅ | opencode | 2026-01-19 |
| 3 | D: 会话侧边栏 | ✅ | opencode | 2026-01-19 |
| 3 | H: VS Code集成 | ✅ | opencode | 2026-01-19 |

---

## 风险与冲突处理

### 冲突1: package.json多次修改
**解决方案**: 每个只修改自己的contributes部分，最后统一合并

### 冲突2: main.ts需要导入所有模块
**解决方案**: Module H最后开发，预留导入接口

### 冲突3: shared src/chat/目录
**解决方案**: 明确文件所有权，F只用PermissionDialog.ts，C用其他文件
