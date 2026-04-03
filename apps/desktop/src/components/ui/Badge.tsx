import React, { type ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

const VARIANT_COLOR: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: 'var(--card-alt)',    color: 'var(--text-muted)' },
  success: { bg: 'var(--success-bg)',  color: 'var(--success-text)' },
  warning: { bg: 'var(--warning-bg)',  color: 'var(--warning-text)' },
  error:   { bg: 'var(--error-bg)',    color: 'var(--error-text)' },
  info:    { bg: 'var(--info-bg)',     color: 'var(--info)' },
};

const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  sm: { fontSize: 'var(--font-size-micro)', padding: '2px 6px', borderRadius: 'var(--radius-xs)' },
  md: { fontSize: 'var(--font-size-caption)', padding: '4px 8px', borderRadius: 'var(--radius-xs)' },
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
        gap: 3,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        background: bg,
        color,
        ...SIZE_STYLES[size],
      }}
    >
      {children}
    </span>
  );
});
