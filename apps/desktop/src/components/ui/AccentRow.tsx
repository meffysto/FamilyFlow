import React, { type ReactNode } from 'react';

interface AccentRowProps {
  accentColor: string;
  children: ReactNode;
  onClick?: () => void;
}

export const AccentRow = React.memo(function AccentRow({
  accentColor,
  children,
  onClick,
}: AccentRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        background: 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.background = 'var(--card-alt)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {children}
    </div>
  );
});
