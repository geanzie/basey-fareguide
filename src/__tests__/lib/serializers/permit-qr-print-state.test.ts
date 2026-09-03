import { describe, expect, it } from "vitest";

import { serializePermit } from "@/lib/serializers";

const basePermit = {
  id: "permit-1",
  permitPlateNumber: "BP-1001",
  driverFullName: "Driver Name",
  vehicleType: "TRICYCLE",
  issuedDate: new Date("2026-01-01T00:00:00.000Z"),
  expiryDate: new Date("2027-01-01T00:00:00.000Z"),
  status: "ACTIVE",
  remarks: null,
  encodedBy: "encoder-1",
  encodedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastUpdatedBy: null,
  lastUpdatedAt: null,
  renewalHistory: [],
  vehicle: null,
};

describe("permit QR print state", () => {
  it("reports NOT_ISSUED when the permit has no QR token", () => {
    const permit = serializePermit({ ...basePermit, qrToken: null, qrPrintedAt: null });

    expect(permit.qrPrintState).toBe("NOT_ISSUED");
    expect(permit.qrPrintedAt).toBeNull();
  });

  it("reports NEEDS_PRINT for an issued token that has never been printed", () => {
    const permit = serializePermit({ ...basePermit, qrToken: "token-1", qrPrintedAt: null });

    expect(permit.qrPrintState).toBe("NEEDS_PRINT");
  });

  it("reports NEEDS_PRINT after rotation clears the print timestamp", () => {
    // issuePermitQrToken nulls qrPrintedAt, because the sticker on the vehicle
    // is dead once the token changes.
    const permit = serializePermit({
      ...basePermit,
      qrToken: "rotated-token",
      qrPrintedAt: null,
      qrPrintedBy: null,
    });

    expect(permit.qrPrintState).toBe("NEEDS_PRINT");
  });

  it("reports PRINTED with the print timestamp and actor", () => {
    const permit = serializePermit({
      ...basePermit,
      qrToken: "token-1",
      qrPrintedAt: new Date("2026-02-02T03:04:05.000Z"),
      qrPrintedBy: "encoder-9",
    });

    expect(permit.qrPrintState).toBe("PRINTED");
    expect(permit.qrPrintedAt).toBe("2026-02-02T03:04:05.000Z");
    expect(permit.qrPrintedBy).toBe("encoder-9");
  });

  it("derives the print state even when the token is redacted", () => {
    const permit = serializePermit({
      ...basePermit,
      qrToken: "token-1",
      qrPrintedAt: new Date("2026-02-02T03:04:05.000Z"),
    });

    expect(permit.qrToken).toBeNull();
    expect(permit.qrPrintState).toBe("PRINTED");
  });
});
