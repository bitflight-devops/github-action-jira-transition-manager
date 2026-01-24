import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import promise from 'eslint-plugin-promise';
import jsonSchemaValidator from 'eslint-plugin-json-schema-validator';
import * as yamlParser from 'yaml-eslint-parser';
import * as jsoncParser from 'jsonc-eslint-parser';

// Vitest globals for test files
const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
};

export default [
  // Global ignores
  {
    ignores: ['node_modules/**', 'dist/**', 'lib/**', 'coverage/**', 'e2e/dist/**', '*.d.ts', 'commitlint.config.js'],
  },

  // Base JS recommended
  js.configs.recommended,

  // YAML files
  {
    files: ['**/*.yml', '**/*.yaml'],
    languageOptions: {
      parser: yamlParser,
    },
    plugins: {
      'json-schema-validator': jsonSchemaValidator,
    },
    rules: {
      ...jsonSchemaValidator.configs['flat/recommended'].rules,
    },
  },

  // JSON files
  {
    files: ['**/*.json', '**/*.json5', '**/*.jsonc'],
    languageOptions: {
      parser: jsoncParser,
      parserOptions: {
        jsonSyntax: 'JSONC',
      },
    },
    plugins: {
      'json-schema-validator': jsonSchemaValidator,
    },
    rules: {
      ...jsonSchemaValidator.configs['flat/recommended'].rules,
    },
  },

  // JavaScript/CommonJS files
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-console': 'off',
      'no-plusplus': 'off',
    },
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
      'import': importPlugin,
      'simple-import-sort': simpleImportSort,
      sonarjs,
      unicorn,
      promise,
    },
    rules: {
      // Prettier
      ...prettierConfig.rules,
      'prettier/prettier': 'error',

      // TypeScript
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/dot-notation': 'error',
      'no-use-before-define': 'off',
      'dot-notation': 'off',

      // Import sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/extensions': 'off',
      'import/no-namespace': 'off',
      'import/prefer-default-export': 'off',

      // SonarJS
      ...sonarjs.configs.recommended.rules,
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-duplicate-string': 'off',

      // Unicorn
      ...unicorn.configs['flat/recommended'].rules,
      'unicorn/filename-case': 'off',
      'unicorn/import-style': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prevent-abbreviations': 'off',

      // Promise
      ...promise.configs['flat/recommended'].rules,

      // General
      'no-console': 'off',
      'no-plusplus': 'off',
      'no-shadow': 'off',
      'no-unused-vars': 'off',
      'no-restricted-syntax': 'off',
      'operator-linebreak': ['error', 'after'],
      'consistent-return': 'off',
      'camelcase': 'off',
      'quote-props': 'off',
      'one-var': 'off',
      'semi': 'off',
      'lines-between-class-members': 'off',
      'space-before-function-paren': 'off',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },

  // Test files - add Vitest globals
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        ...vitestGlobals,
      },
    },
    rules: {
      'unicorn/no-immediate-mutation': 'off',
    },
  },

  // E2E test files - more relaxed rules
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...vitestGlobals,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
];
