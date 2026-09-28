import { NextRequest } from "next/server";

export function isCronAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}
