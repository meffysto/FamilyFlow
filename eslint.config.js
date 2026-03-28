const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    files: ['hooks/**/*.ts', 'hooks/**/*.tsx', 'lib/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
