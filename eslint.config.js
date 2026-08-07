import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Teil 26b: eine Bibliothek statt drei — neues handgeschriebenes Knopf-/Feld-Markup
      // wird gemeldet (warn, nicht error: der bestehende Bestand wird nicht rückwirkend
      // erzwungen). Nutze stattdessen @/components/ui/button bzw. @/components/ui/input.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Nutze <Button> aus @/components/ui/button statt eines rohen <button>.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: "Nutze <Input> aus @/components/ui/input statt eines rohen <input>.",
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
