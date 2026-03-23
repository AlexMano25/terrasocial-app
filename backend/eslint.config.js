module.exports = [
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly'
            }
        },
        rules: {
            'no-eval': 'error',
            'no-implied-eval': 'error',
            eqeqeq: ['error', 'smart'],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|next|error|err' }],
            'no-var': 'warn',
            'prefer-const': 'warn'
        }
    }
];
