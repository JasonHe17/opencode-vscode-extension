import { Session, Message } from "./models.js"

export interface AppState {
  sessions: Map<string, Session>
  messages: Map<string, Message[]> // sessionId -> messages
  activeSessionId: string | null
  serverConnected: boolean
}

export type AppEvent =
  | { type: "SESSION_CREATED"; session: Session }
  | { type: "SESSION_UPDATED"; id: string; patch: Partial<Session> }
  | { type: "SESSION_DELETED"; sessionId: string }
  | { type: "SESSION_SWITCHED"; sessionId: string }
  | { type: "MESSAGE_ADDED"; sessionId: string; message: Message }
  | { type: "MESSAGE_PART_UPDATED"; sessionId: string; messageId: string; partId: string; patch: any }
  | { type: "SERVER_STATUS_CHANGED"; connected: boolean }

export function appReducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "SESSION_CREATED":
      state.sessions.set(event.session.id, event.session)
      return { ...state }
    case "SESSION_SWITCHED":
      return { ...state, activeSessionId: event.sessionId }
    case "MESSAGE_ADDED": {
      const msgs = state.messages.get(event.sessionId) || []
      state.messages.set(event.sessionId, [...msgs, event.message])
      return { ...state }
    }
    case "SESSION_UPDATED": {
      const session = state.sessions.get(event.id)
      if (session) {
        Object.assign(session, event.patch)
      }
      return { ...state }
    }
    case "MESSAGE_PART_UPDATED": {
      const sessionMsgs = state.messages.get(event.sessionId)
      if (sessionMsgs) {
        const msg = sessionMsgs.find(m => m.id === event.messageId)
        if (msg) {
          const part = msg.parts.find(p => p.id === event.partId)
          if (part) {
            Object.assign(part, event.patch)
          } else {
            msg.parts.push({ id: event.partId, ...event.patch })
          }
        }
      }
      return { ...state }
    }
    case "SERVER_STATUS_CHANGED":
      return { ...state, serverConnected: event.connected }
    default:
      return state
  }
}
