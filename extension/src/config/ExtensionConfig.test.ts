import { describe, it, expect } from "bun:test"
import { ExtensionConfig } from "./config/ExtensionConfig"

describe("ExtensionConfig", () => {
  it("should return null without context", () => {
    const config = ExtensionConfig.getInstance()
    expect(config).toBe(null)
  })

  it("should require context to initialize", () => {
    const config = ExtensionConfig.getInstance()
    expect(config).toBe(null)
  })
})
