import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Données de démonstration : toutes marquées source="Démo" pour rester
// clairement identifiables et séparables des vraies données de prospection.
async function main() {
  const email = process.env.SEED_USER_EMAIL ?? "demo@example.com";
  const password = process.env.SEED_USER_PASSWORD ?? "demopassword123";

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Compte de démo", passwordHash: await bcrypt.hash(password, 12) },
    update: {},
  });

  await prisma.prospectionSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  const template = await prisma.emailTemplate.create({
    data: {
      userId: user.id,
      name: "Prospection site internet",
      category: "Prospection",
      subject: "Votre présence en ligne, {{entreprise}}",
      body: "Bonjour {{prenom}},<br/><br/>Je suis tombé(e) sur le site de {{entreprise}} et je souhaitais vous contacter concernant votre présence en ligne à {{ville}}.<br/><br/>Bien à vous.",
      variables: ["prenom", "entreprise", "ville"],
    },
  });
  const relance1 = await prisma.emailTemplate.create({
    data: {
      userId: user.id,
      name: "Relance légère",
      category: "Relance",
      subject: "Re: Votre présence en ligne",
      body: "Bonjour {{prenom}},<br/><br/>Je me permets de revenir vers vous suite à mon précédent message.<br/><br/>Bien à vous.",
      variables: ["prenom"],
    },
  });

  const sequence = await prisma.sequence.create({
    data: {
      userId: user.id,
      name: "Séquence standard — 1 relance",
      steps: {
        create: [
          { order: 0, delayDays: 0, templateId: template.id, approxHour: 9 },
          { order: 1, delayDays: 3, templateId: relance1.id, approxHour: 10 },
        ],
      },
    },
  });

  const villes = ["Ajaccio", "Bastia", "Rennes", "Brest", "Vannes"];
  const secteurs = ["Immobilier", "Restauration", "Artisanat", "Santé", "Commerce"];
  const statuses = ["NOUVEAU", "CONTACTE", "A_REPONDU", "INTERESSE", "RENDEZ_VOUS", "CLIENT", "PAS_INTERESSE"] as const;

  const prospects = [];
  for (let i = 1; i <= 20; i++) {
    const company = await prisma.company.create({
      data: {
        userId: user.id,
        name: `Entreprise Démo ${i}`,
        sector: secteurs[i % secteurs.length],
        city: villes[i % villes.length],
        website: `https://entreprise-demo-${i}.fr`,
      },
    });
    const prospect = await prisma.prospect.create({
      data: {
        userId: user.id,
        firstName: `Prénom${i}`,
        lastName: `Nom${i}`,
        email: `demo.prospect${i}@example.com`,
        city: company.city,
        sector: company.sector,
        website: company.website,
        source: "Démo",
        companyId: company.id,
        status: statuses[i % statuses.length],
      },
    });
    prospects.push(prospect);
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      name: "Démo — Prospection sites internet",
      description: "Campagne de démonstration",
      sequenceId: sequence.id,
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  for (const p of prospects.slice(0, 10)) {
    await prisma.campaignProspect.create({ data: { campaignId: campaign.id, prospectId: p.id } });
  }

  await prisma.campaign.create({
    data: { userId: user.id, name: "Démo — Relance salon", description: "Brouillon", sequenceId: sequence.id },
  });
  await prisma.campaign.create({
    data: { userId: user.id, name: "Démo — Terminée", description: "Campagne archivée", sequenceId: sequence.id, status: "TERMINEE" },
  });

  console.log(`Données de démo créées pour ${email} / mot de passe: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
