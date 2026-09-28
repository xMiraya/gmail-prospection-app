import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { processDueEmails } from "@/lib/queue/sender";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await processDueEmails();
  return NextResponse.json(result);
}
