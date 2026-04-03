import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts);
}

describe("Trip tracker copy", () => {
  it("keeps Trip Tracker dormant in code while removing it from live calculator entrypoints", () => {
    const calculatorPage = readFileSync(repoPath("src", "app", "calculator", "page.tsx"), "utf8");
    const tracker = readFileSync(repoPath("src", "components", "TripTrackerCalculator.tsx"), "utf8");

    expect(calculatorPage).not.toContain("Trip Tracker");
    expect(calculatorPage).not.toContain("Start Tracking");
    expect(tracker).toContain("Road-aware while the page stays open");
    expect(tracker).not.toContain("Tracks your exact movement");
  });
});
