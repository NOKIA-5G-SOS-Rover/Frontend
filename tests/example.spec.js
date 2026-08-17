import { test, expect } from '@playwright/test';

const mockPastAlerts = [
  {
    id: 'e2e-alert-1',
    sourceId: 'e2e-alert-1',
    alertType: 'Person detected',
    title: 'Person detected',
    source: 'Camera 1',
    description: 'A person was detected near the rover.',
    severity: 'critical',
    confidenceScore: 96,
    locationX: 10,
    locationY: 20,
    location: 'Zone A',
    timestamp: '2026-07-30T08:00:00.000Z',
    status: 'unverified',
    imageUrl: '/detections/person-detected.svg',
  },
];

test.beforeEach(async ({ page }) => {
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
  await page.getByPlaceholder(/enter user/i).fill('operator');
  await page.getByPlaceholder(/enter password/i).fill('sanzi2026');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
});

test.describe('Home View', () => {
  test('should render widgets and interact with the calendar', async ({
    page,
  }) => {
    await expect(page.getByText(/Past alerts stats/i)).toBeVisible();

    const calendarDays = page.locator(
      '.calendar-day:not(.empty):not(.disabled)'
    );

    await expect(calendarDays.first()).toBeVisible();

    await calendarDays.first().click();

    await expect(calendarDays.first()).toHaveClass(/interval-start/);
  });
});

test.describe('Past Alerts View', () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator('button, a')
      .filter({ hasText: /^Past Alerts$/i })
      .first()
      .click();

    await expect(
      page.getByRole('heading', {
        name: /Past alerts/i,
      })
    ).toBeVisible();
  });

  test('should open and close the event detail side panel', async ({
    page,
  }) => {
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

  test('should filter alerts by confidence range', async ({ page }) => {
    const filterButton = page.getByRole('button', {
      name: /Filter archive/i,
    });

    const filterDropdown = page.locator('#past-alert-filters');

    await expect(filterButton).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    await expect(filterDropdown).toHaveClass(/hidden/);

    await filterButton.click();

    await expect(filterButton).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await expect(filterDropdown).not.toHaveClass(/hidden/);

    const confidenceSelect = page.getByRole('combobox', {
      name: 'Filter alerts by confidence range',
    });

    const mockedAlert = page.locator('#past-alert-e2e-alert-1');

    await confidenceSelect.selectOption('high');

    await expect(confidenceSelect).toHaveValue('high');
    await expect(mockedAlert).toBeVisible();

    await confidenceSelect.selectOption('low');

    await expect(confidenceSelect).toHaveValue('low');
    await expect(mockedAlert).not.toBeVisible();
  });
});

test.describe('Cameras View', () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator('button, a')
      .filter({ hasText: /^Cameras$/i })
      .first()
      .click();

    await expect(page.locator('#camera-console-title')).toBeVisible();
  });

  test('should switch between automatic and manual mode', async ({
    page,
  }) => {
    const autoButton = page.locator('#mode-auto');
    const manualButton = page.locator('#mode-manual');
    const manualControls = page.locator('#manual-controls');

    // Do not assume which mode is active when the page opens.
    await manualButton.click();

    await expect(manualButton).toHaveClass(/active/);
    await expect(autoButton).not.toHaveClass(/active/);
    await expect(manualControls).toBeVisible();

    await autoButton.click();

    await expect(autoButton).toHaveClass(/active/);
    await expect(manualButton).not.toHaveClass(/active/);
  });

  test('should increase and manually change rover speed', async ({
    page,
  }) => {
    await page.locator('#mode-manual').click();

    const speedValueButton = page.locator('#speed-value');
    const speedUpButton = page.locator('#speed-up');

    await expect(speedValueButton).toBeVisible();
    await expect(speedUpButton).toBeEnabled();

    const initialText = await speedValueButton.textContent();
    const initialSpeed = Number(initialText?.replace(/\D/g, ''));

    await speedUpButton.click();

    const expectedSpeed = Math.min(initialSpeed + 10, 100);

    await expect(speedValueButton).toContainText(
      String(expectedSpeed)
    );

    await speedValueButton.dblclick();

    const speedInput = page.locator('#speed-value-input');

    await expect(speedInput).toBeVisible();
    await expect(speedInput).toBeEnabled();

    await speedInput.fill('42');
    await expect(speedInput).toHaveValue('42');

    await speedInput.press('Enter');

    await expect(speedInput).not.toBeVisible();
    await expect(speedValueButton).toContainText('42');
  });
});