import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { disconnectGmail } from "@/lib/actions/gmail";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestGmailButton } from "./test-button";
import { SyncNowButton } from "../../reponses/sync-now-button";
import { Mails, CheckCircle2, AlertTriangle } from "lucide-react";

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
        <h1 className="text-2xl font-semibold tracking-tight">Compte Gmail</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connectez votre compte Gmail pour envoyer et suivre vos emails de prospection.
        </p>
      </div>

      {searchParams.connected && (
        <div className="rounded-md bg-success/10 border border-success/30 text-success text-sm px-4 py-3">
          Compte Gmail connecté avec succès.
        </div>
      )}
      {searchParams.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
          La connexion à Gmail a échoué ({searchParams.error}). Réessayez.
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Mails size={18} />
            </div>
            <div className="flex-1">
              <p className="font-medium">Google Gmail</p>
              <p className="text-xs text-muted-foreground">OAuth 2.0 · API Gmail officielle</p>
            </div>
            {account?.connected ? (
              <Badge variant="success" className="gap-1"><CheckCircle2 size={11} /> Connecté</Badge>
            ) : (
              <Badge variant="warning" className="gap-1"><AlertTriangle size={11} /> Non connecté</Badge>
            )}
          </div>

          {account?.connected ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                <div><p className="text-muted-foreground text-xs">Adresse connectée</p><p className="font-medium">{account.email}</p></div>
                <div>
                  <p className="text-muted-foreground text-xs">Dernière synchronisation</p>
                  <p>{account.lastSyncAt ? format(account.lastSyncAt, "d MMMM yyyy à HH:mm", { locale: fr }) : "Jamais"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Nouveaux messages (dernier sync)</p>
                  <p>{account.lastSyncNewCount ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Erreurs</p>
                  <p className={account.lastSyncError ? "text-destructive" : ""}>{account.lastSyncError ?? "Aucune"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 items-center">
                <TestGmailButton />
                <SyncNowButton
                  status={{
                    connected: account.connected,
                    lastSyncAt: account.lastSyncAt ? format(account.lastSyncAt, "d MMM yyyy à HH:mm", { locale: fr }) : null,
                    lastSyncNewCount: account.lastSyncNewCount,
                    lastSyncError: account.lastSyncError,
                  }}
                />
                <Button asChild variant="outline" size="sm">
                  <a href="/api/gmail/connect">Reconnecter</a>
                </Button>
                <form action={disconnectGmail}>
                  <Button variant="outline" size="sm" type="submit" className="text-destructive hover:text-destructive">
                    Déconnecter
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="pt-2 border-t">
              <p className="text-sm mb-3">
                {account && !account.connected
                  ? "Le jeton Gmail a expiré ou a été révoqué. Reconnectez votre compte."
                  : "Aucun compte Gmail connecté."}
              </p>
              <Button asChild>
                <a href="/api/gmail/connect">{account ? "Reconnecter Gmail" : "Connecter Gmail"}</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        La connexion utilise OAuth 2.0 Google et l'API Gmail officielle. Votre mot de passe Gmail
        n'est jamais demandé ni stocké. Les jetons d'accès sont chiffrés en base et ne sont jamais
        exposés au navigateur.
      </p>
    </div>
  );
}
