import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts);
}

describe("Phase 6 stale surface removal", () => {
  it("removes deleted mock and legacy routes from the app tree", () => {
    expect(existsSync(repoPath("src", "components", "NotificationCenter.tsx"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "api", "enforcer", "notifications", "route.ts"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "api", "enforcer", "notifications", "[id]", "read", "route.ts"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "api", "enforcer", "notifications", "read-all", "route.ts"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "api", "auth", "verify-reset-token", "route.ts"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "admin", "google-maps-diagnostics", "page.tsx"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "api", "debug", "google-maps", "route.ts"))).toBe(false);
    expect(existsSync(repoPath("src", "app", "verify-coordinates", "page.tsx"))).toBe(false);
    expect(existsSync(repoPath("src", "components", "_archived", "GoogleMapsFareCalculator.tsx"))).toBe(false);
  });

  it("keeps mounted admin and enforcer surfaces free of removed fake workflows", () => {
    const enforcerPage = readFileSync(repoPath("src", "app", "enforcer", "page.tsx"), "utf8");
    const adminDashboard = readFileSync(repoPath("src", "components", "AdminDashboard.tsx"), "utf8");
    const adminPage = readFileSync(repoPath("src", "app", "admin", "page.tsx"), "utf8");

    expect(enforcerPage).not.toContain("NotificationCenter");
    expect(adminDashboard).not.toContain("serverStatus");
    expect(adminDashboard).not.toContain("apiHealth");
    expect(adminDashboard).not.toContain("lastBackup");
    expect(adminPage).not.toContain("System Settings");
    expect(adminPage).not.toContain("settings");
  });
});
