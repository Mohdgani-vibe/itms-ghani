import { useEffect, useRef, useState, type ReactNode } from 'react';

interface AlertsMeasuredChartProps {
  height: number;
  minWidth?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}

export function AlertsMeasuredChart({ height, minWidth = 240, children }: AlertsMeasuredChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(element.clientWidth, minWidth);
      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, [minWidth]);

  return (
    <div ref={containerRef} className="h-full w-full min-w-0" style={{ height, minWidth }}>
      {width > 0 ? children({ width, height }) : <div className="h-full w-full" aria-hidden="true" />}
    </div>
  );
}