/**
 * Shared auth constants used in both Node (route handlers) and Edge (middleware).
 * Keep this file free of Node-only imports (e.g. crypto).
 */

export const SESSION_COOKIE =
  (process.env.SESSION_COOKIE_NAME ?? "").trim() || "sozupay_session";

