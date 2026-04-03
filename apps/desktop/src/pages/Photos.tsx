import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { useVault } from '../contexts/VaultContext';
import { readImageBase64 } from '../lib/vault-service';
import type { VaultFile } from '../lib/vault-service';
import './Photos.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.gif', '.webp', '.tiff', '.avif'];
const PHOTO_FOLDER_PREFIX = '07 - Photos/';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPhotoFile(file: VaultFile): boolean {
  if (file.is_directory) return false;
  const lower = file.name.toLowerCase();
  return PHOTO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function extractDateFromFilename(name: string): string | null {
  // Match YYYY-MM-DD anywhere in the filename
  const match = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function extractChildFromPath(relativePath: string): string | null {
  // Expect: 07 - Photos/{Child}/...  or  07 - Photos/{YYYY-MM}/...
  const parts = relativePath.replace(PHOTO_FOLDER_PREFIX, '').split('/');
  if (parts.length >= 2) {
    const segment = parts[0];
    // If it looks like a year-month, it's not a child name
    if (/^\d{4}/.test(segment)) return null;
    return segment;
  }
  return null;
}

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface PhotoCard {
  name: string;
  relativePath: string;
  absolutePath: string;
  date: string | null;
  child: string | null;
  monthKey: string; // YYYY-MM for grouping
}

function buildPhotoCards(files: VaultFile[]): PhotoCard[] {
  return files
    .filter((f) => f.relative_path.startsWith(PHOTO_FOLDER_PREFIX) && isPhotoFile(f))
    .map((f) => {
      const date = extractDateFromFilename(f.name);
      const child = extractChildFromPath(f.relative_path);
      let monthKey = 'Inconnu';
      if (date) {
        monthKey = date.slice(0, 7); // YYYY-MM
      } else {
        // Try to extract from path segment that looks like YYYY-MM or YYYY
        const pathMonth = f.relative_path.match(/(\d{4}-\d{2})/);
        const pathYear = f.relative_path.match(/(\d{4})/);
        if (pathMonth) monthKey = pathMonth[1];
        else if (pathYear) monthKey = `${pathYear[1]}-00`;
      }
      return { name: f.name, relativePath: f.relative_path, absolutePath: f.path, date, child, monthKey };
    });
}

function formatMonthKey(key: string): string {
  if (key === 'Inconnu') return 'Date inconnue';
  const [y, m] = key.split('-').map(Number);
  if (m === 0) return `${y}`;
  return `${MOIS[m - 1]} ${y}`;
}

// Sort month keys descending (most recent first)
function sortMonthKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === 'Inconnu') return 1;
    if (b === 'Inconnu') return -1;
    return b.localeCompare(a);
  });
}

// ---------------------------------------------------------------------------
// Photo card component
// ---------------------------------------------------------------------------

interface PhotoCardItemProps {
  photo: PhotoCard;
}

function PhotoCardItem({ photo }: PhotoCardItemProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // IntersectionObserver — only load when card enters viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }, // preload 200px before visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load image only when visible
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    readImageBase64(photo.absolutePath)
      .then((dataUri) => { if (!cancelled) setSrc(dataUri); })
      .catch(() => { if (!cancelled) setSrc(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, photo.absolutePath]);

  return (
    <div className="photo-card" ref={ref}>
      <div className="photo-card-thumb" aria-label={photo.name}>
        {!visible || loading ? (
          <span className="photo-card-icon" style={{ opacity: 0.3 }}>📷</span>
        ) : src ? (
          <img
            src={src}
            alt={photo.name}
            className="photo-card-img"
          />
        ) : (
          <span className="photo-card-icon">📷</span>
        )}
      </div>
      <div className="photo-card-info">
        <span className="photo-card-name" title={photo.name}>
          {photo.name}
        </span>
        <div className="photo-card-meta">
          {photo.date && (
            <span className="photo-card-date">{formatDateDisplay(photo.date)}</span>
          )}
          {photo.child && (
            <Badge variant="info" size="sm">{photo.child}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month group
// ---------------------------------------------------------------------------

interface MonthGroupProps {
  monthKey: string;
  photos: PhotoCard[];
}

function MonthGroup({ monthKey, photos }: MonthGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <GlassCard
      title={formatMonthKey(monthKey)}
      icon="📅"
      count={photos.length}
      accentColor="var(--cat-souvenirs)"
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    >
      <div className="photo-month-grid">
        {photos.map((p, i) => (
          <PhotoCardItem key={`${p.relativePath}-${i}`} photo={p} />
        ))}
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Photos() {
  const { files, vaultPath } = useVault();

  const photos = useMemo(() => buildPhotoCards(files), [files]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, PhotoCard[]>();
    for (const p of photos) {
      const group = map.get(p.monthKey) ?? [];
      group.push(p);
      map.set(p.monthKey, group);
    }
    return map;
  }, [photos]);

  const sortedMonths = useMemo(
    () => sortMonthKeys(Array.from(monthGroups.keys())),
    [monthGroups],
  );

  const photoFolderPath = vaultPath ? `${vaultPath}/07 - Photos` : null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Photos</h1>
          <p className="page-subtitle">
            {photos.length > 0
              ? `${photos.length} photo${photos.length > 1 ? 's' : ''} dans le vault`
              : 'Souvenirs photo de la famille'}
          </p>
        </div>
      </div>

      {/* Notice card */}
      <div className="photos-notice">
        <span className="photos-notice-icon">ℹ️</span>
        <div className="photos-notice-body">
          <p className="photos-notice-text">
            Les photos sont stockées dans ton vault Obsidian. Ouvre le dossier pour les visualiser.
          </p>
          {photoFolderPath && (
            <div className="photos-notice-path-row">
              <code className="photos-notice-path">{photoFolderPath}</code>
              <button
                className="photos-open-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(photoFolderPath).catch(() => {});
                }}
                title="Copier le chemin"
              >
                Copier le chemin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {photos.length === 0 ? (
        <div className="photos-empty">
          <span className="photos-empty-icon">📸</span>
          <p className="photos-empty-title">Aucune photo trouvée</p>
          <p className="photos-empty-hint">
            Placez vos photos dans le dossier <code>07 - Photos/</code> de votre vault.
          </p>
        </div>
      ) : (
        <div className="photos-groups">
          {sortedMonths.map((key) => (
            <MonthGroup
              key={key}
              monthKey={key}
              photos={monthGroups.get(key) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
