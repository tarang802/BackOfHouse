"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/client-values";

/** Animates from 0 to `value`; shows the final value immediately with reduced motion. */
export function CountUp({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce || value === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduce]);

  const shown = reduce ? value : display;
  return <span className="tabular">{format ? format(shown) : shown}</span>;
}
