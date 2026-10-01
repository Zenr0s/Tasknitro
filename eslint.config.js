const js = require('@eslint/js');

module.exports = [
  { ignores: ['node_modules/**', 'data/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { process: 'readonly', Buffer: 'readonly', __dirname: 'readonly', console: 'readonly', module: 'readonly', require: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', fetch: 'readonly', URL: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: { document: 'readonly', fetch: 'readonly', FormData: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } }
  }
];
