import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.output/',
      '.tanstack/',
      'docs/.vitepress/dist/',
      'docs/.vitepress/cache/',
      'convex/_generated/',
      '*.gen.ts',
      'worker-configuration.d.ts',
    ],
  },
  {
    // Node globals for .mjs scripts
    files: ['scripts/**/*.mjs', 'packages/**/*.mjs', '*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
)
