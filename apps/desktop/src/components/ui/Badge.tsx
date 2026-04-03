import React, { type ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

const VARIANT_COLOR: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: 'var(--border)',         color: 'var(--text-secondary)' },
  success: { bg: 'rgba(52,168,83,0.15)',  color: '#34a853' },
  warning: { bg: 'rgba(251,188,5,0.15)',  color: '#c49800' },
  error:   { bg: 'rgba(234,67,53,0.15)',  color: '#ea4335' },
  info:    { bg: 'rgba(66,133,244,0.15)', color: '#4285f4' },
};

const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  sm: { fontSize: 10, padding: '2px 6px', borderRadius: 8 },
  md: { fontSize: 12, padding: '3px 8px', borderRadius: 10 },
};

export const Badge = React.memo(function Badge({
  variant = 'default',
  size = 'md',
  children,
}: BadgeProps) {
  const { bg, color } = VARIANT_COLOR[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        lineHeight: 1.2,
        background: bg,
        color,
        ...SIZE_STYLES[size],
      }}
    >
      {children}
    </span>
  );
});
