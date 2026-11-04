import { limit } from "@/server/abuse";
import { Barcode, scanBarcode } from "@/server/catalog";
import { ApiError, route } from "@/server/http";
import { requireShop } from "@/server/owner";

// A scanned barcode: the shop's own product, or a suggested name for a new
// one from Open Food Facts. Unknown codes return no suggestion; the
// owner names the product and the shop remembers its code.
export const GET = route(async (_request, ctx: RouteContext<"/api/v1/barcodes/[code]">, { requestId }) => {
  const { code } = await ctx.params;
  if (!Barcode.safeParse(code).success) throw new ApiError(422, "BAD_BARCODE", "That barcode can't be read");
  const owner = await requireShop();
  await limit(`barcodes:${owner.user.id}`, 60, 60);
  return Response.json(await scanBarcode({ ...owner, requestId }, code));
});
