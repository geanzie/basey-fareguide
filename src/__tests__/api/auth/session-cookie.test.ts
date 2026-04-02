import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

const jwtMock = vi.hoisted(() => ({
  verify: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("jsonwebtoken", () => ({
  default: { verify: jwtMock.verify },
  verify: jwtMock.verify,
}));

import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getProfile } from "@/app/api/user/profile/route";
import { verifyAuth } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
});

describe("cookie-backed session flow", () => {
  it("authenticates requests from the auth-token cookie", async () => {
    jwtMock.verify.mockReturnValueOnce({ userId: "user-1" });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Cookie",
      lastName: "User",
      username: "cookie-user",
      userType: "PUBLIC",
      isActive: true,
    });

    const user = await verifyAuth(
      new NextRequest("http://localhost/api/user/profile", {
        headers: { cookie: "auth-token=session-cookie" },
      })
    );

    expect(user).toMatchObject({ id: "user-1", username: "cookie-user" });
    expect(jwtMock.verify).toHaveBeenCalledWith("session-cookie", "test-secret");
  });

  it("allows protected profile access from a cookie-backed session", async () => {
    jwtMock.verify.mockReturnValueOnce({ userId: "user-1" });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        firstName: "Cookie",
        lastName: "User",
        username: "cookie-user",
        userType: "PUBLIC",
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: "user-1",
        username: "cookie-user",
        firstName: "Cookie",
        lastName: "User",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        governmentId: null,
        idType: null,
        barangayResidence: null,
        userType: "PUBLIC",
        isActive: true,
        isVerified: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

    const res = await getProfile(
      new NextRequest("http://localhost/api/user/profile", {
        headers: { cookie: "auth-token=session-cookie" },
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.username).toBe("cookie-user");
  });

  it("clears the auth cookie on logout and rejects protected access without a cookie", async () => {
    const logoutRes = await logout(
      new NextRequest("http://localhost/api/auth/logout", { method: "POST" })
    );

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get("set-cookie")).toContain("auth-token=");

    const profileRes = await getProfile(
      new NextRequest("http://localhost/api/user/profile")
    );

    expect(profileRes.status).toBe(401);
  });
});
