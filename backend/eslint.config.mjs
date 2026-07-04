import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["backups/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["server.js", "src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-empty": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
