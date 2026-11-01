import { z } from "zod";

import { env } from "@/env/server";
import { ApiError, readJson, route } from "@/server/http";
import { createSampleShop } from "@/server/sample-shop/copy";

const Body = z.object({ userId: z.uuid(), language: z.enum(["hi", "en"]).default("en") }).strict();

// Test only: gives a test owner the seeded sample shop, for the Playwright
// journeys (E-36 removed the public demo shop they used). Off unless
// E2E_TEST_ROUTES=1, which the environment check refuses on any deploy.
export const POST = route(async (request) => {
  if (env.E2E_TEST_ROUTES !== "1") throw new ApiError(404, "NOT_FOUND", "Not found");
  const { userId, language } = await readJson(request, Body);
  return Response.json({ shopId: await createSampleShop(userId, new Date(), language) }, { status: 201 });
});
