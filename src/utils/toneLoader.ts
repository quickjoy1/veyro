import type * as ToneNamespace from 'tone';

/**
 * Tone.js (with its audio-context shim) is large and only needed once the user starts a sound,
 * so it is loaded on demand instead of being part of the first download. `T` is a live binding:
 * it is assigned by loadTone(), and every code path that touches it awaits loadTone() first.
 */
// eslint-disable-next-line import/no-mutable-exports
export let T: typeof ToneNamespace;

let pending: Promise<typeof ToneNamespace> | null = null;

export function loadTone(): Promise<typeof ToneNamespace> {
  if (T) return Promise.resolve(T);
  pending ??= import('tone').then((mod) => {
    T = mod;
    return mod;
  });
  return pending;
}
