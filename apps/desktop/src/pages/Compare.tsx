import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

function formatDateFr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function extractDateFromFilename(name: string): string | null {
  const match = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// ---------------------------------------------------------------------------
// Photo panel (one side of the comparison)
// ---------------------------------------------------------------------------

interface PhotoInfo {
  name: string;
  relativePath: string;
  absolutePath: string;
  date: string | null;
}

interface PhotoPanelProps {
  label: string;
  photos: PhotoInfo[];
  selectedPhoto: PhotoInfo | null;
  zoom: number;
  onSelect: (photo: PhotoInfo | null) => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

function PhotoPanel({ label, photos, selectedPhoto, zoom, onSelect, onWheel }: PhotoPanelProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState('');

  // Load selected photo
  useEffect(() => {
    if (!selectedPhoto) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    setLoadingImg(true);
    readImageBase64(selectedPhoto.absolutePath)
      .then((uri) => { if (!cancelled) setSrc(uri); })
      .catch(() => { if (!cancelled) setSrc(null); })
      .finally(() => { if (!cancelled) setLoadingImg(false); });
    return () => { cancelled = true; };
  }, [selectedPhoto]);

  const filteredPhotos = useMemo(() => {
    if (!filter) return photos;
    const q = filter.toLowerCase();
    return photos.filter((p) => p.name.toLowerCase().includes(q));
  }, [photos, filter]);

  return (
    <div className="compare-panel">
      <div className="compare-panel-header">
        <span className="compare-panel-label">{label}</span>
        <button
          className="compare-picker-btn"
          onClick={() => setShowPicker((v) => !v)}
        >
          {selectedPhoto ? selectedPhoto.name : 'Choisir une photo'}
          <span className="compare-picker-arrow">{showPicker ? '▲' : '▼'}</span>
        </button>
      </div>

      {showPicker && (
        <div className="compare-picker-dropdown">
          <input
            type="text"
            className="compare-picker-search"
            placeholder="Filtrer les photos..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <div className="compare-picker-list">
            <button
              className="compare-picker-item compare-picker-item--none"
              onClick={() => { onSelect(null); setShowPicker(false); setFilter(''); }}
            >
              — Aucune photo —
            </button>
            {filteredPhotos.slice(0, 100).map((photo) => (
              <button
                key={photo.relativePath}
                className={`compare-picker-item ${selectedPhoto?.relativePath === photo.relativePath ? 'compare-picker-item--active' : ''}`}
                onClick={() => { onSelect(photo); setShowPicker(false); setFilter(''); }}
              >
                <span className="compare-picker-name">{photo.name}</span>
                {photo.date && (
                  <span className="compare-picker-date">{formatDateFr(photo.date)}</span>
                )}
              </button>
            ))}
            {filteredPhotos.length > 100 && (
              <div className="compare-picker-overflow">+{filteredPhotos.length - 100} autres — affinez la recherche</div>
            )}
            {filteredPhotos.length === 0 && (
              <div className="compare-picker-empty">Aucune photo trouvée</div>
            )}
          </div>
        </div>
      )}

      <div
        className="compare-image-zone"
        onWheel={onWheel}
      >
        {loadingImg ? (
          <div className="compare-image-loading">Chargement...</div>
        ) : src ? (
          <img
            className="compare-image"
            src={src}
            alt={selectedPhoto?.name ?? ''}
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        ) : (
          <div className="compare-image-empty">
            <div className="compare-image-empty-icon">📷</div>
            <p>{selectedPhoto ? 'Impossible de charger cette image' : 'Aucune photo sélectionnée'}</p>
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div className="compare-panel-footer">
          {selectedPhoto.date ? formatDateFr(selectedPhoto.date) : 'Date inconnue'}
          &nbsp;·&nbsp;{selectedPhoto.name}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Compare page
// ---------------------------------------------------------------------------

export default function Compare() {
  const { t } = useTranslation('common');
  const { files } = useVault();

  const [leftPhoto, setLeftPhoto] = useState<PhotoInfo | null>(null);
  const [rightPhoto, setRightPhoto] = useState<PhotoInfo | null>(null);
  const [zoom, setZoom] = useState(1);

  // All photo files
  const photos = useMemo<PhotoInfo[]>(() => {
    return files
      .filter((f) => f.relative_path.startsWith(PHOTO_FOLDER_PREFIX) && isPhotoFile(f))
      .map((f) => ({
        name: f.name,
        relativePath: f.relative_path,
        absolutePath: f.path,
        date: extractDateFromFilename(f.name),
      }))
      .sort((a, b) => {
        if (a.date && b.date) return b.date.localeCompare(a.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [files]);

  // Shared zoom via scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleResetZoom = useCallback(() => setZoom(1), []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container compare-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{t('nav.compare', 'Comparer des photos')}</h1>
          {/* Zoom controls */}
          <div className="compare-zoom-controls">
            <button className="compare-zoom-btn" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} aria-label="Dézoomer">−</button>
            <button className="compare-zoom-reset" onClick={handleResetZoom}>{Math.round(zoom * 100)}%</button>
            <button className="compare-zoom-btn" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Zoomer">+</button>
          </div>
        </div>
        <p className="compare-hint">
          {t('compare.hint', 'Utilisez la molette de la souris sur une image pour zoomer. Les deux photos partagent le même zoom.')}
        </p>
      </div>

      {photos.length === 0 ? (
        <div className="compare-empty">
          <div className="compare-empty-icon">📷</div>
          <p className="compare-empty-title">Aucune photo dans le vault</p>
          <p className="compare-empty-hint">
            Ajoutez des photos dans le dossier <code>07 - Photos/</code> de votre vault Obsidian.
          </p>
        </div>
      ) : (
        <div className="compare-split">
          <PhotoPanel
            label="Photo A"
            photos={photos}
            selectedPhoto={leftPhoto}
            zoom={zoom}
            onSelect={setLeftPhoto}
            onWheel={handleWheel}
          />
          <div className="compare-divider" />
          <PhotoPanel
            label="Photo B"
            photos={photos}
            selectedPhoto={rightPhoto}
            zoom={zoom}
            onSelect={setRightPhoto}
            onWheel={handleWheel}
          />
        </div>
      )}
    </div>
  );
}
