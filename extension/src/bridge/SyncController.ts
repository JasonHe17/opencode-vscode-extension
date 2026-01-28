import { AppState } from "../domain/state.js"

export class SyncController {
  constructor(private webview: any, private store: any) {
    this.store.subscribe((state: AppState) => {
      this.syncToWebview(state)
    })
  }

  private syncToWebview(state: AppState) {
    const activeSession = state.activeSessionId ? state.sessions.get(state.activeSessionId) : null
    const messages = state.activeSessionId ? (state.messages.get(state.activeSessionId) || []) : []

    this.webview.postMessage({
      type: "init",
      sessionId: state.activeSessionId,
      sessionTitle: activeSession?.title,
      messages: messages,
      serverConnected: state.serverConnected
    })
  }

  handleWebviewMessage(message: any) {
    switch (message.type) {
      case "sendMessage":
        this.store.dispatch({
          type: "MESSAGE_ADDED",
          sessionId: this.store.getState().activeSessionId,
          message: {
            id: Math.random().toString(36),
            role: "user",
            parts: [{ type: "text", content: message.text }],
            timestamp: Date.now(),
            sessionId: this.store.getState().activeSessionId
          }
        })
        break
      case "changeAgent":
        this.store.dispatch({
          type: "SESSION_UPDATED",
          id: this.store.getState().activeSessionId,
          patch: { agent: message.agent }
        })
        break
    }
  }
}
