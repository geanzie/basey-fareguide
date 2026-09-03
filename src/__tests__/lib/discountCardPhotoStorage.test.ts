import { describe, expect, it } from "vitest";

import {
  getDiscountCardObjectKey,
  isLegacyLocalPhotoUrl,
  validateDiscountCardPhoto,
} from "@/lib/discountCardPhotoStorage";

function makeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  // File size is read-only on the constructed object; override for the test.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("isLegacyLocalPhotoUrl", () => {
  it("recognises paths written by the old filesystem implementation", () => {
    expect(isLegacyLocalPhotoUrl("/uploads/discount-cards/user_abc.jpg")).toBe(true);
  });

  it("does not treat an object key as legacy", () => {
    expect(isLegacyLocalPhotoUrl("discount-cards/user_abc.jpg")).toBe(false);
  });
});

describe("getDiscountCardObjectKey", () => {
  it("namespaces photos away from the evidence prefix", () => {
    expect(getDiscountCardObjectKey("user_abc.jpg")).toBe("discount-cards/user_abc.jpg");
  });
});

describe("validateDiscountCardPhoto", () => {
  it("accepts a JPEG under the size cap and derives the extension from the MIME type", () => {
    expect(validateDiscountCardPhoto(makeFile("id.jpeg", "image/jpeg", 1024))).toBe("jpg");
  });

  it("derives the extension from the type, not the submitted filename", () => {
    // The filename is attacker-controlled; only the type is validated.
    expect(validateDiscountCardPhoto(makeFile("id.php", "image/png", 1024))).toBe("png");
  });

  it("rejects a non-image file", () => {
    expect(() => validateDiscountCardPhoto(makeFile("id.pdf", "application/pdf", 1024))).toThrow(
      "Photo must be an image file",
    );
  });

  it("rejects an image type outside the allowed set", () => {
    expect(() => validateDiscountCardPhoto(makeFile("id.gif", "image/gif", 1024))).toThrow(
      "JPEG, PNG, WebP, or HEIC",
    );
  });

  it("rejects a photo over 5MB", () => {
    expect(() =>
      validateDiscountCardPhoto(makeFile("id.jpg", "image/jpeg", 6 * 1024 * 1024)),
    ).toThrow("less than 5MB");
  });
});
