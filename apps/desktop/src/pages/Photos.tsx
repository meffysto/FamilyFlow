import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useVault } from '../contexts/VaultContext';
import { readImageBase64 } from '../lib/vault-service';
import type { VaultFile } from '../lib/vault-service';
import Compare from './Compare';
import './Photos.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.gif', '.webp', '.tiff', '.avif'];
const PHOTO_FOLDER_PREFIX = '07 - Photos/';
const PHOTOS_PER_PAGE = 24; // photos affichées par mois avant "Voir plus"
const INITIAL_EXPANDED_MONTHS = 2; // seuls les N premiers mois sont ouverts

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
  const match = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function extractChildFromPath(relativePath: string): string | null {
  const parts = relativePath.replace(PHOTO_FOLDER_PREFIX, '').split('/');
  if (parts.length >= 2) {
    const segment = parts[0];
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
  monthKey: string;
}

function buildPhotoCards(files: VaultFile[]): PhotoCard[] {
  return files
    .filter((f) => f.relative_path.startsWith(PHOTO_FOLDER_PREFIX) && isPhotoFile(f))
    .map((f) => {
      const date = extractDateFromFilename(f.name);
      const child = extractChildFromPath(f.relative_path);
      let monthKey = 'Inconnu';
      if (date) {
        monthKey = date.slice(0, 7);
      } else {
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

function sortMonthKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === 'Inconnu') return 1;
    if (b === 'Inconnu') return -1;
    return b.localeCompare(a);
  });
}

// ---------------------------------------------------------------------------
// Photo card component (lazy image loading)
// ---------------------------------------------------------------------------

interface PhotoCardItemProps {
  photo: PhotoCard;
  onClick: () => void;
}

function PhotoCardItem({ photo, onClick }: PhotoCardItemProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    <div className="photo-card" ref={ref} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="photo-card-thumb" aria-label={photo.name}>
        {!visible || loading ? (
          <span className="photo-card-icon" style={{ opacity: 0.3 }}>📷</span>
        ) : src ? (
          <img src={src} alt={photo.name} className="photo-card-img" />
        ) : (
          <span className="photo-card-icon">📷</span>
        )}
      </div>
      <div className="photo-card-info">
        <span className="photo-card-name" title={photo.name}>{photo.name}</span>
        <div className="photo-card-meta">
          {photo.date && <span className="photo-card-date">{formatDateDisplay(photo.date)}</span>}
          {photo.child && <Badge variant="info" size="sm">{photo.child}</Badge>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  photos: PhotoCard[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

function Lightbox({ photos, index, onClose, onNavigate }: LightboxProps) {
  const photo = photos[index];
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSrc(null);
    readImageBase64(photo.absolutePath)
      .then((dataUri) => { if (!cancelled) setSrc(dataUri); })
      .catch(() => { if (!cancelled) setSrc(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [photo.absolutePath]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, photos.length, onClose, onNavigate]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button className="lightbox-close" onClick={onClose} aria-label="Fermer">✕</button>

        {/* Navigation */}
        {index > 0 && (
          <button className="lightbox-nav lightbox-nav--prev" onClick={() => onNavigate(index - 1)} aria-label="Photo précédente">‹</button>
        )}
        {index < photos.length - 1 && (
          <button className="lightbox-nav lightbox-nav--next" onClick={() => onNavigate(index + 1)} aria-label="Photo suivante">›</button>
        )}

        {/* Image */}
        <div className="lightbox-image-zone">
          {loading ? (
            <span className="lightbox-loading">Chargement...</span>
          ) : src ? (
            <img src={src} alt={photo.name} className="lightbox-img" />
          ) : (
            <span className="lightbox-loading">Impossible de charger l'image</span>
          )}
        </div>

        {/* Info bar */}
        <div className="lightbox-info">
          <span className="lightbox-name">{photo.name}</span>
          <span className="lightbox-counter">{index + 1} / {photos.length}</span>
          {photo.date && <span className="lightbox-date">{formatDateDisplay(photo.date)}</span>}
          {photo.child && <Badge variant="info" size="sm">{photo.child}</Badge>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month group (only renders grid when expanded)
// ---------------------------------------------------------------------------

interface MonthGroupProps {
  monthKey: string;
  photos: PhotoCard[];
  defaultCollapsed: boolean;
  onPhotoClick: (photo: PhotoCard, allPhotos: PhotoCard[]) => void;
}

function MonthGroup({ monthKey, photos, defaultCollapsed, onPhotoClick }: MonthGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE);

  const visiblePhotos = photos.slice(0, visibleCount);
  const hasMore = visibleCount < photos.length;

  return (
    <GlassCard
      title={formatMonthKey(monthKey)}
      icon="📅"
      count={photos.length}
      accentColor="var(--cat-souvenirs)"
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    >
      {/* Grid is only rendered when expanded */}
      <div className="photo-month-grid">
        {visiblePhotos.map((p, i) => (
          <PhotoCardItem
            key={`${p.relativePath}-${i}`}
            photo={p}
            onClick={() => onPhotoClick(p, photos)}
          />
        ))}
      </div>
      {hasMore && (
        <button
          className="photos-show-more"
          onClick={() => setVisibleCount((c) => c + PHOTOS_PER_PAGE)}
        >
          Voir plus ({photos.length - visibleCount} restantes)
        </button>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const VIEW_OPTIONS = [
  { label: '📷 Galerie', value: 'galerie' },
  { label: '🔀 Comparer', value: 'comparer' },
];

export default function Photos() {
  const { files, vaultPath } = useVault();
  const [view, setView] = useState<'galerie' | 'comparer'>('galerie');

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

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ photos: PhotoCard[]; index: number } | null>(null);

  const handlePhotoClick = useCallback((photo: PhotoCard, allPhotos: PhotoCard[]) => {
    const idx = allPhotos.findIndex((p) => p.relativePath === photo.relativePath);
    setLightbox({ photos: allPhotos, index: idx >= 0 ? idx : 0 });
  }, []);

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
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={view}
          onChange={(v) => setView(v as 'galerie' | 'comparer')}
        />
      </div>

      {view === 'comparer' ? (
        <Compare />
      ) : (
        <>
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
              {sortedMonths.map((key, idx) => (
                <MonthGroup
                  key={key}
                  monthKey={key}
                  photos={monthGroups.get(key) ?? []}
                  defaultCollapsed={idx >= INITIAL_EXPANDED_MONTHS}
                  onPhotoClick={handlePhotoClick}
                />
              ))}
            </div>
          )}

          {/* Lightbox */}
          {lightbox && (
            <Lightbox
              photos={lightbox.photos}
              index={lightbox.index}
              onClose={() => setLightbox(null)}
              onNavigate={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : null)}
            />
          )}
        </>
      )}
    </div>
  );
}
