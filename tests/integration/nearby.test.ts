// Shops near a customer (V-03) against the local database. Needs `supabase start`.
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { admin, testOwner } from "./helpers";

const { nearbyShops } = await import("@/server/nearby");

// An area of our own: a random point and pincode no other test uses.
function area() {
  return {
    lat: 12 + Math.random() * 10,
    lng: 72 + Math.random() * 10,
    pincode: `${Math.floor(100 + Math.random() * 800)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
  };
}

async function shopAt(name: string, fields: Record<string, unknown>) {
  const owner = await testOwner(false);
  const { error } = await admin
    .from("shops")
    .insert({ owner_id: owner.user.id, name, slug: `n-${randomUUID().slice(0, 8)}`, is_published: true, ...fields });
  if (error) throw error;
}

describe("shops near a customer", () => {
  it("lists published shops nearest first, with the distance", async () => {
    const here = area();
    const tag = randomUUID().slice(0, 6);
    await shopAt(`Far ${tag}`, { lat: here.lat + 4 / 111, lng: here.lng });
    await shopAt(`Near ${tag}`, { lat: here.lat + 1 / 111, lng: here.lng });
    await shopAt(`Hidden ${tag}`, { lat: here.lat, lng: here.lng, is_published: false });
    await shopAt(`Old demo ${tag}`, { lat: here.lat, lng: here.lng, is_demo: true, demo_expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    await shopAt(`Too far ${tag}`, { lat: here.lat + 2, lng: here.lng });

    const ours = (await nearbyShops({ lat: here.lat, lng: here.lng })).filter((s) => s.name.endsWith(tag));
    expect(ours.map((s) => s.name)).toEqual([`Near ${tag}`, `Far ${tag}`]);
    expect(ours[0].distanceKm).toBeCloseTo(1, 1);
    expect(ours[1].distanceKm).toBeCloseTo(4, 1);
  });

  it("finds shops in the same pincode area, the exact pincode first", async () => {
    const here = area();
    const tag = randomUUID().slice(0, 6);
    const neighbour = `${here.pincode.slice(0, 3)}${here.pincode.slice(3) === "999" ? "998" : "999"}`;
    await shopAt(`A neighbour ${tag}`, { pincode: neighbour });
    await shopAt(`Z same ${tag}`, { pincode: here.pincode });
    await shopAt(`Other area ${tag}`, { pincode: here.pincode === "999999" ? "111111" : "999999" });

    const ours = (await nearbyShops({ pincode: here.pincode })).filter((s) => s.name.endsWith(tag));
    expect(ours.map((s) => s.name)).toEqual([`Z same ${tag}`, `A neighbour ${tag}`]);
    expect(ours[0].distanceKm).toBeNull();
  });

  it("is for the server only", async () => {
    const owner = await testOwner();
    const { error } = await owner.db.rpc("nearby_shops", { p_lat: 20, p_lng: 78, p_pincode: null } as never);
    expect(error?.code).toBe("42501");
  });

  it("keeps a shop's location consistent", async () => {
    const owner = await testOwner();
    const { error: half } = await owner.db.from("shops").update({ lat: 20 }).eq("id", owner.shop.id);
    expect(half?.code).toBe("23514");
    const { error: badPin } = await owner.db.from("shops").update({ pincode: "012345" }).eq("id", owner.shop.id);
    expect(badPin?.code).toBe("23514");
    const { error } = await owner.db.from("shops").update({ lat: 20.5, lng: 78.9, pincode: "560001" }).eq("id", owner.shop.id);
    expect(error).toBeNull();
  });
});
