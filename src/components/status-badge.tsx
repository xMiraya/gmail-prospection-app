import { Badge } from "@/components/ui/badge";

export const STATUS_LABELS: Record<string, string> = {
  NOUVEAU: "Nouveau",
  A_CONTACTER: "À contacter",
  EMAIL_PROGRAMME: "Email programmé",
  CONTACTE: "Contacté",
  RELANCE_1: "Relance 1",
  RELANCE_2: "Relance 2",
  RELANCE_3: "Relance 3",
  A_REPONDU: "A répondu",
  INTERESSE: "Intéressé",
  A_RAPPELER: "À rappeler",
  RENDEZ_VOUS: "Rendez-vous",
  PROPOSITION_ENVOYEE: "Proposition envoyée",
  PAS_INTERESSE: "Pas intéressé",
  CLIENT: "Client",
  NE_PLUS_CONTACTER: "Ne plus contacter",
  A_VERIFIER: "À vérifier",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "brand" | "success" | "warning" | "destructive" | "outline"> = {
  NOUVEAU: "secondary",
  A_CONTACTER: "outline",
  EMAIL_PROGRAMME: "brand",
  CONTACTE: "brand",
  RELANCE_1: "brand",
  RELANCE_2: "brand",
  RELANCE_3: "brand",
  A_REPONDU: "warning",
  INTERESSE: "success",
  A_RAPPELER: "warning",
  RENDEZ_VOUS: "success",
  PROPOSITION_ENVOYEE: "success",
  PAS_INTERESSE: "outline",
  CLIENT: "success",
  NE_PLUS_CONTACTER: "destructive",
  A_VERIFIER: "destructive",
};

export function ProspectStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>{STATUS_LABELS[status] ?? status}</Badge>;
}
