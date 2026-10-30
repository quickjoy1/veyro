/** Opens a small floating window that holds ONE timer (always-on-top Document Picture-in-Picture when free, otherwise a normal pop-up). */

export type FloatKind = "pip" | "popup";

export interface FloatHandle {
  win: Window;
  /** Element in the floating window the timer should be moved into. */
  host: HTMLElement;
  kind: FloatKind;
  dispose: () => void;
}

type DocumentPipApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

export const getDocumentPip = (): DocumentPipApi | null =>
  typeof window !== "undefined"
    ? (window as unknown as { documentPictureInPicture?: DocumentPipApi }).documentPictureInPicture ?? null
    : null;

const SIZE = { width: 380, height: 360 };

const copyStyles = (win: Window) => {
  document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
    if (node instanceof HTMLLinkElement) {
      const link = win.document.createElement("link");
      link.rel = "stylesheet";
      link.href = node.href;
      win.document.head.appendChild(link);
    } else if (node instanceof HTMLStyleElement) {
      const style = win.document.createElement("style");
      style.textContent = node.textContent;
      win.document.head.appendChild(style);
    }
  });
};

export async function openFloatWindow(opts: {
  id: string;
  label: string;
  /** Document Picture-in-Picture allows one window at a time, so only the first timer gets it. */
  preferDocPip: boolean;
}): Promise<FloatHandle | null> {
  let win: Window | null = null;
  let kind: FloatKind = "popup";

  const dpip = getDocumentPip();
  if (dpip && opts.preferDocPip) {
    try {
      win = await dpip.requestWindow(SIZE);
      kind = "pip";
    } catch {
      win = null; // fall through to a normal pop-up
    }
  }
  if (!win) {
    win = window.open("", `veyro-timer-${opts.id}`, `popup=yes,width=${SIZE.width},height=${SIZE.height}`);
    if (!win) return null;
    win.document.open();
    win.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    win.document.close();
  }

  copyStyles(win);

  // Mirror theme classes/variables (dark/light, accent colour) and keep them in sync
  const syncTheme = () => {
    win!.document.documentElement.className = document.documentElement.className;
    win!.document.documentElement.style.cssText = document.documentElement.style.cssText;
    win!.document.documentElement.style.setProperty("background", "#000");
  };
  syncTheme();
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

  win.document.title = `Veyro - ${opts.label}`;
  win.document.body.className = "pip-body pip-single";

  const stack = win.document.createElement("div");
  stack.className = "pip-timer-stack";
  const slot = win.document.createElement("div");
  slot.className = "pip-timer-slot";
  const label = win.document.createElement("div");
  label.className = `pip-slot-label pip-slot-label-${opts.id}`;
  label.textContent = opts.label;
  const host = win.document.createElement("div");
  host.className = "pip-slot-host";
  slot.append(label, host);
  stack.appendChild(slot);
  win.document.body.appendChild(stack);

  return { win, host, kind, dispose: () => themeObserver.disconnect() };
}
