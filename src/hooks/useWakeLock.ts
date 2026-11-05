import { useEffect } from 'react';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

/**
 * Keeps the screen (and so the laptop) awake while `active` is true, like a playing video does,
 * using the Screen Wake Lock API. The browser drops the lock when the tab is hidden and the system
 * can revoke it (e.g. battery saver), so it is requested again whenever the tab is visible and the
 * lock is gone. Unsupported browsers or a refused request are ignored.
 */
export const useWakeLock = (active: boolean) => {
  useEffect(() => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!active || !wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    let pending = false;

    const acquire = async () => {
      if (cancelled || pending || sentinel || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const lock = await wakeLock.request('screen');
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        // Revoked by the system or browser: forget it and ask again
        lock.addEventListener?.('release', () => {
          if (sentinel === lock) sentinel = null;
          if (!cancelled) void acquire();
        });
      } catch {
        /* denied (e.g. low battery); nothing to do */
      } finally {
        pending = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
};
