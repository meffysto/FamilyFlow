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
    background: 'var(--primary)',
    color: 'var(--on-primary)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--tint)',
    color: 'var(--primary)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--error-bg)',
    color: 'var(--error)',
    border: '1px solid transparent',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 'var(--font-size-sm)', borderRadius: 'var(--radius-sm)' },
  md: { padding: '8px 16px', fontSize: 'var(--font-size-body)', borderRadius: 'var(--radius-md)' },
  lg: { padding: '12px 20px', fontSize: 'var(--font-size-lg)', borderRadius: 'var(--radius-md)' },
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
        transition: 'filter 120ms ease, opacity 120ms ease, transform 80ms ease',
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
