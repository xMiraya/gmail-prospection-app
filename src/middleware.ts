export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/gmail/callback|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
