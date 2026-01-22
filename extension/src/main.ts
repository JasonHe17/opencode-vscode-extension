import * as vscode from "vscode"
import { bootstrap } from "./app/bootstrap.js"
import { registerAllCommands } from "./commands/index.js"

export async function activate(context: vscode.ExtensionContext) {
  const { store, client } = await bootstrap(context)

  // Register commands
  registerAllCommands(context)

  // Use store for state tracking
  store.subscribe((state) => {
    // Sync to tree view, etc.
    console.log(`[OpenCode] Active Session: ${state.activeSessionId}`)
  })

  // Cleanup on deactivate
  context.subscriptions.push({
    dispose: () => {
      client.dispose()
    }
  })
}

export function deactivate() {}
