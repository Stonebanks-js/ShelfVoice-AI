import { describe, expect, it } from "vitest";

import { placeFrom } from "./place";

describe("address from a position", () => {
  it("writes street, area and town once each, with a 6-digit pincode", () => {
    expect(placeFrom({ house_number: "12", road: "Station Road", suburb: "Govind Nagar", city: "Kanpur", postcode: "208006" })).toEqual({
      address: "12, Station Road, Govind Nagar, Kanpur",
      pincode: "208006",
    });
    expect(placeFrom({ road: "MG Road", neighbourhood: "Koramangala", suburb: "Koramangala", city: "Bengaluru", postcode: "560 034" })).toEqual({
      address: "MG Road, Koramangala, Bengaluru",
      pincode: "560034",
    });
  });

  it("leaves out what it isn't sure of", () => {
    expect(placeFrom({ village: "Rampur", postcode: "12345" })).toEqual({ address: "Rampur", pincode: null });
    expect(placeFrom({})).toEqual({ address: null, pincode: null });
  });
});
