// @ts-check
import js from "@eslint/js";
import gitignore from "eslint-config-flat-gitignore";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript-eslint";
import tailwind from "eslint-plugin-tailwindcss";

export default ts.config(
  gitignore(),
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  ...tailwind.configs["flat/recommended"],

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: "tsconfig.*.json",
        tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
        projectService: true,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    files: ["**/*.?(c|m)[j]s?(x)"],
    ...ts.configs.disableTypeChecked,
  },

  // Global overrides
  {
    files: ["**/*.?(c|m)[t]s?(x)"],
    rules: {
      // Both interface and type are useful in different ways
      "@typescript-eslint/consistent-type-definitions": "off",
      // Empty functions are often useful and shouldn't require adding a comment
      "@typescript-eslint/no-empty-function": "off",
      // Default settings interfere with react-hook-form's form `onSubmit` handler
      // https://github.com/orgs/react-hook-form/discussions/8622
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      // Allow TypeScript/tsc-style underscore-prefixed unused variables
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },

  // Tests
  {
    files: [`src/**/*.test.?(c|m)[jt]s?(x)`],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
  },

  // Must be last
  prettierRecommended,
);
