import { z } from "zod";

import { adminToday, requireAdmin, setBreaker } from "@/server/admin";
import { readJson, route } from "@/server/http";

const Body = z.object({ open: z.boolean() }).strict();

// The admin page's AI pause switch (W-20b). 404 for anyone not on ADMIN_EMAILS.
export const POST = route(async (request) => {
  const admin = await requireAdmin();
  const { open } = await readJson(request, Body);
  await setBreaker(open, admin.id);
  return Response.json({ breaker: (await adminToday()).breaker });
});
