import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge } from '../components/ui/Badge';
import { useVault } from '../contexts/VaultContext';
import { readImageBase64 } from '../lib/vault-service';
import type { VaultFile } from '../lib/vault-service';
import './Compare.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.gif', '.webp', '.tiff', '.avif'];
const PHOTO_FOLDER_PREFIX = '07 - Photos/';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

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

function formatDateFr(isoDate: string): string {
  const MOIS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MOIS[m - 1]} ${y}`;
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

interface PhotoInfo {
  name: string;
  relativePath: string;
  absolutePath: string;
  date: string | null;
  child: string | null;
}

function computeDelta(dateA: string, dateB: string): string {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = Math.abs(b.getTime() - a.getTime());
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return 'Même jour';
  if (diffDays < 30) return `${diffDays} jour${diffDays > 1 ? 's' : ''} d'écart`;

  const totalMonths = Math.round(diffDays / 30.44);
  if (totalMonths < 12) return `${totalMonths} mois d'écart`;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) return `${years} an${years > 1 ? 's' : ''} d'écart`;
  return `${years} an${years > 1 ? 's' : ''} et ${months} mois d'écart`;
}

// ---------------------------------------------------------------------------
// Thumbnail strip item (lazy loaded)
// ---------------------------------------------------------------------------

interface ThumbProps {
  photo: PhotoInfo;
  selected: 'left' | 'right' | null;
  onClick: () => void;
}

