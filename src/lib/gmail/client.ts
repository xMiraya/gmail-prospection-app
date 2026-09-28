import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";

// Scopes strictement nécessaires : envoyer des emails, lire les threads pour détecter
// les réponses, et connaître l'adresse connectée. Pas d'accès à la corbeille/suppression
// autre que ce que l'app fait elle-même.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force la génération d'un refresh_token à chaque connexion
    scope: GMAIL_SCOPES,
    state,
  });
}

/**
 * Retourne un client Gmail authentifié pour l'utilisateur donné, en rafraîchissant
 * le token d'accès si nécessaire. Lève une erreur explicite si Gmail n'est pas connecté
 * ou si le refresh échoue (ex: l'utilisateur a révoqué l'accès depuis son compte Google).
 */
export async function getGmailClientForUser(userId: string) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account || !account.connected) {
    throw new Error("GMAIL_NOT_CONNECTED");
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiryDate.getTime(),
  });

  oauth2Client.on("tokens", async (tokens) => {
    // Persist les tokens rafraîchis automatiquement par la lib googleapis.
    await prisma.googleAccount.update({
      where: { userId },
      data: {
        ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(tokens.expiry_date ? { expiryDate: new Date(tokens.expiry_date) } : {}),
      },
    });
  });

  // Force un refresh si le token expire dans moins de 2 minutes.
  if (account.expiryDate.getTime() - Date.now() < 2 * 60 * 1000) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(refreshed.credentials);
    } catch (err) {
      await prisma.googleAccount.update({
        where: { userId },
        data: { connected: false },
      });
      throw new Error("GMAIL_TOKEN_EXPIRED");
    }
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

function base64UrlEncode(str: string) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Construit un message MIME et l'envoie via l'API Gmail, avec threading correct
 * (In-Reply-To / References) quand `threadId`/`inReplyToMessageId` sont fournis,
 * pour que les relances apparaissent dans le même fil de discussion.
 */
export function isSandboxMode() {
  return process.env.EMAIL_SANDBOX_MODE === "true";
}

/**
 * En mode sandbox (EMAIL_SANDBOX_MODE=true), REDIRIGE tout envoi réel vers
 * SANDBOX_EMAIL, quel que soit le prospect visé. Le destinataire prévu original
 * reste affiché tel quel dans l'interface (il est stocké tel quel en base dans
 * ScheduledEmail.toEmail) — seul l'appel Gmail réel change de cible, pour
 * pouvoir tester toute la chaîne (séquences, relances, cron) sans jamais
 * risquer d'atteindre un vrai prospect.
 */
export async function sendGmailMessage(params: {
  userId: string;
  to: string;
  subject: string;
  html: string;
  threadId?: string | null;
  inReplyToMessageId?: string | null;
}) {
  const gmail = await getGmailClientForUser(params.userId);
  const account = await prisma.googleAccount.findUniqueOrThrow({
    where: { userId: params.userId },
  });

  const sandbox = isSandboxMode();
  if (sandbox && !process.env.SANDBOX_EMAIL) {
    throw new Error("EMAIL_SANDBOX_MODE est activé mais SANDBOX_EMAIL n'est pas défini.");
  }

  const actualTo = sandbox ? process.env.SANDBOX_EMAIL! : params.to;
  const actualSubject = sandbox ? `[SANDBOX → destiné à ${params.to}] ${params.subject}` : params.subject;
  // En sandbox, un threadId réel de Gmail ne correspond pas forcément à un thread
  // existant avec l'adresse sandbox : on ne réutilise pas le threading dans ce cas
  // pour éviter une erreur Gmail "invalid thread".
  const threadId = sandbox ? undefined : params.threadId ?? undefined;
  const inReplyToMessageId = sandbox ? undefined : params.inReplyToMessageId;

  const headers = [
    `From: ${account.email}`,
    `To: ${actualTo}`,
    `Subject: =?UTF-8?B?${Buffer.from(actualSubject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
  ];
  if (inReplyToMessageId) {
    headers.push(`In-Reply-To: <${inReplyToMessageId}>`);
    headers.push(`References: <${inReplyToMessageId}>`);
  }

  const sandboxBanner = sandbox
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;margin-bottom:12px;font:12px monospace">MODE SANDBOX — destinataire réel prévu : ${params.to}</div>`
    : "";

  const raw = base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${sandboxBanner}${params.html}`);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId,
    },
  });

  return {
    gmailMessageId: res.data.id!,
    gmailThreadId: res.data.threadId!,
  };
}

/** Récupère l'adresse email associée au compte Google connecté. */
export async function fetchConnectedEmail(oauth2Client: InstanceType<typeof google.auth.OAuth2>) {
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data.email!;
}
