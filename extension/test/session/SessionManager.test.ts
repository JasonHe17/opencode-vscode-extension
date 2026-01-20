import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { SessionManager, SessionWithStatus } from "../src/session/SessionManager"

const mockContext = {
  globalState: {
    get: () => ({}),
    update: () => Promise.resolve()
  },
  workspaceFolders: []
}

describe("SessionManager", () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = SessionManager.getInstance(mockContext as any)
  })

  afterEach(() => {
    manager?.dispose()
  })

  it("should create singleton instance", () => {
    const manager1 = SessionManager.getInstance(mockContext as any)
    const manager2 = SessionManager.getInstance()
    expect(manager1).toBe(manager2)
  })

  it("should get active session initially as null", () => {
    const active = manager.getActiveSession()
    expect(active).toBeNull()
  })

  it("should return empty array when no sessions", () => {
    const sessions = manager.getAllSessions()
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBe(0)
  })

  it("should get session by id returns undefined for non-existent", () => {
    const session = manager.getSession("non-existent-id")
    expect(session).toBeUndefined()
  })

  it("should filter sessions by status", () => {
    const active = manager.getSessionsByStatus("active")
    const idle = manager.getSessionsByStatus("idle")
    const archived = manager.getSessionsByStatus("archived")

    expect(Array.isArray(active)).toBe(true)
    expect(Array.isArray(idle)).toBe(true)
    expect(Array.isArray(archived)).toBe(true)
  })
})
