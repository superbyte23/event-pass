import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';

const config = [
  {
    ignores: [
      '.next/**',
      '.next-build/**',
      'node_modules/**',
      'dist/**',
      'drizzle/**',
      'base44/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...nextCoreWebVitals,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    // Next's flat config already registers react and react-hooks.
    plugins: {
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-empty-pattern': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
      // This is a React 18 app; Next 16's preset enables React Compiler-era
      // rules that assume React 19 semantics and flag existing data-loading effects.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // The app uses a react-router SPA shell and a custom image wrapper; Next's
      // Link/Image rules do not apply to those paths.
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
