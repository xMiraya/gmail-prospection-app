import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { disconnectGmail } from "@/lib/actions/gmail";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default async function GmailSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const userId = await requireUserId();
  const account = await prisma.googleAccount.findUnique({ where: { userId } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compte Gmail</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connectez votre compte Gmail pour envoyer et suivre vos emails de prospection.
        </p>
      </div>

      {searchParams.connected && (
        <div className="rounded-md bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3">
          Compte Gmail connecté avec succès.
        </div>
      )}
      {searchParams.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
          La connexion à Gmail a échoué ({searchParams.error}). Réessayez.
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-4">
        {account?.connected ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Adresse connectée</p>
                <p className="font-medium">{account.email}</p>
              </div>
              <span className="badge bg-green-100 text-green-800">Connecté</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dernière synchronisation</p>
              <p className="text-sm">
                {account.lastSyncAt
                  ? format(account.lastSyncAt, "d MMMM yyyy à HH:mm", { locale: fr })
                  : "Jamais"}
              </p>
            </div>
            <form action={disconnectGmail}>
              <button className="text-sm rounded-md border px-4 py-2 hover:bg-muted" type="submit">
                Déconnecter Gmail
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm">
              {account && !account.connected
                ? "Le jeton Gmail a expiré ou a été révoqué. Reconnectez votre compte."
                : "Aucun compte Gmail connecté."}
            </p>
            <a
              href="/api/gmail/connect"
              className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              {account ? "Reconnecter Gmail" : "Connecter Gmail"}
            </a>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        La connexion utilise OAuth 2.0 Google et l'API Gmail officielle. Votre mot de passe Gmail
        n'est jamais demandé ni stocké. Les jetons d'accès sont chiffrés en base et ne sont jamais
        exposés au navigateur.
      </p>
    </div>
  );
}
