import { describe, it, expect } from "bun:test"
import { SettingsManager } from "./config/SettingsManager"

describe("SettingsManager", () => {
  it("should create instance", () => {
    const manager = new SettingsManager()
    expect(manager).toBeInstanceOf(SettingsManager)
  })

  it("should have methods defined", () => {
    const manager = new SettingsManager()
    expect(typeof manager.get).toBe("function")
    expect(typeof manager.set).toBe("function")
    expect(typeof manager.watch).toBe("function")
    expect(typeof manager.refresh).toBe("function")
  })
})
