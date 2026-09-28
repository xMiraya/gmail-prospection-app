import type { Prospect, Company } from "@prisma/client";

export const AVAILABLE_VARIABLES = [
  "prenom",
  "nom",
  "entreprise",
  "ville",
  "secteur",
  "site",
] as const;

export type TemplateVariable = (typeof AVAILABLE_VARIABLES)[number];

export function detectVariables(text: string): string[] {
  const matches = text.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1]).filter((v): v is string => !!v)));
}

function variableValue(
  variable: string,
  prospect: Prospect & { company?: Company | null }
): string | null {
  switch (variable) {
    case "prenom":
      return prospect.firstName || null;
    case "nom":
      return prospect.lastName || null;
    case "entreprise":
      return prospect.company?.name || null;
    case "ville":
      return prospect.city || prospect.company?.city || null;
    case "secteur":
      return prospect.sector || prospect.company?.sector || null;
    case "site":
      return prospect.website || prospect.company?.website || null;
    default:
      return null;
  }
}

/**
 * Remplace les variables {{...}} par les données du prospect.
 * Retourne le texte généré ET la liste des variables demandées mais introuvables
 * (le prospect n'a par exemple pas de secteur renseigné) : l'appelant DOIT alors
 * refuser l'envoi automatique et placer le prospect en file "À vérifier".
 */
export function renderTemplate(
  text: string,
  prospect: Prospect & { company?: Company | null }
): { rendered: string; missingVariables: string[] } {
  const missing = new Set<string>();

  const rendered = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, variable: string) => {
    const value = variableValue(variable, prospect);
    if (value === null || value.trim() === "") {
      missing.add(variable);
      return `{{${variable}}}`;
    }
    return value;
  });

  return { rendered, missingVariables: Array.from(missing) };
}
