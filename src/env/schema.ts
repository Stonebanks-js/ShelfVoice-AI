import { z } from "zod";

// Environment contract from doc 08 ("Environment variables and secrets") plus
// errata E-03 (META_CREDIT_ENDS_AT, replay-demo) and E-06 ($100 total budget,
// per-shop daily cap). Kept free of "server-only" so src/instrumentation.ts can
// import it and fail fast at startup.

// Vercel sets VERCEL_ENV on preview and production deploys. Locally, the
// observability and admin values may be missing so the app runs before every
// account exists; deployed, all of them are required.
const deployed = Boolean(process.env.VERCEL_ENV);

const deployedOnly = <T extends z.ZodType>(schema: T) =>
  deployed ? schema : schema.optional();

const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);

export const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

export const serverSchema = clientSchema
  .extend({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // Meta Model API: the only AI provider (Meta models only).
    META_API_KEY: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
    META_BASE_URL: z.url().default("https://api.meta.ai/v1"),
    META_MODE: z.enum(["recorded", "live", "replay-demo"]).default("recorded"),
    META_CREDIT_ENDS_AT: z.preprocess(emptyAsUndefined, z.iso.datetime({ offset: true }).optional()),

    TURNSTILE_SECRET_KEY: z.string().min(1),

    AXIOM_TOKEN: deployedOnly(z.string().min(1)),
    AXIOM_DATASET: deployedOnly(z.string().min(1)),
    BETTERSTACK_HEARTBEAT_URL: deployedOnly(z.url()),
    DISCORD_ALERT_WEBHOOK_URL: deployedOnly(z.url()),
    CRON_SECRET: deployedOnly(z.string().min(32)),
    ADMIN_EMAILS: deployedOnly(
      z
        .string()
        .transform((list) => list.split(",").map((email) => email.trim().toLowerCase()))
        .pipe(z.array(z.email()).min(1)),
    ),

    AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(15),
    AI_SHOP_DAILY_BUDGET_USD: z.coerce.number().positive().default(2),
    AI_TOTAL_BUDGET_USD: z.coerce.number().positive().max(150).default(100),

    RELEASE: z.string().default("dev"),
  })
  .superRefine((env, ctx) => {
    if (env.META_MODE !== "recorded" && !env.META_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["META_API_KEY"],
        message: `required when META_MODE is "${env.META_MODE}"`,
      });
    }
  });

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T extends z.ZodType>(schema: T, input: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid ${label} environment variables (see .env.example):\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

// NEXT_PUBLIC_ values are inlined at build time only when referenced by name.
export const parseClientEnv = () =>
  parse(
    clientSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
    "client",
  );

export const parseServerEnv = () => parse(serverSchema, process.env, "server");
