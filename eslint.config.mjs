import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node, // Enable Node.js globals like process, __dirname, etc.
      },
    },
  },
  {
    languageOptions: {
      globals: globals.browser, // For browser globals if needed
    },
  },
  pluginJs.configs.recommended,
];
