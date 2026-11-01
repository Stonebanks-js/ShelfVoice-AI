import { z } from "zod";

import { Address, deleteAddress, saveAddress } from "@/server/customer";
import { ApiError, readJson, route } from "@/server/http";
import { requireOwner } from "@/server/owner";

const id = async (ctx: RouteContext<"/api/v1/me/addresses/[id]">) => {
  const { id: value } = await ctx.params;
  if (!z.uuid().safeParse(value).success) throw new ApiError(404, "NOT_FOUND", "Address not found");
  return value;
};

export const PUT = route(async (request, ctx: RouteContext<"/api/v1/me/addresses/[id]">) => {
  const user = await requireOwner();
  await saveAddress(user, await readJson(request, Address), await id(ctx));
  return new Response(null, { status: 204 });
});

export const DELETE = route(async (_request, ctx: RouteContext<"/api/v1/me/addresses/[id]">) => {
  const user = await requireOwner();
  await deleteAddress(user, await id(ctx));
  return new Response(null, { status: 204 });
});
