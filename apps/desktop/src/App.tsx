import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { VaultProvider, useVault } from './contexts/VaultContext';
import { pickVaultFolder } from './lib/vault-service';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Meals = lazy(() => import('./pages/Meals'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Settings = lazy(() => import('./pages/Settings'));
const Stock = lazy(() => import('./pages/Stock'));
const Budget = lazy(() => import('./pages/Budget'));
const Journal = lazy(() => import('./pages/Journal'));
const Photos = lazy(() => import('./pages/Photos'));
const Birthdays = lazy(() => import('./pages/Birthdays'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Challenges = lazy(() => import('./pages/Challenges'));
const Loot = lazy(() => import('./pages/Loot'));
const Placeholder = lazy(() => import('./pages/Placeholder'));
const Moods = lazy(() => import('./pages/Moods'));
const Gratitude = lazy(() => import('./pages/Gratitude'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Tree = lazy(() => import('./pages/Tree'));

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { path: '/',         label: "Aujourd'hui", icon: '🏠' },
      { path: '/tasks',    label: 'Tâches',       icon: '📋' },
      { path: '/journal',  label: 'Journal',       icon: '📖' },
      { path: '/calendar', label: 'Calendrier',    icon: '📆' },
    ],
  },
  {
    label: 'Vie quotidienne',
    items: [
      { path: '/meals',    label: 'Repas',    icon: '🍽️' },
      { path: '/shopping', label: 'Courses',  icon: '🛒' },
      { path: '/stock',    label: 'Stock',    icon: '📦' },
      { path: '/budget',   label: 'Budget',   icon: '💰' },
    ],
  },
  {
    label: 'Famille',
    items: [
      { path: '/rdv',       label: 'Rendez-vous',  icon: '📅' },
      { path: '/birthdays', label: 'Anniversaires', icon: '🎂' },
      { path: '/wishlist',  label: 'Wishlist',      icon: '🎁' },
      { path: '/photos',    label: 'Photos',         icon: '📸' },
    ],
  },
  {
    label: 'Bien-être',
    items: [
      { path: '/moods',     label: 'Humeurs',        icon: '🌤️' },
      { path: '/gratitude', label: 'Gratitude',      icon: '🙏' },
      { path: '/quotes',    label: "Mots d'enfants", icon: '💬' },
    ],
  },
  {
    label: 'Gamification',
    items: [
      { path: '/tree',       label: 'Mon arbre',  icon: '🌳' },
      { path: '/loot',       label: 'Récompenses', icon: '🎰' },
      { path: '/challenges', label: 'Défis',        icon: '🏆' },
      { path: '/settings',   label: 'Paramètres',   icon: '⚙️' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Welcome screen
// ---------------------------------------------------------------------------

function WelcomeScreen({ onVaultPicked }: { onVaultPicked: (path: string) => void }) {
  async function handlePick() {
    const path = await pickVaultFolder();
    if (path) onVaultPicked(path);
  }

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-logo">🌳</div>
        <h1>FamilyFlow</h1>
        <p>Ouvre ton vault Obsidian pour commencer</p>
        <button className="btn-welcome" onClick={handlePick}>
          Sélectionner le vault
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar() {
  const { files, loading, activeProfile, clearVaultPath } = useVault();

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-app-title">
          <span className="sidebar-logo">🌳</span>
          <span className="sidebar-name">FamilyFlow</span>
        </div>
        {activeProfile && (
          <div className="sidebar-profile">
            <span className="profile-avatar">{activeProfile.avatar ?? '👤'}</span>
            <span className="profile-name">{activeProfile.name}</span>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="nav-section">
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'nav-item--active' : ''}`
                }
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="vault-status">
          {loading ? (
            <span className="vault-status-text">Chargement...</span>
          ) : (
            <span className="vault-status-text">{files.length} fichiers</span>
          )}
          <div
            className={`vault-dot ${loading ? 'vault-dot--loading' : 'vault-dot--ok'}`}
          />
        </div>
        <button className="btn-change-vault" onClick={clearVaultPath}>
          Changer de vault
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Page loading fallback
// ---------------------------------------------------------------------------

function PageLoader() {
  return (
    <div className="page-loader">
      <span>Chargement...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout (sidebar + routes)
// ---------------------------------------------------------------------------

function AppLayout() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks"    element={<Tasks />} />
            <Route path="/journal"  element={<Journal />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/meals"    element={<Meals />} />
            <Route path="/shopping" element={<Navigate to="/meals" replace />} />
            <Route path="/stock"    element={<Stock />} />
            <Route path="/budget"   element={<Budget />} />
            <Route path="/rdv"      element={<Navigate to="/calendar" replace />} />
            <Route path="/birthdays" element={<Birthdays />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/photos"   element={<Photos />} />
            <Route path="/moods"    element={<Moods />} />
            <Route path="/gratitude" element={<Gratitude />} />
            <Route path="/quotes"   element={<Quotes />} />
            <Route path="/tree"     element={<Tree />} />
            <Route path="/loot"     element={<Loot />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root — gate on vault path
// ---------------------------------------------------------------------------

function AppRoot() {
  const { vaultPath, setVaultPath } = useVault();

  if (!vaultPath) {
    return <WelcomeScreen onVaultPicked={setVaultPath} />;
  }

  return <AppLayout />;
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <VaultProvider>
        <AppRoot />
      </VaultProvider>
    </BrowserRouter>
  );
}
