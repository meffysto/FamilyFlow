interface PlaceholderProps {
  title: string;
  icon: string;
}

export default function Placeholder({ title, icon }: PlaceholderProps) {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="placeholder-state">
        <span className="placeholder-icon">{icon}</span>
        <h2 className="placeholder-title">{title}</h2>
        <p className="placeholder-text">Bientôt disponible</p>
        <p className="placeholder-hint">
          Cette section est en cours de développement.
        </p>
      </div>
    </div>
  );
}
