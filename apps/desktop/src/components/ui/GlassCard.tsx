import { useState, useRef, useEffect, type ReactNode } from 'react';

interface GlassCardProps {
  title?: string;
  icon?: string;
  count?: number;
  accentColor?: string;
  tinted?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  linkText?: string;
  onLinkClick?: () => void;
  children: ReactNode;
}

export function GlassCard({
  title,
  icon,
  count,
  accentColor,
  tinted = false,
  collapsed = false,
  onToggle,
  linkText = 'Voir tout →',
  onLinkClick,
  children,
}: GlassCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState<number | undefined>(undefined);
  const isCollapsible = onToggle !== undefined;

  useEffect(() => {
    if (!bodyRef.current) return;
    if (!collapsed) {
      setBodyHeight(bodyRef.current.scrollHeight);
    } else {
      setBodyHeight(0);
    }
  }, [collapsed, children]);

  const hasHeader = title || icon || count !== undefined || onLinkClick;

  return (
    <div
      style={{
        background: tinted && accentColor
          ? `color-mix(in srgb, ${accentColor} 6%, var(--bg-secondary))`
          : 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: collapsed ? 'none' : '1px solid var(--border)',
            gap: 8,
            cursor: isCollapsible ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          onClick={isCollapsible ? onToggle : undefined}
        >
          {icon && (
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
          )}

          {title && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                flex: 1,
              }}
            >
              {title}
            </span>
          )}

          {count !== undefined && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'white',
                background: accentColor ?? 'var(--accent)',
                borderRadius: 10,
                padding: '2px 7px',
                lineHeight: 1.4,
              }}
            >
              {count}
            </span>
          )}

          {onLinkClick && !isCollapsible && (
            <button
              onClick={(e) => { e.stopPropagation(); onLinkClick(); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: accentColor ?? 'var(--accent)',
                padding: 0,
                fontWeight: 500,
              }}
            >
              {linkText}
            </button>
          )}

          {isCollapsible && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'inline-block',
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 300ms ease',
                lineHeight: 1,
              }}
            >
              ▾
            </span>
          )}
        </div>
      )}

      <div
        style={{
          maxHeight: isCollapsible
            ? (collapsed ? 0 : (bodyHeight !== undefined ? bodyHeight : 'none'))
            : 'none',
          opacity: isCollapsible ? (collapsed ? 0 : 1) : 1,
          overflow: 'hidden',
          transition: isCollapsible ? 'max-height 300ms ease, opacity 300ms ease' : 'none',
        }}
      >
        <div ref={bodyRef} style={{ padding: '12px 16px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
