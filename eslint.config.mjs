import js from '@eslint/js';

export default [
  { ignores: ['node_modules/**', '.next/**', 'dist/**', '.npm-cache/**'] },
  js.configs.recommended,
  { files: ['scripts/**/*.mjs', 'tests/**/*.mjs'], languageOptions: {
    ecmaVersion: 'latest', sourceType: 'module',
    globals: {
      process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly',
      fetch: 'readonly', AbortSignal: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
    },
  } },
];
