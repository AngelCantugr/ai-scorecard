/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  parserOptions: {
    project: true,
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
  },
  overrides: [
    {
      files: ["*.js", "*.cjs", ".eslintrc.js"],
      env: {
        node: true,
      },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    {
      // Test files use vi.fn() mocks and dynamic imports whose types ESLint can't
      // fully resolve through moduleResolution:"bundler". Disable the unsafe-type
      // rules here — the logic is covered by the test assertions themselves.
      files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
      rules: {
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-call": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    "*.config.js",
    "*.config.ts",
    "postcss.config.js",
    "tailwind.config.ts",
  ],
};
