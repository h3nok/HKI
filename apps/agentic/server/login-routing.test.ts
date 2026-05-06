import { describe, expect, it } from "vitest";

import { getPostLoginPath } from "../client/src/pages/login-routing";

describe("getPostLoginPath", () => {
  it("prefers an explicit return target", () => {
    expect(getPostLoginPath("viewer", "/knowledge?stream=pharmacy")).toBe(
      "/knowledge?stream=pharmacy"
    );
  });

  it("sends admins to the enterprise hub by default", () => {
    expect(getPostLoginPath("admin")).toBe("/admin");
  });

  it("sends managers to the knowledge workspace by default", () => {
    expect(getPostLoginPath("manager")).toBe("/knowledge");
  });

  it("sends operators to the knowledge workspace by default", () => {
    expect(getPostLoginPath("operator")).toBe("/knowledge");
  });

  it("sends viewers to chat by default", () => {
    expect(getPostLoginPath("viewer")).toBe("/chat");
  });
});
