import { describe, expect, it } from "vitest";

import { FARE_DOCUMENT_ACCEPT_ATTRIBUTE } from "@/lib/fare/documentTypes";
import { getFareDocumentObjectKey, validateFareDocument } from "@/lib/fareDocumentStorage";

function makeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  // File size is read-only on the constructed object; override for the test.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("getFareDocumentObjectKey", () => {
  it("namespaces documents away from the evidence and discount-card prefixes", () => {
    expect(getFareDocumentObjectKey("fare-live_abc.pdf")).toBe("fare-documents/fare-live_abc.pdf");
  });
});

describe("FARE_DOCUMENT_ACCEPT_ATTRIBUTE", () => {
  it("offers exactly the types the server will store", () => {
    expect(FARE_DOCUMENT_ACCEPT_ATTRIBUTE).toBe(
      "application/pdf,image/jpeg,image/png,image/webp",
    );
  });
});

describe("validateFareDocument", () => {
  it("accepts a PDF under the size cap", () => {
    expect(validateFareDocument(makeFile("resolution.pdf", "application/pdf", 1024))).toBe("pdf");
  });

  it("accepts a photographed scan, since resolutions often arrive as images", () => {
    expect(validateFareDocument(makeFile("scan.jpeg", "image/jpeg", 1024))).toBe("jpg");
    expect(validateFareDocument(makeFile("scan.png", "image/png", 1024))).toBe("png");
    expect(validateFareDocument(makeFile("scan.webp", "image/webp", 1024))).toBe("webp");
  });

  it("derives the extension from the type, not the submitted filename", () => {
    // The filename is caller-controlled; only the type is validated.
    expect(validateFareDocument(makeFile("resolution.php", "application/pdf", 1024))).toBe("pdf");
  });

  it("rejects a type outside the allowed set", () => {
    expect(() =>
      validateFareDocument(makeFile("resolution.docx", "application/msword", 1024)),
    ).toThrow("PDF, JPEG, PNG, or WebP");
  });

  it("rejects an empty file", () => {
    expect(() => validateFareDocument(makeFile("empty.pdf", "application/pdf", 0))).toThrow(
      "empty",
    );
  });

  it("rejects a file over 15MB", () => {
    expect(() =>
      validateFareDocument(makeFile("huge.pdf", "application/pdf", 15 * 1024 * 1024 + 1)),
    ).toThrow("less than 15MB");
  });

  it("accepts a file exactly at the 15MB cap", () => {
    expect(validateFareDocument(makeFile("big.pdf", "application/pdf", 15 * 1024 * 1024))).toBe(
      "pdf",
    );
  });
});
