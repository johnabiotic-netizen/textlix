import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/**
 * Tween-animates a number from 0 → value when it mounts (or when value changes).
 * Use `decimals` for fractional values (e.g. avg delivery seconds).
 * Use `format` for custom formatting (e.g. toLocaleString for thousands sep).
 */
export default function AnimatedNumber({
  value,
  duration = 1.4,
  decimals = 0,
  format,
  suffix = '',
  prefix = '',
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // We want to re-run when the value itself changes
  }, [value, duration]);

  let text;
  if (format) {
    text = format(display);
  } else if (decimals > 0) {
    text = display.toFixed(decimals);
  } else {
    text = Math.round(display).toLocaleString();
  }

  return <span>{prefix}{text}{suffix}</span>;
}
