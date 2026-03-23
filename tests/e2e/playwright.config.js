const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: 'http://localhost:4000',
        headless: true
    },
    webServer: {
        command: 'cd ../../backend && npm start',
        port: 4000,
        timeout: 30000,
        reuseExistingServer: true,
        env: {
            JWT_SECRET: 'test-secret-at-least-32-characters-long-enough',
            NODE_ENV: 'test',
            DB_CLIENT: 'sqlite'
        }
    }
});
