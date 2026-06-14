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
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Return the treasury smart account address
    return NextResponse.json({
      treasurySmartAccountAddress: org.treasury_smart_account_address,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[organization/treasury-address]", message, err);
    return NextResponse.json(
      { error: "Failed to fetch treasury address" },
      { status: 500 }
    );
  }
}
