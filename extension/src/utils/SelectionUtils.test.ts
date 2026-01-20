import { describe, it, expect } from "bun:test"
import { SelectionUtils } from "./utils/SelectionUtils"

describe("SelectionUtils", () => {
  it("should exist and have static methods", () => {
    expect(typeof SelectionUtils.getFileMention).toBe("function")
    expect(typeof SelectionUtils.getActiveSelection).toBe("function")
    expect(typeof SelectionUtils.hasSelection).toBe("function")
    expect(typeof SelectionUtils.insertIntoEditor).toBe("function")
  })
})
