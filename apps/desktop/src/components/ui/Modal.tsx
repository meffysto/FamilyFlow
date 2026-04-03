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

  // Prevent scroll lock interference — desktop app has overflow:hidden anyway
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
        // Fade in/out
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
          background: 'rgba(0,0,0,0.55)',
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
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          outline: 'none',
          // Scale in/out
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
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
