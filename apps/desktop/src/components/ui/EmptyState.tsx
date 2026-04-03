interface EmptyStateProps {
  message: string;
  icon?: string;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '32px 16px',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}
    >
      {icon && (
        <span style={{ fontSize: 32, lineHeight: 1, opacity: 0.6 }}>{icon}</span>
      )}
      <p style={{ fontSize: 'var(--font-size-label)', lineHeight: 1.5, margin: 0 }}>{message}</p>
    </div>
  );
}
