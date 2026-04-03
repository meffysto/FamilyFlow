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
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        border: '0.5px solid var(--glass-border)',
        background: tinted && accentColor
          ? `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 6%, var(--glass-bg)), var(--glass-bg) 60%)`
          : 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px var(--glass-shadow)',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      }}
    >
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
            gap: 10,
            cursor: isCollapsible ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          onClick={isCollapsible ? onToggle : undefined}
        >
          {icon && (
            <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
          )}

          {title && (
            <span
              style={{
                fontSize: 'var(--font-size-subtitle)',
                fontWeight: 700,
                color: 'var(--text)',
                flex: 1,
                lineHeight: 1.2,
              }}
            >
              {title}
            </span>
          )}

          {count !== undefined && (
            <span
              style={{
                fontSize: 'var(--font-size-label)',
                fontWeight: 700,
                color: 'var(--on-primary)',
                background: accentColor ?? 'var(--primary)',
                borderRadius: 'var(--radius-base)',
                padding: '3px 8px',
                lineHeight: 1,
                minWidth: 22,
                textAlign: 'center',
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
                fontSize: 'var(--font-size-sm)',
                color: accentColor ?? 'var(--primary)',
                padding: 0,
                fontWeight: 600,
                fontFamily: 'inherit',
                transition: 'opacity 100ms ease',
              }}
            >
              {linkText}
            </button>
          )}

          {isCollapsible && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
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
        <div ref={bodyRef} style={{ padding: '14px 18px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
