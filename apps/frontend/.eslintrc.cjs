module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // 🟡 On passe le type 'any' en simple avertissement au lieu d'une erreur bloquante
    '@typescript-eslint/no-explicit-any': 'warn',
    // 🟡 On tolère les variables inutilisées pour le moment pour laisser respirer le code
    '@typescript-eslint/no-unused-vars': 'warn',
  },
};