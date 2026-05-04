module.exports = {
  root: true,
  extends: ["@hki/eslint-config/react-library"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/no-unused-expressions": "off",
  },
};
