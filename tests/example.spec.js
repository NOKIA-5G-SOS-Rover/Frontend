import { test, expect } from '@playwright/test';

// Before each test, navigate to the app. 
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');
});

test.describe('Cameras View', () => {
  test('should toggle manual mode and register keyboard inputs', async ({ page }) => {
    // Navigate to Cameras view
    await page.click('text=Cameras');

    const modeSwitch = page.locator('#mode-toggle');
    const upButton = page.locator('#dir-up');

    // 1. Check default state
    await expect(modeSwitch).toContainText('Auto');

    // 2. Toggle to Manual mode
    await modeSwitch.click();
    await expect(modeSwitch).toContainText('Manual');

    // 3. Test keyboard binding (Pressing 'W' should activate the 'Up' button)
    await page.keyboard.down('w');
    await expect(upButton).toHaveClass(/active/);
    await page.keyboard.up('w');
    await expect(upButton).not.toHaveClass(/active/);
  });

  test('should adjust speed using buttons and input', async ({ page }) => {
    // Navigate to Cameras view first
    await page.click('text=Cameras');

    const speedInput = page.locator('#speed-value');
    const speedUpBtn = page.locator('#speed-up');

    // Default speed is 74
    await expect(speedInput).toHaveValue('74');

    // Click speed up (+25)
    await speedUpBtn.click();
    await expect(speedInput).toHaveValue('99');

    // Type a custom speed
    await speedInput.fill('150');
    await expect(speedInput).toHaveValue('150');
  });
});

test.describe('Home View', () => {
  test('should render widgets and interact with the calendar', async ({ page }) => {
    // 1. Verify widgets are visible
    await expect(page.locator('text=Past Alerts Stats')).toBeVisible();
    
    // 2. Click a valid calendar day to set an interval start
    const calendarDays = page.locator('.calendar-day:not(.empty):not(.disabled)');
    if (await calendarDays.count() > 0) {
      await calendarDays.first().click();
      await expect(calendarDays.first()).toHaveClass(/interval-start/);
    }
  });

  test('should toggle the specs section', async ({ page }) => {
    const specsSection = page.locator('#specs');
    const togglePrompt = page.locator('.scroll-prompt');

    // Initially hidden
    await expect(specsSection).toHaveClass(/hidden-specs/);

    // Click to view specs
    await togglePrompt.click();
    await expect(specsSection).toHaveClass(/visible-specs/);
  });
});

test.describe('Past Alerts View', () => {
  test('should open filter dropdown and filter options', async ({ page }) => {
    // Navigate to Past Alerts view
    await page.click('text=Past Alerts');

    const filterBtn = page.locator('.filter-btn');
    const filterDropdown = page.locator('.filter-dropdown');

    // Initially hidden
    await expect(filterDropdown).toHaveClass(/hidden/);

    // Click to open
    await filterBtn.click();
    await expect(filterDropdown).not.toHaveClass(/hidden/);

    // Check a filter box
    const confidenceCheckbox = page.locator('input[value="confidence"]');
    await confidenceCheckbox.check();
    await expect(confidenceCheckbox).toBeChecked();
  });

  test('should open and close the event detail side panel', async ({ page }) => {
    // Navigate to Past Alerts view
    await page.click('text=Past Alerts');

    // Wait for the alerts list to load
    const alertItems = page.locator('.alert-item');
    
    // If there are alerts, test clicking one
    if (await alertItems.count() > 0) {
      await alertItems.first().click();
      
      // Panel should appear
      const detailPanel = page.locator('.event-detail-panel');
      await expect(detailPanel).toBeVisible();

      // Close panel
      await page.locator('.close-detail-btn').click();
      await expect(detailPanel).not.toBeVisible();
    }
  });
});