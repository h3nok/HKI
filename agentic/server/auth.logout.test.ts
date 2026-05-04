import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { DEBUG_SESSION_COOKIE_NAME } from "./_core/debug-session";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(reqOverrides?: Partial<TrpcContext["req"]>): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
      ...reqOverrides,
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(2);
    expect(clearedCookies.map(cookie => cookie.name)).toEqual([
      DEBUG_SESSION_COOKIE_NAME,
      COOKIE_NAME,
    ]);
    expect(clearedCookies[1]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("clears both domain and host-only session cookies on non-local hosts", async () => {
    const { ctx, clearedCookies } = createAuthContext({
      hostname: "agentic.cilabs.np.hki.com",
      headers: {
        host: "agentic.cilabs.np.hki.com",
        "x-forwarded-proto": "https",
      },
    });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(4);
    expect(clearedCookies.map(cookie => cookie.name)).toEqual([
      DEBUG_SESSION_COOKIE_NAME,
      DEBUG_SESSION_COOKIE_NAME,
      COOKIE_NAME,
      COOKIE_NAME,
    ]);
    expect(clearedCookies[2]?.options).toMatchObject({
      domain: ".agentic.cilabs.np.hki.com",
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
    expect(clearedCookies[3]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
    expect(clearedCookies[3]?.options).not.toHaveProperty("domain");
  });
});
