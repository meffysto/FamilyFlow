import { type ReactNode, type MouseEvent } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  icon?: string;
  type?: 'button' | 'submit' | 'reset';
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'white',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'transparent',
    color: '#e53e3e',
    border: '1px solid #e53e3e',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: 12, borderRadius: 6 },
  md: { padding: '8px 16px', fontSize: 13, borderRadius: 'var(--radius)' },
  lg: { padding: '11px 22px', fontSize: 15, borderRadius: 'var(--radius)' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  className,
  icon,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s, opacity 0.15s, border-color 0.15s',
        fontFamily: 'inherit',
        lineHeight: 1.2,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
      }}
    >
      {icon && <span style={{ fontSize: '1em', lineHeight: 1 }}>{icon}</span>}
      {children}
    </button>
  );
}
