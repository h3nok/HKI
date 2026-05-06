/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@hki/eslint-config/base"],
  overrides: [
    {
      // Framework packages must never import from product apps or services.
      // One-way dependency: apps → packages, never packages → apps.
      files: ["packages/**/*.{ts,tsx}"],
      rules: {
        "import/no-restricted-paths": [
          "error",
          {
            zones: [
              {
                target: "./packages",
                from: "./apps",
                message:
                  "Framework packages must not import from product apps. Extract shared types into @hki/runtime or @hki/sdk instead.",
              },
              {
                target: "./packages",
                from: "./services",
                message:
                  "Framework packages must not import from backend services.",
              },
            ],
          },
        ],
      },
    },
  ],
};
