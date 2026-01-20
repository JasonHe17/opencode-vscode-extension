import { describe, it, expect } from "bun:test"
import { createSSEHandler, SSEHandler } from "./client/SSEHandler"

describe("SSEHandler", () => {
  it("should create handler instance", () => {
    const handler = createSSEHandler("http://localhost:4096")
    expect(handler).toBeInstanceOf(SSEHandler)
  })

  it("should handle event subscriptions", () => {
    const handler = new SSEHandler("http://localhost:4096")
    const events: any[] = []

    const unsubscribe = handler.on("test.event", (event) => {
      events.push(event)
    })

    unsubscribe()
    handler.disconnect()
  })

  it("should support wildcard subscriptions", () => {
    const handler = new SSEHandler("http://localhost:4096")
    const events: any[] = []

    handler.on("*", (event) => {
      events.push(event)
    })

    handler.disconnect()
  })
})
