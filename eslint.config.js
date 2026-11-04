import js from '@eslint/js';

const sharedGlobals = {
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  process: 'readonly',
  queueMicrotask: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
};

const browserGlobals = {
  CSS: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  FormData: 'readonly',
  HTMLElement: 'readonly',
  HTMLDialogElement: 'readonly',
  Node: 'readonly',
  document: 'readonly',
  history: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  window: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'data/**',
      'coverage/**',
      '*.zip',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals,
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'off',
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
