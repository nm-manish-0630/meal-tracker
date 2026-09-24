import eslintConfigPrettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for applications that use Vue.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const vueConfig = [
  ...baseConfig,
  ...pluginVue.configs["flat/recommended"],
  eslintConfigPrettier,
  {
    ignores: ["dist/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
