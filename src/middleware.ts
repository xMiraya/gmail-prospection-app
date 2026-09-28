export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/gmail/callback|api/signup|login|signup|_next/static|_next/image|favicon.ico).*)",
  ],
};
