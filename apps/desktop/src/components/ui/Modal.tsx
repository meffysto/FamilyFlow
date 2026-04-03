import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalWidth = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: ModalWidth;
}

const WIDTH_MAP: Record<ModalWidth, number> = {
  sm: 400,
  md: 560,
  lg: 760,
};

export function Modal({ isOpen, onClose, title, children, width = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  const maxWidth = WIDTH_MAP[width];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'all' : 'none',
        transition: 'opacity 200ms ease',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--overlay)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card)',
          border: '0.5px solid var(--glass-border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          outline: 'none',
          transform: isOpen ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 200ms ease, opacity 200ms ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--separator)',
            flexShrink: 0,
          }}
        >
          <span style={{
            fontSize: 'var(--font-size-heading)',
            fontWeight: 800,
            color: 'var(--text)',
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 6px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--card-alt)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
