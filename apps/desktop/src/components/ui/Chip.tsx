import React from 'react';

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: string;
}

export const Chip = React.memo(function Chip({ label, selected, onClick, icon }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 16px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: selected ? 700 : 400,
        fontFamily: 'inherit',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        background: selected ? 'var(--tint)' : 'var(--card-alt)',
        color: selected ? 'var(--primary)' : 'var(--text-sub)',
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
        lineHeight: 1.2,
        userSelect: 'none',
      }}
    >
      {icon && <span style={{ fontSize: '1em', lineHeight: 1 }}>{icon}</span>}
      {label}
    </button>
  );
});
