import { route } from "@/server/http";
import { requireShop } from "@/server/owner";
import { restockList } from "@/server/restock";

// The order list as JSON (doc 06 O-7); the Orders tab renders the same list.
export const GET = route(async (_request, _ctx, { requestId }) => {
  const owner = await requireShop();
  return Response.json(await restockList({ ...owner, requestId }));
});
