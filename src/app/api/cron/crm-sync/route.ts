import { NextResponse } from "next/server";
import { processCrmSyncBatch } from "@/lib/crm/process-queue";

/**
 * Optional cron: GET /api/cron/crm-sync?secret=CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (secret && url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processCrmSyncBatch(25);
  return NextResponse.json(result);
}
