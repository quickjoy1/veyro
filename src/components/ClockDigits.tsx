import { useRef, useState } from "react";

/**
 * Big clock digits for the full-screen clock and floating windows.
 * Markup, classes and animation copied from studiestimer.com (.td-*): only the digit that changes moves.
 * The old glyph drops out (.td-exit) while the new one drops in (.td-enter); the colon is dimmed and blinks while running.
 */
const Cell = ({ ch }: { ch: string }) => {
  const prev = useRef(ch);
  const [exit, setExit] = useState<string | null>(null);
  if (prev.current !== ch) {
    setExit(prev.current);
    prev.current = ch;
  }
  return (
    <span className="td-cell">
      {exit !== null && (
        <span key={`x${exit}${ch}`} className="td-glyph td-exit" onAnimationEnd={() => setExit(null)}>{exit}</span>
      )}
      <span key={ch} className="td-glyph td-enter">{ch}</span>
    </span>
  );
};

interface Props {
  /** "05:30" or "01:05:30" */
  text: string;
  state: "running" | "paused" | "idle";
  caption?: string;
}

const ClockDigits = ({ text, state, caption }: Props) => (
  <div className="clock-only td-wrap" data-state={state}>
    <div className="td-group" aria-hidden="true">
      <span className="inline-flex items-baseline">
        {text.split("").map((c, i) =>
          c === ":" ? (
            <span key={i} className={`td-colon ${state === "running" ? "td-colon-running" : ""}`}>:</span>
          ) : (
            <Cell key={i} ch={c} />
          )
        )}
      </span>
    </div>
    {caption ? <div className="td-caption">{caption}</div> : null}
    {state !== "idle" && (
      <div className="td-pill">
        {state === "running" ? (
          <span className="live-dot" />
        ) : (
          <span className="inline-block h-1.5 w-1.5 rounded-full border-[1.5px] border-current opacity-60" />
        )}
        {state === "running" ? "In progress" : "Paused"}
      </div>
    )}
  </div>
);

export const formatClock = (totalSeconds: number) => {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};

export default ClockDigits;
