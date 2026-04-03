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
        padding: '7px 10px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        transition: 'border-color 0.15s',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <span style={{ fontSize: 13, lineHeight: 1, color: 'var(--text-secondary)', flexShrink: 0 }}>
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
          color: 'var(--text-primary)',
          fontSize: 13,
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
            color: 'var(--text-secondary)',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      )}
    </div>
  );
}
