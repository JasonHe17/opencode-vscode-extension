import js from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import typescript from "@typescript-eslint/parser"

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      },
      globals: {
        fetch: "readonly",
        EventSource: "readonly",
        NodeJS: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        process: "readonly",
        Buffer: "readonly",
        TextEncoder: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-unused-vars": "off"
    }
  }
]
