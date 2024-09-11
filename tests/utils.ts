import type { ElectronApplication, JSHandle, TestInfo } from '@playwright/test';
import type { Dialog, MenuItem } from 'electron';
import { _electron as electron } from 'playwright-core';

/* eslint no-return-await: "off" */

type DialogValue<T extends keyof Dialog> = ReturnType<
  Dialog[T]
> extends PromiseLike<any>
  ? Awaited<Promise<ReturnType<Dialog[T]>>>
  : ReturnType<Dialog[T]>;
type MockedDialogOptions<T extends keyof Dialog> = {
  method: T;
  value?: DialogValue<T>;
};

type DialogControlHandler<T extends keyof Dialog> = {
  promise: Promise<ReturnType<Dialog[T]>>;
  resolve: (value: DialogValue<T>) => void;
};

type DialogParameters<T extends keyof Dialog> = Parameters<Dialog[T]>[0];

/**
 * Mocks electron dialog
 * @param electronApp
 * @param mockedOptions object {method: keyof Dialog}
 * @return object {
 *     dialogOptions: Promise<Parameters<Dialog[T]>> dialog options object like `type`, `title`, etc.
 *     dialogControlHandler: JSHandle<Dialog[T]>
 * }
 */
export async function mockedDialog<T extends keyof Dialog>(
  electronApp: ElectronApplication,
  mockedOptions: MockedDialogOptions<T>,
) {
  const dialogControlHandler = await electronApp.evaluateHandle<
    DialogControlHandler<T>
  >(() => {
    let dialogResolve: (value: DialogValue<T>) => void = (
      value: DialogValue<T>,
    ) => value;

    const promise = new Promise<ReturnType<Dialog[T]>>((resolve) => {
      dialogResolve = resolve;
    });

    return { promise, resolve: dialogResolve };
  });

  const dialogOptions = electronApp.evaluate<
    Promise<DialogParameters<T>>,
    {
      options: MockedDialogOptions<T>;
      dialogControlHandler: JSHandle<DialogControlHandler<T>>;
    }
  >(
    ({ dialog }, { options, dialogControlHandler: dialogControl }) => {
      if (!dialog[options.method]) {
        throw new Error(`can't find ${options.method} on dialog module.`);
      }
      let dialogOptionsResolver: (value: DialogParameters<T>) => void;
      const dialogOptionsPromise = new Promise<DialogParameters<T>>(
        (resolve) => {
          dialogOptionsResolver = resolve;
        },
      );

      // @ts-ignore
      dialog[options.method] = function () {
        // eslint-disable-next-line prefer-rest-params
        let dialogOptionsObject: DialogParameters<T> = arguments[0];
        if (arguments.length === 2) {
          // eslint-disable-next-line prefer-rest-params,prefer-destructuring
          dialogOptionsObject = arguments[1];
        }
        dialogOptionsResolver(dialogOptionsObject);

        if (!options.method.endsWith('Sync') && options.value) {
          dialogControl.resolve(options.value as DialogValue<T>);
        }

        return options.method.endsWith('Sync')
          ? options.value
          : dialogControl.promise;
      };

      return dialogOptionsPromise;
    },
    { options: mockedOptions, dialogControlHandler },
  );

  return { dialogOptions, dialogControlHandler };
}

export async function pause(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function getElectronApp(testInfo: TestInfo) {
  return await electron.launch({
    args: ['release/app/dist/main/main.js'],
    /* recordVideo: {
      dir: testInfo.outputPath('video'),
      size: {
        width: 1200,
        height: 800,
      },
    }, */
  });
}

export async function getMenuItem(
  electronApp: ElectronApplication,
  menuId: string,
): Promise<MenuItem | null> {
  return await electronApp.evaluate(async ({ Menu }, id) => {
    return Menu.getApplicationMenu()!.getMenuItemById(id);
  }, menuId);
}

export async function clickMenuItem(
  electronApp: ElectronApplication,
  menuId: string,
): Promise<MenuItem | null> {
  return await electronApp.evaluate(async ({ Menu }, id) => {
    return Menu.getApplicationMenu()!.getMenuItemById(id)?.click();
  }, menuId);
}
