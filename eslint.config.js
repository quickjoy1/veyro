import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import security from 'eslint-plugin-security'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'dev-dist/**', // generated service-worker output
      'android/**',
      'ios/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      security,
    },
    rules: {
      // React hooks: broken hook order is a real bug, missing deps is a hint.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Security
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-object-injection': 'off', // noisy in web apps
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',

      // Intentionally empty `catch {}` (for example around localStorage) is fine.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // `cond && doThing()` and ternaries are common in this codebase.
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
      // @ts-expect-error / @ts-ignore are allowed when they explain why.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': 'allow-with-description', minimumDescriptionLength: 5 },
      ],

      // The codebase uses `any` widely; the compiler already checks the rest.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // TypeScript already reports undefined names, and `no-undef` does not know types like JSX or NodeJS.
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-undef': 'off' },
  },
  {
    // Config files run in Node and may use require().
    files: ['*.config.{js,cjs}', 'tailwind.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'security/detect-non-literal-require': 'off',
    },
  },
)
