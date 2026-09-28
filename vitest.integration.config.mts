import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Tests d'intégration : utilisent une vraie base PostgreSQL (voir docker-compose.yml)
// via DATABASE_URL, mais mockent l'API Gmail (googleapis) pour ne jamais faire
// d'appel réseau réel ni exiger de compte Google. Couvre le scénario complet
// prospect → brouillon → validation → envoi → relance → réponse → annulation.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
