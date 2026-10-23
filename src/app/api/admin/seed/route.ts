import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { seedDemoData } from "@/lib/db/seed-demo";
import { prisma } from "@/lib/db/prisma";

// One-off endpoint to (re)run the demo seed against the production database
// without making every Vercel build re-seed. Idempotent, protected by CRON_SECRET
// since it is reachable in production.
function isAuthorized(req: NextRequest) {
  if (isCronAuthorized(req)) return true;
  const secret = req.nextUrl.searchParams.get("secret");
  return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedDemoData(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
