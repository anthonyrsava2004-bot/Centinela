import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 700,
  decimals = 0,
  prefix = '',
  suffix = '',
  locale = 'es-PE',
  className,
}) => {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return safeTarget;
    }
    return 0;
  });

  const currentValueRef = useRef<number>(displayValue);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || duration <= 0) {
      currentValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const startValue = currentValueRef.current;
    const delta = safeTarget - startValue;

    if (delta === 0) {
      setDisplayValue(safeTarget);
      return;
    }

    let rafId = 0;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startValue + delta * eased;
      currentValueRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        currentValueRef.current = safeTarget;
        setDisplayValue(safeTarget);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [safeTarget, duration]);

  const formatted = displayValue.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className ? `tabular-nums ${className}` : 'tabular-nums'}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
