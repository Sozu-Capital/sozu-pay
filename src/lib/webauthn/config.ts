export const rpName = "SozuPay";

export function getRpID(request?: Request): string {
  if (request) {
    try {
      const origin = request.headers.get("origin");
      if (origin) return new URL(origin).hostname;
      const host = request.headers.get("host");
      if (host) return host.split(":")[0] ?? host;
    } catch {
      // fall through
    }
  }
  if (process.env.NEXT_PUBLIC_RP_ID) return process.env.NEXT_PUBLIC_RP_ID;
  if (typeof window !== "undefined") return window.location.hostname;
  return "localhost";
}

export const challengeStore = new Map<string, { challenge: string; timestamp: number }>();

export function cleanupChallenges(): void {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of challengeStore.entries()) {
    if (value.timestamp < fiveMinutesAgo) challengeStore.delete(key);
  }
}
