import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  /**
   * DAS HEFT WURDE BIS HEUTE GAR NICHT GELINTET.
   *
   * Der Block darunter fasst nur .ts und .tsx — `src/heft03/` besteht aus .js und .mjs,
   * 3.458 Zeilen, das gesamte oeffentliche Heft. Der Linter lief nie darueber.
   *
   * Der belegte Fehler, der das ans Licht brachte: `addPlinth` in world.mjs hatte schon
   * ein `return h;`, und ein angehaengtes `return base;` stand DAHINTER — unerreichbar.
   * Damit bekam makeBuehne eine Zahl statt der Gruppe, und das Ziehen (B6) haette beim
   * ersten Zug geworfen. Durchgerutscht sind: 120/120 Heft-Tests, npm test 353/353,
   * tsc 0, VERIFY 5/5 und der Bau. Kein Werkzeug hat es gemeldet, weil world.mjs THREE
   * importiert und darum in keinem Test laeuft — und der Linter es nicht ansah.
   *
   * ENG GEHALTEN, mit Absicht: nur Regeln, die STILLE Fehler fangen, keine Stilfragen.
   * Gemessen, bevor er eingebaut wurde — dieser Satz findet im ganzen src/heft03/
   * NULL bestehende Verstoesse. Er kostet also nichts und faengt trotzdem.
   */
  {
    files: ["src/heft03/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-self-assign": "error",
      "no-unsafe-negation": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
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
