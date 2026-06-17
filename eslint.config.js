// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // We intentionally load data from Supabase (an external system) inside
      // effects and call setState after the awaited fetch resolves. The
      // experimental React Compiler rule flags these data-sync effects even
      // though the setState is asynchronous, so we disable it project-wide.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: ["dist/*"],
  },
]);
