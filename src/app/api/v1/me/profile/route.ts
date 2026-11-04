import { Profile, saveProfile } from "@/server/customer";
import { readJson, route } from "@/server/http";
import { requireOwner } from "@/server/owner";

// Name, mobile and how the customer likes to pay.
export const PUT = route(async (request) => {
  const user = await requireOwner();
  await saveProfile(user, await readJson(request, Profile));
  return new Response(null, { status: 204 });
});
