const { test, expect } = require('@playwright/test');

test.describe('Page loading', () => {
    test('index.html loads and contains TERRASOCIAL title', async ({ page }) => {
        await page.goto('/');
        const title = await page.title();
        expect(title.toUpperCase()).toContain('TERRASOCIAL');
    });

    test('login.html loads and shows the login form', async ({ page }) => {
        await page.goto('/login.html');

        // Page should load without errors
        expect(page.url()).toContain('login');

        // Look for a form or login-related elements
        const form = page.locator('form');
        const formCount = await form.count();

        // There should be at least one form or login input on the page
        if (formCount > 0) {
            await expect(form.first()).toBeVisible();
        } else {
            // Fallback: check for password input or login button
            const passwordInput = page.locator('input[type="password"]');
            await expect(passwordInput.first()).toBeVisible();
        }
    });

    test('dashboard-client.html without auth redirects to login', async ({ page }) => {
        await page.goto('/dashboard-client.html');

        // The page should redirect to login or show a login prompt
        // Wait for potential redirect
        await page.waitForTimeout(2000);

        const url = page.url();
        // Either redirected to login page or still on dashboard but with login modal
        const redirectedToLogin = url.includes('login');
        const hasLoginPrompt = await page.locator('input[type="password"]').count() > 0;

        expect(redirectedToLogin || hasLoginPrompt).toBe(true);
    });
});

test.describe('API health', () => {
    test('GET /api/health responds with 200 and status ok', async ({ request }) => {
        const response = await request.get('/api/health');

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('status', 'ok');
        expect(body).toHaveProperty('timestamp');
        expect(body).toHaveProperty('db_client');
    });
});
