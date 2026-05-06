/**
 * ESLint configuration for React component libraries
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  extends: [
    "./base.js",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  plugins: ["react", "react-hooks", "jsx-a11y"],
  settings: {
    react: { version: "detect" },
  },
  env: {
    browser: true,
    es2022: true,
  },
  rules: {
    // React correctness
    "react/prop-types": "off",
    "react/jsx-no-target-blank": "error",
    "react/jsx-key": "error",
    "react/self-closing-comp": "error",
    "react/jsx-curly-brace-presence": [
      "error",
      { props: "never", children: "never" },
    ],
    "react/display-name": "error",

    // React hooks — exhaustive-deps is an error: missing deps = stale closures
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",

    // Performance: avoid creating new references on every render
    "react/jsx-no-bind": [
      "warn",
      {
        allowArrowFunctions: false,
        allowBind: false,
        allowFunctions: false,
        ignoreDOMComponents: true,
        ignoreRefs: true,
      },
    ],

    // Library best practices
    "import/no-default-export": "warn",
  },
  overrides: [
    {
      files: ["*.stories.tsx", "*.test.tsx", "*.test.ts"],
      rules: {
        "import/no-default-export": "off",
        "react/jsx-no-bind": "off",
      },
    },
  ],
};
