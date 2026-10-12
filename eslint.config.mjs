// ESLint 9 flat config. Replaces .eslintrc.json, whose ESLint 8 setup had no TypeScript parser
// and so linted only the .js mocks (found verifying anime-rss#89).
import importHelpers from 'eslint-plugin-import-helpers'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import neostandard from 'neostandard'

export default [
  // Style rules off: prettier owns formatting, as eslint-config-prettier did before.
  ...neostandard({
    ts: true,
    noStyle: true,
    ignores: [
      'node_modules',
      'frontend',
      'dist',
      'dist-test',
      'coverage',
      'src/server.js',
      'src/jobsServer.js',
      'src/infra/swagger',
      'tests/**/*.integration.spec.js',
    ],
  }),
  prettierRecommended,
  {
    plugins: { 'import-helpers': importHelpers },
    rules: {
      'no-console': 'error',
      'import-helpers/order-imports': [
        'warn',
        {
          newlinesBetween: 'always',
          groups: ['module', ['parent', 'sibling', 'index']],
          alphabetize: { order: 'asc', ignoreCase: true },
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'src/__mocks__/**', 'src/infra/service/mock/**'],
    languageOptions: { globals: globals.jest },
  },
]
