import { addProduct, ProductInput } from "@/server/catalog";
import { fromPostgres, readJson, route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { withPhotos } from "@/server/stock-photos";

// Owner catalog with stock and forecast (Stock tab, doc 06 O-6).
export const GET = route(async () => {
  const { db, shop } = await requireShop();
  const { data, error } = await db
    .from("products")
    .select("*, product_forecasts(level, days_left, reorder_point, order_qty, stockout_boost_until, computed_at)")
    .eq("shop_id", shop.id)
    .is("archived_at", null)
    .order("category", { nullsFirst: false })
    .order("name");
  if (error) throw fromPostgres(error);
  return Response.json({ products: withPhotos(data) });
});

// Add a product by tap (doc 02: direct catalog edits by tap). Its forecast
// row is made right away, so a low count warns today, not after the nightly job.
export const POST = route(async (request, _ctx, { requestId }) => {
  const owner = await requireShop();
  const body = await readJson(request, ProductInput);
  return Response.json({ product: await addProduct({ ...owner, requestId }, body) }, { status: 201 });
});
