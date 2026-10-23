import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { reclassifyExistingMessages } from "@/lib/gmail/reclassify";
import { prisma } from "@/lib/db/prisma";

// One-off endpoint to retro-classify emails imported before the smart inbox
// filter existed (old Fnac/Temu-style rows with messageType = null). Idempotent:
// only touches rows still missing a messageType. Never deletes/modifies anything
// in Gmail itself, only the local classification columns.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await reclassifyExistingMessages(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
