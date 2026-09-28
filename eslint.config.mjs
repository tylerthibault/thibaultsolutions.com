import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "dist-worker/**", "public/store/**", "public/tech/**", "public/bold/**", "public/mashup/**", "next-env.d.ts"])
]);
