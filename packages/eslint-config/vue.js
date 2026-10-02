import babelParser from "@babel/eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import vueEslintParser from "vue-eslint-parser";
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
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueEslintParser,
      parserOptions: {
        parser: babelParser,
        sourceType: "module",
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: {
            plugins: ["typescript", "jsx"],
          },
        },
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
