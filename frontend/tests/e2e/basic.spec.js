import { test, expect } from '@playwright/test';

test('abre la app', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page).toHaveTitle(/Sis Bicicletería Frontend/);
});