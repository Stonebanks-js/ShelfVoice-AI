import { expect, test } from "@playwright/test";

import { blockingViolations, darkMode, localAdmin, localSupabase, signInAsNewOwner } from "./support";

// V-03 review gate: customers find shops near them without an account, by
// pincode or by the phone's location, nearest first, and open a shop's page.

test.skip(!localSupabase, "needs the local Supabase stack");

// Three shops of our own in an area no other journey uses: two published at
// 0.5 km and 3 km, one hidden.
async function area(page: import("@playwright/test").Page) {
  const admin = localAdmin();
  const lat = 12 + Math.random() * 10;
  const lng = 72 + Math.random() * 10;
  const pincode = `${Math.floor(100 + Math.random() * 800)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  const tag = Math.random().toString(36).slice(2, 6);
  const make = async (name: string, kmNorth: number, published: boolean) => {
    const userId = await signInAsNewOwner(page, { withShop: false });
    const { data, error } = await admin
      .from("shops")
      .insert({
        owner_id: userId,
        name,
        slug: `area-${tag}-${name.split(" ")[0].toLowerCase()}`,
        category: "Kirana",
        address: "Station Road",
        pincode,
        lat: lat + kmNorth / 111,
        lng,
        is_published: published,
      })
      .select("slug")
      .single();
    if (error) throw error;
    return data.slug;
  };
  const far = await make(`Far Kirana ${tag}`, 3, true);
  const near = await make(`Near Kirana ${tag}`, 0.5, true);
  await make(`Hidden Kirana ${tag}`, 1, false);
  await page.context().clearCookies(); // a customer, not an owner
  return { lat, lng, pincode, tag, near, far };
}

test("a customer finds shops by pincode and by location, nearest first", async ({ page, context }) => {
  const shops = await area(page);
  await page.goto("/");
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("link", { name: /^Customer/ }).click();
  await expect(page).toHaveURL("/shops");
  await expect(page.getByRole("heading", { level: 1, name: "Shops near you" })).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);

  await page.getByRole("textbox", { name: "Pincode" }).fill(shops.pincode);
  await page.getByRole("button", { name: "Find" }).click();
  const list = page.getByRole("list", { name: "Shops near you" });
  await expect(list.getByRole("link", { name: new RegExp(`Near Kirana ${shops.tag}`) })).toContainText("In your area");
  await expect(list.getByRole("link", { name: new RegExp(`Far Kirana ${shops.tag}`) })).toBeVisible();
  await expect(list.getByRole("link", { name: new RegExp(`Hidden Kirana ${shops.tag}`) })).toHaveCount(0);

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: shops.lat, longitude: shops.lng });
  await page.getByRole("button", { name: "Use my location" }).click();
  const ours = list.getByRole("link", { name: new RegExp(`Kirana ${shops.tag}`) });
  await expect(ours).toHaveCount(2);
  await expect(ours.first()).toContainText(`Near Kirana ${shops.tag}`);
  // The customer's point is rounded to about 100 m, so distances move a little.
  await expect(ours.first()).toContainText(/0\.\d km away/);
  await expect(ours.nth(1)).toContainText(/[23](\.\d)? km away/);
  await darkMode(page);
  expect(await blockingViolations(page)).toEqual([]);

  await ours.first().click();
  await expect(page).toHaveURL(`/s/${shops.near}`);
});

test("a customer is told when no shop is nearby, and a wrong pincode can't be searched", async ({ page }) => {
  await page.goto("/shops");
  const pincode = page.getByRole("textbox", { name: "Pincode" });
  await pincode.fill("12ab");
  await expect(pincode).toHaveValue("12");
  await expect(page.getByRole("button", { name: "Find" })).toBeDisabled();
  // 998xxx is no real pincode area, and no test puts a shop there.
  await pincode.fill("998877");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByRole("heading", { name: "No shops near you on Shelf Voice yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Own a shop? Put it online" })).toHaveAttribute("href", "/owner");
});

test("the shop search refuses bad input", async ({ request }) => {
  expect((await request.get("/api/v1/public/shops/nearby?pincode=12")).status()).toBe(422);
  expect((await request.get("/api/v1/public/shops/nearby?lat=200&lng=1")).status()).toBe(422);
  expect((await request.get("/api/v1/public/shops/nearby")).status()).toBe(422);
});
