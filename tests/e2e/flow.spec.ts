import { test, expect } from '@playwright/test';
test('new account → plan review → check-in → execute → adapt → persisted session', async ({
  page,
}) => {
  const email = `demo-${Date.now()}@example.test`,
    password = 'TestPassword42!';
  await page.goto('/signin?mode=signup');
  await page.getByLabel('Your name').fill('Alex');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your account' }).click();
  await expect(page).toHaveURL(/goals\/new/);
  await page.getByRole('button', { name: 'Try the portfolio demo' }).click();
  await page.getByRole('button', { name: 'Review my goal' }).click();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(page.getByText('Make this plan your own')).toBeVisible();
  const goalUrl = page.url();
  await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
  await page.getByLabel('Phase 1 title').fill('Set the direction');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set the direction' })).toBeVisible();
  await page.getByRole('button', { name: 'Accept & start' }).click();
  await page.getByRole('link', { name: 'Find my next step', exact: true }).click();
  await page.getByRole('button', { name: 'Find my next step', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Write your About section draft' })).toBeVisible();
  await expect(page.getByText('Why this, right now?')).toBeVisible();
  await page.screenshot({ path: 'test-results/today-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Let’s do this' }).click();
  await expect(page.getByRole('heading', { name: 'Just this one thing.' })).toBeVisible();
  await page.getByLabel('Time spent (optional)').fill('20');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('A little closer. Your progress is saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Find another step' }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose the projects you want to share' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Already done' }).click();
  await page.getByRole('button', { name: '2 hours', exact: true }).click();
  await page.getByRole('button', { name: 'high Ready to dive in' }).click();
  await page.getByRole('button', { name: 'Find my next step', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Implement the portfolio project section' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByLabel('Reason', { exact: true }).selectOption('Missing something');
  await page.getByRole('button', { name: 'Skip this step', exact: true }).click();
  await page.goto(goalUrl);
  await page.getByLabel('What needs to change?').fill('I need to sketch the project cards first.');
  await page.getByRole('button', { name: 'Suggest an adjustment' }).click();
  await expect(
    page.getByText('Create a rough project-card wireframe', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Accept adjustment' }).click();
  await expect(
    page.getByRole('button', { name: /Create a rough project-card wireframe/ }).first(),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Find my next step', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Create a rough project-card wireframe' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Postpone', exact: true }).click();
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click();
  await expect(
    page.getByText('Saved for later. Let’s find something that fits now.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/signin/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/today/);
  await page.goto(goalUrl);
  await expect(page.getByText('2 of 6 steps completed')).toBeVisible();
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A good day for a small step.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A good day for a small step.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find my next step', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/today-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('private pages and API reject anonymous requests', async ({ page, request }) => {
  await page.goto('/goals');
  await expect(page).toHaveURL(/signin/);
  const response = await request.get('/api/workspace');
  expect(response.status()).toBe(401);
});
