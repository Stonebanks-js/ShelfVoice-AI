import { Address, saveAddress } from "@/server/customer";
import { readJson, route } from "@/server/http";
import { requireOwner } from "@/server/owner";

// A saved delivery address (V-05), up to 10.
export const POST = route(async (request) => {
  const user = await requireOwner();
  const id = await saveAddress(user, await readJson(request, Address));
  return Response.json({ id }, { status: 201 });
});
