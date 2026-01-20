# 验收脚本使用指南

## 快速验证

### 验证单个Phase

```bash
# Phase 1 (Module A + G)
./scripts/verify-phase1.sh

# Phase 2 (Module B + E + F)
./scripts/verify-phase2.sh

# Phase 3 (Module C + D + H)
./scripts/verify-phase3.sh
```

### 全量验证

```bash
# 验证所有Phase
./scripts/verify-final.sh
```

---

## 验证步骤

### 每个Phase完成后

1. 运行对应的verify脚本
2. 检查输出中的所有✓标记
3. 如果出现❌，修复问题后重新运行

### Phase 1 验收后

- [ ] Module A开发完成
- [ ] Module G开发完成
- [ ] package.json已协商合并
- [ ] `./scripts/verify-phase1.sh` 通过

### Phase 2 验收后

- [ ] Module B开发完成
- [ ] Module E开发完成
- [ ] Module F开发完成
- [ ] `./scripts/verify-phase2.sh` 通过

### Phase 3 验收后

- [ ] Module C开发完成
- [ ] Module D开发完成
- [ ] Module H开发完成
- [ ] `./scripts/verify-phase3.sh` 通过

### 最终验收

```bash
./scripts/verify-final.sh
```

---

## 验证失败处理

### 常见错误

```
❌ fileName.ts missing
```
**解决**: 创建缺失的文件

```
❌ Type check failed
```
**解决**: 运行 `bun run check-types` 查看具体错误

```
❌ Lint failed
```
**解决**: 运行 `bun run lint` 查看具体错误

```
❌ Compile failed
```
**解决**: 运行 `bun run compile` 查看具体错误

---

## 人工测试清单

最终脚本会输出人工测试清单，包括：

- VS Code扩展基本功能
- 快捷键
- 聊天面板
- 侧边栏

---

## 文件结构

```
scripts/
├── verify-phase1.sh    # Phase 1验证
├── verify-phase2.sh    # Phase 2验证
├── verify-phase3.sh    # Phase 3验证
└── verify-final.sh     # 全量验证
```
