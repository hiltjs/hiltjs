import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**']),

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `any` defeats the point of publishing types. Use `unknown` at the
      // boundary and narrow.
      '@typescript-eslint/no-explicit-any': 'error',

      // Type-only imports are erased at compile time. Being explicit keeps
      // them out of the emitted JavaScript and out of the consumer's graph.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // A dropped promise in a view-model is a lifecycle bug that surfaces
      // somewhere else entirely. Mark deliberate fire-and-forget with `void`.
      '@typescript-eslint/no-floating-promises': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Off deliberately. Implementing an async contract that happens not to
      // need `await` is correct, not a smell: `RelayCommand.execute` returns a
      // promise because `Command` says so, and a view-model may override the
      // async `onActivate` with synchronous setup. The rule flags every one of
      // those and has nothing true to say about them.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Tests get to be hostile. They feed `any` and throw non-Errors on purpose,
  // because that is what they are checking the kernel survives. Enforcing
  // type-safety rules on the code whose job is to violate type safety just
  // makes the suite less able to do it.
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/only-throw-error': 'off',
    },
  },

  // Config and scripts run in Node, outside any package's tsconfig.
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs', 'packages/*/*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
      parserOptions: { projectService: false, project: false },
    },
  },

  prettier,
]);
