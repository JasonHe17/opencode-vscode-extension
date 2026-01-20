import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
  console.log("🚀 OpenCode extension is activating...")

  // 创建状态栏项测试
  const testItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  testItem.text = "🚀 OpenCode Test"
  testItem.show()

  // 显示通知
  vscode.window.showInformationMessage("OpenCode Extension Activated!")
  console.log("✅ Activation successful")

  // 注册状态栏项
  context.subscriptions.push(testItem)

  console.log("✅ Extension fully loaded")
}

export function deactivate() {
  console.log("👋 OpenCode extension deactivated")
}
