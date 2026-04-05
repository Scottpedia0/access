import { NextResponse } from "next/server";
import { getConnectedAccounts } from "@/lib/google/accounts";

export async function GET() {
  return NextResponse.json({ accounts: await getConnectedAccounts() });
}
