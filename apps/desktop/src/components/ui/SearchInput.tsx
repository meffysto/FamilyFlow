import { useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher...' }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderRadius: 'var(--radius-full)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
      onClick={() => inputRef.current?.focus()}
      onFocus={() => {}}
    >
      <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--text-faint)', flexShrink: 0 }}>
        🔍
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'inherit',
          lineHeight: 1.2,
        }}
      />
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-faint)',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            transition: 'color 150ms ease',
          }}
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      )}
    </div>
  );
}
