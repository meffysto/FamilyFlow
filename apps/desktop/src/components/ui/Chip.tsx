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
        padding: '5px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: selected ? 600 : 400,
        fontFamily: 'inherit',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent)' : 'transparent',
        color: selected ? 'white' : 'var(--text-secondary)',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        lineHeight: 1.2,
        userSelect: 'none',
      }}
    >
      {icon && <span style={{ fontSize: '1em', lineHeight: 1 }}>{icon}</span>}
      {label}
    </button>
  );
});
