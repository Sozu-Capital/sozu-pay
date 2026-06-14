import { NextRequest, NextResponse } from "next/server";
import { getOrganizationById } from "@/lib/db/organizations";

/**
 * GET /api/organization/treasury-address?organizationId=org_123
 * Fetches the treasury smart account address for a given organization
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  try {
    const org = await getOrganizationById(organizationId);
    
    if (!org) {
      console.log("[organization/treasury-address] Organization not found:", organizationId);
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Return the treasury smart account address
    return NextResponse.json({
      treasurySmartAccountAddress: org.treasury_smart_account_address,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[organization/treasury-address] Error fetching organization:", message, err);
    // If the error is about 0 rows, treat it as organization not found
    if (message.includes("result contains 0 rows") || message.includes("PGRST116")) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to fetch treasury address" },
      { status: 500 }
    );
  }
}
