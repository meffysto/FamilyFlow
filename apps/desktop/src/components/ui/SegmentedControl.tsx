import { useRef, useLayoutEffect, useState } from 'react';

interface SegmentOption {
  label: string;
  value: string;
  badge?: number;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const buttons = track.querySelectorAll<HTMLButtonElement>('[data-segment]');
    const btn = buttons[activeIndex];
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activeIndex, options]);

  return (
    <div
      ref={trackRef}
      role="tablist"
      style={{
        position: 'relative',
        display: 'inline-flex',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 3,
        gap: 0,
      }}
    >
      {/* Sliding indicator */}
      {indicator && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            left: indicator.left,
            width: indicator.width,
            height: 'calc(100% - 6px)',
            background: 'var(--accent)',
            borderRadius: 6,
            transition: 'left 200ms ease, width 200ms ease',
          }}
        />
      )}

      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            data-segment
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              background: 'none',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'white' : 'var(--text-secondary)',
              fontFamily: 'inherit',
              transition: 'color 150ms ease',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              zIndex: 1,
            }}
          >
            {option.label}
            {option.badge !== undefined && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
