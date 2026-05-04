/**
 * ESLint configuration for Next.js applications
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
    node: true,
    es2022: true,
  },
  rules: {
    // React rules
    "react/prop-types": "off", // We use TypeScript for prop validation
    "react/jsx-no-target-blank": "error",
    "react/jsx-key": "error",
    "react/no-unescaped-entities": "warn",
    "react/self-closing-comp": "error",
    "react/jsx-curly-brace-presence": [
      "error",
      { props: "never", children: "never" },
    ],

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Next.js specific
    "@next/next/no-html-link-for-pages": "off", // Can be overridden in specific apps
  },
  overrides: [
    {
      files: ["*.tsx"],
      rules: {
        // Allow default export in page/layout files
        "import/no-default-export": "off",
      },
    },
  ],
};
