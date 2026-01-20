import { describe, it, expect } from "bun:test"
import { OpenCodeClient } from "./client/OpenCodeClient"

describe("OpenCodeClient", () => {
  it("should create singleton instance", () => {
    const client1 = OpenCodeClient.getInstance("http://localhost:4096")
    const client2 = OpenCodeClient.getInstance("http://localhost:4096")
    expect(client1).toBe(client2)
  })

  it("should have correct methods defined", () => {
    const client = OpenCodeClient.getInstance()
    expect(typeof client.createSession).toBe("function")
    expect(typeof client.listSessions).toBe("function")
    expect(typeof client.getSession).toBe("function")
    expect(typeof client.deleteSession).toBe("function")
    expect(typeof client.prompt).toBe("function")
    expect(typeof client.forkSession).toBe("function")
    expect(typeof client.subscribeEvents).toBe("function")
    expect(typeof client.getServerStatus).toBe("function")
  })
})
