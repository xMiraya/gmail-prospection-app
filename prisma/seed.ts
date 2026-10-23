import { prisma } from "../src/lib/db/prisma";
import { seedDemoData } from "../src/lib/db/seed-demo";

seedDemoData(prisma)
  .then(({ email, password, created }) => {
    console.log(
      created
        ? `Données de démo créées pour ${email} / mot de passe: ${password}`
        : `Données de démo déjà présentes pour ${email} / mot de passe: ${password}`
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
