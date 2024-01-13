/* eslint-disable no-undef */

module.exports = {
  root: true,
  env:  {
    browser: true,
    es2020:  true,
  },
  extends: [
    'eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist'],
  parser:         '@typescript-eslint/parser',
  plugins:        ['react-refresh'],
  rules:          {
    'arrow-spacing': ['error', {
      before: true,
      after:  true,
    }],
    'array-bracket-newline': ['error', 'consistent'],
    'array-element-newline': ['error', 'consistent'],
    'comma-dangle':          ['error', 'always-multiline'],
    'comma-spacing':         ['error', { before: false, after: true }],
    // 'curly':                 ['error', 'multi', 'consistent'],
    'indent':                ['error', 2],
    'object-curly-spacing':  ['error', 'always'],
    'object-curly-newline':  ['error', { multiline: true, consistent: true }],
    // 'object-property-newline': ['error'],
    'key-spacing':           [
      'error',
      {
        beforeColon: false,
        afterColon:  true,
        mode:        'strict',
        align:       'value',
      },
    ],
    'keyword-spacing':                      ['error', { before: true, after: true }],
    'max-len':                              ['error', 120],
    'no-multiple-empty-lines':              ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
    'quotes':                               ['error', 'single'],
    'quote-props':                          ['error', 'consistent-as-needed'],
    'semi':                                 ['error', 'always'],
    'space-infix-ops':                      ['error', { int32Hint: true }],
    '@typescript-eslint/semi':              ['error', 'always'],
  },
};