function Thumb({ photo, selected, onClick }: ThumbProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '100px', root: el.parentElement },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    readImageBase64(photo.absolutePath)
      .then((uri) => { if (!cancelled) setSrc(uri); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, photo.absolutePath]);

  const borderClass = selected === 'left'
    ? 'compare-thumb--left'
    : selected === 'right'
      ? 'compare-thumb--right'
      : '';

  return (
    <button
      ref={ref}
      className={`compare-thumb ${borderClass}`}
      onClick={onClick}
      title={photo.date ? formatDateFr(photo.date) : photo.name}
    >
      {src ? (
        <img src={src} alt={photo.name} className="compare-thumb-img" />
      ) : (
        <span className="compare-thumb-placeholder">📷</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Compare page
// ---------------------------------------------------------------------------

export default function Compare() {
  const { files } = useVault();

  // All photos with child extraction
  const photos = useMemo<PhotoInfo[]>(() => {
    return files
      .filter((f) => f.relative_path.startsWith(PHOTO_FOLDER_PREFIX) && isPhotoFile(f))
      .map((f) => ({
        name: f.name,
        relativePath: f.relative_path,
        absolutePath: f.path,
        date: extractDateFromFilename(f.name),
        child: extractChildFromPath(f.relative_path),
      }))
      .sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [files]);

  // Children list
  const children = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      if (p.child) set.add(p.child);
    }
    return Array.from(set).sort();
  }, [photos]);

  // Selected child
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  // Auto-select first child
  useEffect(() => {
    if (!selectedChild && children.length > 0) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild]);

  // Filtered photos for selected child
  const childPhotos = useMemo(() => {
    if (!selectedChild) return photos;
    return photos.filter((p) => p.child === selectedChild);
  }, [photos, selectedChild]);

  // Year pills
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of childPhotos) {
      if (p.date) set.add(parseInt(p.date.slice(0, 4), 10));
    }
    return Array.from(set).sort();
  }, [childPhotos]);

  // Selection state
  type Side = 'left' | 'right';
  const [activeSide, setActiveSide] = useState<Side>('left');
  const [leftPhoto, setLeftPhoto] = useState<PhotoInfo | null>(null);
  const [rightPhoto, setRightPhoto] = useState<PhotoInfo | null>(null);
  const [leftSrc, setLeftSrc] = useState<string | null>(null);
  const [rightSrc, setRightSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Reset selection when child changes
  useEffect(() => {
    setLeftPhoto(null);
    setRightPhoto(null);
    setLeftSrc(null);
    setRightSrc(null);
    setActiveSide('left');
    setZoom(1);
  }, [selectedChild]);

  // Load left image
  useEffect(() => {
    if (!leftPhoto) { setLeftSrc(null); return; }
    let cancelled = false;
    readImageBase64(leftPhoto.absolutePath)
      .then((uri) => { if (!cancelled) setLeftSrc(uri); })
      .catch(() => { if (!cancelled) setLeftSrc(null); });
    return () => { cancelled = true; };
  }, [leftPhoto]);

  // Load right image
  useEffect(() => {
    if (!rightPhoto) { setRightSrc(null); return; }
    let cancelled = false;
    readImageBase64(rightPhoto.absolutePath)
      .then((uri) => { if (!cancelled) setRightSrc(uri); })
      .catch(() => { if (!cancelled) setRightSrc(null); });
    return () => { cancelled = true; };
  }, [rightPhoto]);

  // Handle thumb click
  const handleThumbClick = useCallback((photo: PhotoInfo) => {
    if (activeSide === 'left') {
      setLeftPhoto(photo);
      setActiveSide('right');
    } else {
      setRightPhoto(photo);
      setActiveSide('left');
    }
  }, [activeSide]);

  // Scroll strip to year
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollToYear = useCallback((year: number) => {
    if (!stripRef.current) return;
    const target = stripRef.current.querySelector(`[data-year="${year}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, []);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // Which side is each thumb selected for?
  const thumbState = useCallback((photo: PhotoInfo): 'left' | 'right' | null => {
    if (leftPhoto?.relativePath === photo.relativePath) return 'left';
    if (rightPhoto?.relativePath === photo.relativePath) return 'right';
    return null;
  }, [leftPhoto, rightPhoto]);

  // Delta label
  const deltaLabel = useMemo(() => {
    if (!leftPhoto?.date || !rightPhoto?.date) return null;
    return computeDelta(leftPhoto.date, rightPhoto.date);
  }, [leftPhoto, rightPhoto]);

  // Year markers for the strip
  const yearMarkerIndices = useMemo(() => {
    const map = new Map<number, number>();
    childPhotos.forEach((p, i) => {
      if (!p.date) return;
      const y = parseInt(p.date.slice(0, 4), 10);
      if (!map.has(y)) map.set(y, i);
    });
    return map;
  }, [childPhotos]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="compare-page">
      {/* Zoom controls */}
      <div className="compare-toolbar">
        <p className="compare-hint">Sélectionne deux photos pour les comparer côte à côte</p>
        <div className="compare-zoom-controls">
          <button className="compare-zoom-btn" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} disabled={zoom <= MIN_ZOOM}>−</button>
          <button className="compare-zoom-reset" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button className="compare-zoom-btn" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} disabled={zoom >= MAX_ZOOM}>+</button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="compare-empty">
          <div className="compare-empty-icon">📷</div>
          <p className="compare-empty-title">Aucune photo dans le vault</p>
          <p className="compare-empty-hint">
            Ajoutez des photos dans le dossier <code>07 - Photos/</code> de votre vault.
          </p>
        </div>
      ) : (
        <>
          {/* Child tabs */}
          {children.length > 1 && (
            <div className="compare-child-tabs">
              {children.map((child) => (
                <button
                  key={child}
                  className={`compare-child-tab ${selectedChild === child ? 'compare-child-tab--active' : ''}`}
                  onClick={() => setSelectedChild(child)}
                >
                  <span className="compare-child-avatar">{child.charAt(0).toUpperCase()}</span>
                  {child}
                </button>
              ))}
            </div>
          )}

          {/* Active side indicator */}
          <div className="compare-side-indicator">
            <span
              className="compare-side-dot"
              style={{ background: activeSide === 'left' ? 'var(--primary)' : 'var(--success)' }}
            />
            {activeSide === 'left' ? 'Choisis la photo de gauche' : 'Choisis la photo de droite'}
          </div>

          {/* Photo slots */}
          <div className="compare-slots">
            <div
              className={`compare-slot ${activeSide === 'left' ? 'compare-slot--active-left' : ''}`}
              onClick={() => setActiveSide('left')}
              onWheel={handleWheel}
            >
              {leftSrc ? (
                <img src={leftSrc} alt={leftPhoto?.name ?? ''} className="compare-slot-img" style={{ transform: `scale(${zoom})` }} draggable={false} />
              ) : (
                <div className="compare-slot-empty">
                  <span>📷</span>
                  <span>Photo A</span>
                </div>
              )}
            </div>

            <div
              className={`compare-slot ${activeSide === 'right' ? 'compare-slot--active-right' : ''}`}
              onClick={() => setActiveSide('right')}
              onWheel={handleWheel}
            >
              {rightSrc ? (
                <img src={rightSrc} alt={rightPhoto?.name ?? ''} className="compare-slot-img" style={{ transform: `scale(${zoom})` }} draggable={false} />
              ) : (
                <div className="compare-slot-empty">
                  <span>📷</span>
                  <span>Photo B</span>
                </div>
              )}
            </div>
          </div>

          {/* Date labels + delta */}
          <div className="compare-date-row">
            <span className="compare-date-label compare-date-label--left">
              {leftPhoto?.date ? formatDateFr(leftPhoto.date) : '—'}
            </span>
            {deltaLabel && (
              <Badge variant="default" size="sm">{deltaLabel}</Badge>
            )}
            <span className="compare-date-label compare-date-label--right">
              {rightPhoto?.date ? formatDateFr(rightPhoto.date) : '—'}
            </span>
          </div>

          {/* Year pills */}
          {years.length > 1 && (
            <div className="compare-year-pills">
              {years.map((y) => (
                <button key={y} className="compare-year-pill" onClick={() => scrollToYear(y)}>
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Thumbnail strip */}
          <div className="compare-strip" ref={stripRef}>
            {childPhotos.map((photo, i) => {
              const year = photo.date ? parseInt(photo.date.slice(0, 4), 10) : null;
              const isYearStart = year !== null && yearMarkerIndices.get(year) === i;
              return (
                <div key={photo.relativePath} className="compare-strip-cell" data-year={isYearStart ? year : undefined}>
                  {isYearStart && <div className="compare-strip-year-label">{year}</div>}
                  <Thumb
                    photo={photo}
                    selected={thumbState(photo)}
                    onClick={() => handleThumbClick(photo)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
