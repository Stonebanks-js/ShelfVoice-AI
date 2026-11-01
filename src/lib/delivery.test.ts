import { describe, expect, it } from "vitest";

import { deliveryFee, distanceKm, UPI_ID, upiLink } from "./delivery";

const rules = { minPaise: 20_000, feePaise: 2_000, freeAbovePaise: 50_000, radiusKm: 3 };

describe("delivery charge", () => {
  it("refuses delivery below the minimum, charges the fee, and is free above the amount", () => {
    expect(deliveryFee(rules, 19_999)).toBe("BELOW_MINIMUM");
    expect(deliveryFee(rules, 20_000)).toBe(2_000);
    expect(deliveryFee(rules, 50_000)).toBe(0);
  });

  it("is free when the shop sets no charge, with no minimum", () => {
    expect(deliveryFee({ minPaise: null, feePaise: null, freeAbovePaise: null, radiusKm: null }, 100)).toBe(0);
    expect(deliveryFee({ ...rules, minPaise: null, freeAbovePaise: null }, 100)).toBe(2_000);
  });
});

describe("distance", () => {
  it("measures about 1.11 km for 0.01 degrees of latitude", () => {
    expect(distanceKm({ lat: 28.98, lng: 77.7 }, { lat: 28.99, lng: 77.7 })).toBeCloseTo(1.112, 2);
    expect(distanceKm({ lat: 28.98, lng: 77.7 }, { lat: 28.98, lng: 77.7 })).toBe(0);
  });
});

describe("UPI", () => {
  it("knows a UPI ID when it sees one", () => {
    for (const id of ["sharmastore@okaxis", "98765.43210@ybl", "a_b-c@paytm"]) expect(UPI_ID.test(id)).toBe(true);
    for (const id of ["sharma store@okaxis", "sharmastore", "@okaxis", "x@1", "x@ok axis"]) expect(UPI_ID.test(id)).toBe(false);
  });

  it("builds the upi://pay link with the amount in rupees", () => {
    expect(upiLink({ upiId: "sharmastore@okaxis", shopName: "Sharma Kirana Store", amountPaise: 8250, note: "Order K7Q2" })).toBe(
      "upi://pay?pa=sharmastore%40okaxis&pn=Sharma%20Kirana%20Store&am=82.50&cu=INR&tn=Order%20K7Q2",
    );
  });
});
