import { deleteCustomer, getAccount } from "@/server/customer";
import { route } from "@/server/http";
import { requireOwner } from "@/server/owner";

// The signed-in customer's account (V-05): details, addresses, wishlist,
// favourite shops, orders and refunds. 401 when signed out.
export const GET = route(async () => {
  const user = await requireOwner();
  return Response.json(await getAccount(user));
});

// Delete my customer account and its data.
export const DELETE = route(async () => {
  const user = await requireOwner();
  const result = await deleteCustomer(user);
  if (result.signedOut) await user.db.auth.signOut();
  return Response.json(result);
});
