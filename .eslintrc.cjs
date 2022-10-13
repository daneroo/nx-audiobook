module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'standard-with-typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      './tsconfig.json',
      // Tell eslint how to lint this file
      // with an extra config (./tsconfig.eslint.json)
      // which includes this file specifically
      // see https://stackoverflow.com/questions/61956555/why-is-typescript-eslint-parser-including-files-outside-of-those-configured-in
      './tsconfig.eslint.json',
    ],
  },
  ignorePatterns: ['node_modules/', 'dist/'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
