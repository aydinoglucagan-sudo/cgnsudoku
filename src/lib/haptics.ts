/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const haptics = {
  vibrate: (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(pattern);
      } catch (e) {
        // Silently fail if blocked or not supported
      }
    }
  },

  place: () => haptics.vibrate(10),
  clear: () => haptics.vibrate(5),
  hint: () => haptics.vibrate([20, 30, 20]),
  success: () => haptics.vibrate([50, 30, 50, 30, 100]),
  error: () => haptics.vibrate([30, 50, 30, 50, 30]),
};
