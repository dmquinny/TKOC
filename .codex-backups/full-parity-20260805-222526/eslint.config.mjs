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
  ]),
  {
    // These Next 16 / React 19 rules flag patterns that are intentional here:
    //   - no-explicit-any: client pages consume loosely-typed fetch() responses;
    //     the API route handlers remain the typed source of truth, and tsc still
    //     type-checks everything else.
    //   - set-state-in-effect / exhaustive-deps: standard fetch-on-mount effects
    //     (setState runs after an awaited fetch, not synchronously) keyed on router.
    //   - no-img-element: local, pre-optimized game art served from /public — not
    //     something next/image's remote optimization helps with.
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
