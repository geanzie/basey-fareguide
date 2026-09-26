// @vitest-environment jsdom

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RiderTripDto } from "@/lib/contracts";
import { TripList } from "@/components/rider-operations/panels";

const NOW = Date.parse("2026-09-26T08:00:00.000Z");

function trip(overrides: Partial<RiderTripDto> = {}): RiderTripDto {
  return {
    id: "t1",
    at: "2026-09-26T07:36:00.000Z",
    day: "2026-09-26",
    hour: 15,
    weekday: 6,
    group: "FULL",
    from: "Brgy. Poblacion (Basey Public Market)",
    to: "Brgy. Guirang Elementary School",
    distanceKm: 6.4,
    fare: 26,
    originalFare: null,
    discount: 0,
    discountType: null,
    seatsPaid: 1,
    plateNumber: "BSY-1042",
    vehicleType: "TRICYCLE",
    ...overrides,
  };
}

function render(trips: RiderTripDto[]) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<TripList trips={trips} now={NOW} filtered={false} />);
  return container;
}

describe("rider recent trip list", () => {
  it("shows both stops, the fare paid in the fare chip, and the trip facts", () => {
    const row = render([trip()]).querySelector("li")!;

    expect(row.textContent).toContain("From Brgy. Poblacion (Basey Public Market)");
    expect(row.textContent).toContain("to Brgy. Guirang Elementary School");
    expect(row.textContent).toContain("Paid ₱26");
    expect(row.textContent).toContain("BSY-1042");
    expect(row.textContent).toContain("6.4 km");
    expect(row.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-26T07:36:00.000Z");
    expect(row.textContent).not.toContain("saved");
  });

  it("names the discount and what it saved", () => {
    const row = render([
      trip({ fare: 20.8, originalFare: 26, discount: 5.2, discountType: "STUDENT", group: "DISCOUNTED" }),
    ]).querySelector("li")!;

    expect(row.textContent).toContain("Paid ₱20.80");
    expect(row.textContent).toContain("Student, saved ₱5.20");
  });

  it("says how many seats a chartered fare covers", () => {
    const row = render([trip({ fare: 30, seatsPaid: 2 })]).querySelector("li")!;

    expect(row.textContent).toContain("2 seats");
  });
});
