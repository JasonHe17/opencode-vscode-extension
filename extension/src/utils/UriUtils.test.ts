import { describe, it, expect } from "bun:test"
import { UriUtils } from "./utils/UriUtils"

describe("UriUtils", () => {
  it("should exist and have static methods", () => {
    expect(typeof UriUtils.toAbsolutePath).toBe("function")
    expect(typeof UriUtils.toRelativePath).toBe("function")
    expect(typeof UriUtils.getWorkspaceFolder).toBe("function")
    expect(typeof UriUtils.toUri).toBe("function")
  })
})
