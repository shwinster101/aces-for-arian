import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Build/config files run in Node, not the browser (need __dirname etc.).
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  // Google Apps Script write-back: runs in Google's cloud (GAS globals), and
  // doPost is an entry point invoked by Apps Script, not called from our code.
  {
    files: ['apps-script/**/*.js'],
    languageOptions: {
      globals: { SpreadsheetApp: 'readonly', ContentService: 'readonly' },
    },
    rules: { 'no-unused-vars': 'off' },
  },
])
