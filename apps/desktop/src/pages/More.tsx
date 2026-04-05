import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './More.css';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

interface MoreItem {
  path: string;
  icon: string;
  label: string;
  description: string;
}

const MORE_ITEMS: MoreItem[] = [
  {
    path: '/rdv',
    icon: '📅',
    label: 'Rendez-vous',
    description: 'Gérez vos rendez-vous médicaux et rendez-vous familiaux',
  },
  {
    path: '/notes',
    icon: '📝',
    label: 'Notes',
    description: 'Vos notes libres, idées et mémos de famille',
  },
  {
    path: '/stats',
    icon: '📊',
    label: 'Statistiques',
    description: 'Tableaux de bord et historiques de progression',
  },
  {
    path: '/skills',
    icon: '🎯',
    label: 'Compétences',
    description: "Arbre de compétences et suivi d'apprentissage",
  },
  {
    path: '/health',
    icon: '🏥',
    label: 'Santé',
    description: 'Carnet de santé, vaccins, croissance des enfants',
  },
  {
    path: '/routines',
    icon: '⏰',
    label: 'Routines',
    description: 'Routines quotidiennes du matin et du soir',
  },
  {
    path: '/pregnancy',
    icon: '🤰',
    label: 'Grossesse',
    description: 'Journal de grossesse semaine par semaine',
  },
  {
    path: '/night-mode',
    icon: '🌙',
    label: 'Mode nuit',
    description: 'Interface sombre pour les tétées nocturnes',
  },
  {
    path: '/compare',
    icon: '📷',
    label: 'Comparer des photos',
    description: 'Comparez deux photos côte à côte avec zoom',
  },
];

// ---------------------------------------------------------------------------
// More card
// ---------------------------------------------------------------------------

interface MoreCardProps {
  item: MoreItem;
  onClick: (path: string) => void;
}

function MoreCard({ item, onClick }: MoreCardProps) {
  return (
    <button
      className="more-card"
      onClick={() => onClick(item.path)}
      type="button"
    >
      <span className="more-card-icon">{item.icon}</span>
      <div className="more-card-content">
        <span className="more-card-label">{item.label}</span>
        <p className="more-card-description">{item.description}</p>
      </div>
      <span className="more-card-arrow">›</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main More page
// ---------------------------------------------------------------------------

export default function More() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('nav.more', 'Plus')}</h1>
        <p className="more-subtitle">
          {t('more.subtitle', 'Accédez à toutes les fonctionnalités de FamilyFlow')}
        </p>
      </div>

      <div className="more-grid">
        {MORE_ITEMS.map((item) => (
          <MoreCard
            key={item.path}
            item={item}
            onClick={handleNavigate}
          />
        ))}
      </div>
    </div>
  );
}
