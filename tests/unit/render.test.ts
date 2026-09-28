import { describe, it, expect } from "vitest";
import { renderTemplate, detectVariables } from "@/lib/templates/render";
import type { Prospect, Company } from "@prisma/client";

function makeProspect(overrides: Partial<Prospect & { company?: Company | null }> = {}) {
  return {
    id: "p1",
    userId: "u1",
    firstName: "Julie",
    lastName: "Martin",
    email: "julie@exemple.fr",
    phone: null,
    website: null,
    sector: null,
    city: null,
    country: null,
    linkedinUrl: null,
    source: null,
    notes: null,
    companyId: null,
    status: "NOUVEAU",
    lastContactAt: null,
    nextFollowUpAt: null,
    optOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    company: null,
    ...overrides,
  } as Prospect & { company?: Company | null };
}

describe("detectVariables", () => {
  it("extrait les noms de variables uniques", () => {
    expect(detectVariables("Bonjour {{prenom}}, {{entreprise}} et encore {{prenom}}")).toEqual([
      "prenom",
      "entreprise",
    ]);
  });
});

describe("renderTemplate", () => {
  it("remplace toutes les variables disponibles", () => {
    const prospect = makeProspect({ sector: "Immobilier", city: "Ajaccio" });
    const { rendered, missingVariables } = renderTemplate(
      "Bonjour {{prenom}}, vous êtes dans le secteur {{secteur}} à {{ville}}",
      prospect
    );
    expect(rendered).toBe("Bonjour Julie, vous êtes dans le secteur Immobilier à Ajaccio");
    expect(missingVariables).toEqual([]);
  });

  it("signale les variables manquantes sans les remplacer par du vide", () => {
    const prospect = makeProspect({ sector: null });
    const { rendered, missingVariables } = renderTemplate("Secteur : {{secteur}}", prospect);
    expect(missingVariables).toEqual(["secteur"]);
    expect(rendered).toBe("Secteur : {{secteur}}");
  });

  it("ne signale rien pour un texte sans variable", () => {
    const prospect = makeProspect();
    const { missingVariables } = renderTemplate("Bonjour, sans variable.", prospect);
    expect(missingVariables).toEqual([]);
  });
});
