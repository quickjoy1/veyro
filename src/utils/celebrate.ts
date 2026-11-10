const COLORS = ['var(--accent-primary)', '#00FF41', '#00BFFF', '#FFB800', '#FF3D81'];
const COUNT = 12;

/**
 * Pops a burst of sparks at a screen position. The sparks live on <body>, so they keep playing
 * even though the completed task card is removed from the board a moment later.
 */
export function celebrateAt(x: number, y: number): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;z-index:100000;`;

  const ring = document.createElement('span');
  ring.className = 'ring-burst';
  root.appendChild(ring);

  for (let i = 0; i < COUNT; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'spark';
    spark.style.setProperty('--a', `${(360 / COUNT) * i + (i % 2 ? 8 : 0)}deg`);
    spark.style.setProperty('--d', `${i % 2 === 0 ? 56 : 38}px`);
    spark.style.setProperty('--spark', COLORS[i % COLORS.length] ?? COLORS[0]!);
    root.appendChild(spark);
  }

  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), 900);
}
