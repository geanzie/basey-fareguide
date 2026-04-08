import { describe, expect, it } from "vitest";

import {
  serializeFareCalculation,
  serializeIncident,
  serializePermit,
  serializeUserProfile,
  serializeVehicle,
} from "@/lib/serializers";

describe("normalized serializers", () => {
  it("serializes user profiles into stable string/null fields", () => {
    const profile = serializeUserProfile({
      id: "user-1",
      username: "public-user",
      userType: "PUBLIC",
      firstName: "Public",
      lastName: "User",
      email: null,
      phoneNumber: null,
      dateOfBirth: new Date("2000-05-15T00:00:00.000Z"),
      governmentId: null,
      idType: null,
      barangayResidence: null,
      isActive: true,
      isVerified: true,
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
    });

    expect(profile.dateOfBirth).toBe("2000-05-15");
    expect(profile.email).toBeNull();
    expect(profile.createdAt).toBe("2026-04-02T00:00:00.000Z");
  });

  it("serializes incidents with normalized type/date fields and labels", () => {
    const incident = serializeIncident({
      id: "inc-1",
      incidentType: "FARE_OVERCHARGE",
      description: "Driver charged too much.",
      location: "Amandayehan",
      plateNumber: "ABC-1234",
      driverLicense: "DL-1",
      vehicleType: "TRICYCLE",
      incidentDate: new Date("2026-04-02T09:00:00.000Z"),
      status: "INVESTIGATING",
      ticketNumber: null,
      paymentStatus: null,
      paidAt: null,
      officialReceiptNumber: null,
      penaltyAmount: "500",
      remarks: null,
      createdAt: new Date("2026-04-02T09:05:00.000Z"),
      updatedAt: new Date("2026-04-02T10:00:00.000Z"),
      reportedBy: {
        firstName: "Public",
        lastName: "User",
        userType: "PUBLIC",
      },
      handledBy: null,
      evidenceCount: 2,
    });

    expect(incident).toMatchObject({
      type: "FARE_OVERCHARGE",
      typeLabel: "Fare Overcharge",
      status: "INVESTIGATING",
      statusLabel: "Investigating",
      date: "2026-04-02T09:00:00.000Z",
      paymentStatus: null,
      paidAt: null,
      officialReceiptNumber: null,
      evidenceCount: 2,
    });
    expect("incidentType" in incident).toBe(false);
    expect("incidentDate" in incident).toBe(false);
  });

  it("serializes fare calculations with normalized location keys and parsed numbers", () => {
    const fare = serializeFareCalculation({
      id: "calc-1",
      fromLocation: "Amandayehan",
      toLocation: "Anglit",
      distance: { toString: () => "12.4" },
      calculatedFare: { toString: () => "45" },
      actualFare: null,
      originalFare: { toString: () => "56.25" },
      discountApplied: { toString: () => "11.25" },
      discountType: "STUDENT",
      calculationType: "Road Route Planner",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      routeData: JSON.stringify({ method: "ors" }),
      vehicle: {
        plateNumber: "ABC-1234",
        vehicleType: "TRICYCLE",
      },
    });

    expect(fare).toMatchObject({
      from: "Amandayehan",
      to: "Anglit",
      distanceKm: 12.4,
      fare: 45,
      originalFare: 56.25,
      discountApplied: 11.25,
      routeData: { method: "ors" },
    });
    expect("fromLocation" in fare).toBe(false);
    expect("calculatedFare" in fare).toBe(false);
  });

  it("formats legacy pin labels into the shared coordinate fallback text", () => {
    const fare = serializeFareCalculation({
      id: "calc-pin",
      fromLocation: "pin:11.278823,125.001194",
      toLocation: "pin:11.304796,125.108990",
      distance: { toString: () => "12.4" },
      calculatedFare: { toString: () => "45" },
      calculationType: "Road Route Planner",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      routeData: null,
      vehicle: null,
    });

    expect(fare.from).toBe("11.278823, 125.001194");
    expect(fare.to).toBe("11.304796, 125.108990");
  });

  it("serializes vehicles and permits with ISO date fields", () => {
    const vehicle = serializeVehicle({
      id: "veh-1",
      plateNumber: "ABC-1234",
      vehicleType: "TRICYCLE",
      make: "Honda",
      model: "TMX",
      year: 2024,
      color: "Blue",
      capacity: 4,
      isActive: true,
      ownerName: "Owner Name",
      ownerContact: "09123456789",
      driverName: "Driver Name",
      driverLicense: "DL-1",
      registrationExpiry: new Date("2026-12-31T00:00:00.000Z"),
      insuranceExpiry: null,
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T01:00:00.000Z"),
      permit: null,
    });

    const permit = serializePermit({
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
      vehicle: {
        id: "veh-1",
        plateNumber: "ABC-1234",
        make: "Honda",
        model: "TMX",
        ownerName: "Owner Name",
        vehicleType: "TRICYCLE",
      },
    });

    expect(vehicle.registrationExpiry).toBe("2026-12-31T00:00:00.000Z");
    expect(permit.issuedDate).toBe("2026-01-01T00:00:00.000Z");
    expect(permit.vehicle?.plateNumber).toBe("ABC-1234");
  });
});
