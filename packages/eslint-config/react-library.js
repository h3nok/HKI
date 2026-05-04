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
    react: {
      version: "detect",
    },
  },
  env: {
    browser: true,
    es2022: true,
  },
  rules: {
    // React rules
    "react/prop-types": "off",
    "react/jsx-no-target-blank": "error",
    "react/jsx-key": "error",
    "react/self-closing-comp": "error",
    "react/jsx-curly-brace-presence": [
      "error",
      { props: "never", children: "never" },
    ],
    "react/display-name": "error",

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Library best practices
    "import/no-default-export": "warn", // Prefer named exports in libraries
  },
  overrides: [
    {
      files: ["*.stories.tsx", "*.test.tsx"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
};
