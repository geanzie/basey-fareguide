import { describe, expect, it } from "vitest";

import { buildUsernameCandidate, withRandomSuffix } from "@/lib/oauth/signup";

describe("buildUsernameCandidate", () => {
  it("uses the email local part", () => {
    expect(buildUsernameCandidate("juan.delacruz@example.com", "Juan")).toBe("juan.delacruz");
  });

  it("strips characters a username cannot contain", () => {
    expect(buildUsernameCandidate("Juan+Tag@example.com", "Juan")).toBe("juantag");
  });

  it("trims leading and trailing separators", () => {
    expect(buildUsernameCandidate("__juan__@example.com", "Juan")).toBe("juan");
  });

  it("falls back to the first name when the local part is too short", () => {
    expect(buildUsernameCandidate("jd@example.com", "Juanita")).toBe("juanita");
  });

  it("falls back to a generic name when nothing usable remains", () => {
    expect(buildUsernameCandidate("j@example.com", "?!")).toBe("user");
  });

  it("caps the length at 30 characters", () => {
    const candidate = buildUsernameCandidate(`${"a".repeat(50)}@example.com`, "Juan");
    expect(candidate).toHaveLength(30);
  });
});

describe("withRandomSuffix", () => {
  it("appends a four-digit suffix and stays within the length cap", () => {
    const suffixed = withRandomSuffix("a".repeat(30));
    expect(suffixed).toMatch(/^a+-\d{4}$/);
    expect(suffixed.length).toBeLessThanOrEqual(30);
  });
});
