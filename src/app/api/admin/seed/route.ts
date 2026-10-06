import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { prisma } from "@/lib/db/prisma";
import { seedDemoData } from "@/lib/db/seed-demo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const { email, password, created } = await seedDemoData(prisma);
  return NextResponse.json({ email, password, created });
}
