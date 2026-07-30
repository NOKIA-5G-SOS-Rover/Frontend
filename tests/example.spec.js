import { test, expect } from '@playwright/test';

const mockPastAlerts = [
  {
    id: 'e2e-alert-1',
    sourceId: 'e2e-alert-1',
    title: 'Person detected',
    description: 'A person was detected near the rover.',
    severity: 'critical',
    confidence: 96,
    location: 'Zone A',
    timestamp: '2026-07-30T08:00:00.000Z',
    status: 'unverified',
    imageUrl: '/detections/person-detected.svg',
  },
];

test.beforeEach(async ({ page }) => {
  // Mock the backend Past Alerts endpoint.
  await page.route(/\/events(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPastAlerts),
    });
  });

  await page.goto('http://localhost:3000');
});

test.describe('Home View', () => {
  test('should render widgets and interact with the calendar', async ({
    page,
  }) => {
    await expect(page.getByText('Past Alerts Stats')).toBeVisible();

    const calendarDays = page.locator(
      '.calendar-day:not(.empty):not(.disabled)'
    );

    await expect(calendarDays.first()).toBeVisible();

    await calendarDays.first().click();

    await expect(calendarDays.first()).toHaveClass(/interval-start/);
  });
});

test.describe('Past Alerts View', () => {
  test('should open and close the event detail side panel', async ({
    page,
  }) => {
    await page
      .locator('button, a')
      .filter({ hasText: /^Past Alerts$/i })
      .first()
      .click();

    const firstAlert = page.locator('.alert-item').first();

    await expect(firstAlert).toBeVisible({
      timeout: 10_000,
    });

    await firstAlert.click();

    const detailPanel = page.getByRole('complementary', {
      name: 'Selected alert details',
    });

    await expect(detailPanel).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Close event details',
      })
      .click();

    await expect(detailPanel).not.toBeVisible();
  });
});