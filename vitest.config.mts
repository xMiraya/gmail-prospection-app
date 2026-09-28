import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Tests unitaires : aucune base de données ni appel réseau, tout ce qui touche
// Prisma ou Gmail est mocké. Rapide, lancé en CI et en local sans setup.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
