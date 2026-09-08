import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Historical copies kept for reference; not part of the build.
    ".codex-backups/**",
    "tmp/**",
  ]),
  {
    // Client pages consume typed API responses through the shared fetch hook,
    // so explicit `any` is no longer needed anywhere in the tree.
    //   - set-state-in-effect: the data hook and countdown intentionally set
    //     state after mount to keep server and client renders identical.
    //   - no-img-element: local, pre-optimized game art served from /public — not
    //     something next/image's remote optimization helps with.
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
