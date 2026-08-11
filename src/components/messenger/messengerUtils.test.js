/* @vitest-environment jsdom */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { withTokenQuery } from "./messengerUtils";

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key) => (key === "access" ? "jwt-token" : null),
  });
});

describe("withTokenQuery", () => {
  it("resolves protected relative API URLs against the API host and adds token", () => {
    const url = withTokenQuery("/api/messenger/attachments/1/download/");
    expect(url).toBe("https://undefined/api/messenger/attachments/1/download/?token=jwt-token");
  });

  it("does not duplicate an existing token", () => {
    const url = withTokenQuery("/media/images/a.jpg?token=old");
    expect(url).toBe("https://undefined/media/images/a.jpg?token=old");
  });

  it("does not leak tokens to third-party URLs", () => {
    expect(withTokenQuery("https://example.com/a.mp3")).toBe("https://example.com/a.mp3");
  });
});
