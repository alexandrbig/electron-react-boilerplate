import type { ElectronApplication, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { Menu } from 'electron';
import { clickMenuItem, getElectronApp, mockedDialog } from './utils';

let electronApp: ElectronApplication;
let appWindow: Page;
let menu: Menu | null = null;

/* eslint no-empty-pattern: "off" */

test.beforeAll(async ({}, testInfo) => {
  electronApp = await getElectronApp(testInfo);
  appWindow = await electronApp.firstWindow({ timeout: 1000 });
  menu = await electronApp.evaluate(async ({ Menu }) => {
    return Menu.getApplicationMenu();
  });
});

test.afterAll(async ({}, testInfo) => {
  await appWindow.screenshot({
    path: testInfo.outputPath(`intro-${electronApp.windows().length}.png`),
  });
  await electronApp.close();
});

test.describe('Main menu', () => {
  test('There is a Test menu top element', () => {
    const testMenu = menu?.items.find(({ label }) => label === 'Test Menu');
    expect(testMenu).toBeDefined();
  });

  test('test menu click', async () => {
    const { dialogOptions, dialogControlHandler } = await mockedDialog(
      electronApp,
      { method: 'showMessageBox' },
    );
    const { dialogOptions: secondDialogOptions } = await mockedDialog(
      electronApp,
      {
        method: 'showMessageBoxSync',
        value: 1,
      },
    );
    await clickMenuItem(electronApp, 'test');

    const { title: firstDialogTitle, message } = await dialogOptions;

    expect(firstDialogTitle).toEqual('Async dialog');
    expect(message).toEqual('Async dialog test');

    await dialogControlHandler.evaluate(({ resolve }) =>
      resolve({ response: 0, checkboxChecked: false }),
    );
    const { title } = await secondDialogOptions;

    expect(title).toBe('OK');
  });
});
