module.exports = {
    'env': {
        'es2017': true,
        'node': true,
    },
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly',
    },
    'parserOptions': {
        'ecmaVersion': 2018,
        'sourceType': 'module',
        "project": './tsconfig.json'
    },
    "parser": '@typescript-eslint/parser',
    "plugins": [
        '@typescript-eslint',
        'prettier'
    ],
    "extends": [
        'eslint:recommended',
        'google',
        'plugin:@typescript-eslint/recommended',
        "prettier/@typescript-eslint",
        "plugin:prettier/recommended"
    ],
    'rules': {
        "prettier/prettier": ["error", {
            "singleQuote": true,
            "printWidth" : 120
        }],
        'prefer-spread': 'off',
        'require-jsdoc': 'off',
        "no-prototype-builtins": "off",
        'new-cap': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        "@typescript-eslint/interface-name-prefix": ["error", {
            "prefixWithI": "always"
        }],
        "@typescript-eslint/explicit-member-accessibility": ["error",
            {
                accessibility: 'explicit',
                overrides: {
                    accessors: 'explicit',
                    constructors: 'no-public',
                    methods: 'explicit',
                    properties: 'explicit',
                    parameterProperties: 'explicit'
                }
            }
        ],
        "@typescript-eslint/explicit-function-return-type": ["error", {
            allowExpressions: true
        }],
        "camelcase": "off",
        "@typescript-eslint/camelcase": ["error", { "properties": "always" }],     
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/no-misused-promises": [
            "error",
            {
                "checksVoidReturn": false
            }
        ],
        "@typescript-eslint/no-unused-vars": ["error", {
            args: "none"
        }],
        "@typescript-eslint/promise-function-async": "off",
        "@typescript-eslint/prefer-includes": "error",
        "@typescript-eslint/prefer-readonly": "error",
        "@typescript-eslint/prefer-string-starts-ends-with": "error",
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/no-this-alias": [
            "error",
            {
                "allowDestructuring": true, // Allow `const { props, state } = this`; false by default
                "allowedNames": ["self"], // Allow `const self = this`; `[]` by default
            },
        ],
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-var-requires": "error",
        "no-else-return": ["error", {
            allowElseIf: true
        }],
        "max-nested-callbacks": ["error"],
        "complexity": ["error"],
        "default-case": ["error"],
        "eqeqeq": ["error"],
        "no-else-return": ["error", {
            allowElseIf: true
        }],
        "no-floating-decimal": ["error"],
        "no-unmodified-loop-condition": ["error"],
        "@typescript-eslint/member-naming": ["error", { "private": "^_", "public": "^[a-z]" }]
    },
};