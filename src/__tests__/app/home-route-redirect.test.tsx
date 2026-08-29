// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn<() => {
    user: { id: string; userType: string } | null;
    status: string;
  }>(() => ({ user: null, status: "unauthenticated" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: authMock.useAuth,
}));

import HomePage from "@/app/page";

describe("home route", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    routerMock.replace.mockReset();
    authMock.useAuth.mockReset();
    authMock.useAuth.mockReturnValue({ user: null, status: "unauthenticated" });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function renderHome() {
    await act(async () => {
      root.render(React.createElement(HomePage));
      await Promise.resolve();
    });
  }

  it("sends signed-out visitors straight to the login page", async () => {
    authMock.useAuth.mockReturnValue({ user: null, status: "unauthenticated" });

    await renderHome();

    expect(routerMock.replace).toHaveBeenCalledWith("/login");
    expect(container.textContent).not.toContain("Key Features");
    expect(container.textContent).not.toContain("Public Announcements");
  });

  it("sends signed-in users to their role home route", async () => {
    authMock.useAuth.mockReturnValue({
      user: { id: "public-1", userType: "PUBLIC" },
      status: "authenticated",
    });

    await renderHome();

    expect(routerMock.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("waits for the session to resolve before redirecting", async () => {
    authMock.useAuth.mockReturnValue({ user: null, status: "loading" });

    await renderHome();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
