/**
 * Environment variable validation. Call at app startup or first use of server features
 * so misconfiguration fails fast with clear errors. Extend required vars as needed.
 */

const required = {
  // Supabase – required when using recipients, users, or any DB
  Supabase: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const,
} as const;

// When checking a key, if any alias is set we consider the key "present"
const optionalAliases: Record<string, string[]> = {
  NEXT_PUBLIC_SUPABASE_URL: ["SUPABASE_URL"],
};

function getEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * Validate that required env vars for a given "feature" are set.
 * Use in server code paths (e.g. getSupabase) so missing vars throw at first use.
 */
export function requireEnv(feature: keyof typeof required): void {
  const vars = required[feature];
  const missing = vars.filter((key) => {
    const v = getEnv(key)?.trim();
    if (v) return false;
    const aliases = optionalAliases[key];
    if (aliases?.some((a) => getEnv(a)?.trim())) return false;
    return true;
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing required env for ${feature}: ${missing.join(", ")}. See .env.example.`
    );
  }
}

/**
 * Optional: validate all features that might be used in production.
 * Call from next.config or a server-only init module if you want build-time validation.
 */
export function validateEnv(options: { supabase?: boolean }): void {
  if (options.supabase) requireEnv("Supabase");
}
