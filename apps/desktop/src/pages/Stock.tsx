import { useState, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';
import { useVault } from '../contexts/VaultContext';
import type { StockItem } from '@family-vault/core';
import './Stock.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STOCK_FILE = '01 - Enfants/Commun/Stock & fournitures.md';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStockStatus(item: StockItem): 'ok' | 'low' | 'empty' {
  if (item.quantite === 0) return 'empty';
  if (item.quantite <= item.seuil) return 'low';
  return 'ok';
}

function normalizeSection(section: string | undefined, emplacement: string): string {
  if (section && section.trim()) return section.trim();
  // Fallback to emplacement capitalized
  const labels: Record<string, string> = {
    frigo: '🧊 Frigo',
    congelateur: '❄️ Congélateur',
    placards: '🗄️ Placards',
    bebe: '👶 Bébé',
  };
  return labels[emplacement] ?? emplacement;
}

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  accent?: string;
}

const StatCard = memo(function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="stock-stat-card" style={accent ? { borderColor: accent } : undefined}>
      <span className="stock-stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <span className="stock-stat-label">{label}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Quantity adjuster
// ---------------------------------------------------------------------------

interface QtyAdjusterProps {
  item: StockItem;
  adjusting: boolean;
  onAdjust: (item: StockItem, delta: number) => void;
}

const QtyAdjuster = memo(function QtyAdjuster({ item, adjusting, onAdjust }: QtyAdjusterProps) {
  return (
    <div className="stock-qty-adjuster">
      <button
        className="stock-qty-btn"
        onClick={() => onAdjust(item, -1)}
        disabled={adjusting || item.quantite <= 0}
        aria-label="Diminuer la quantité"
      >
        −
      </button>
      <span className="stock-qty-value">
        {item.quantite}
        {item.detail ? <span className="stock-qty-unit"> {item.detail}</span> : null}
      </span>
      <button
        className="stock-qty-btn"
        onClick={() => onAdjust(item, +1)}
        disabled={adjusting}
        aria-label="Augmenter la quantité"
      >
        +
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Stock row
// ---------------------------------------------------------------------------

interface StockRowProps {
  item: StockItem;
  adjusting: boolean;
  onAdjust: (item: StockItem, delta: number) => void;
}

const StockRow = memo(function StockRow({ item, adjusting, onAdjust }: StockRowProps) {
  const status = getStockStatus(item);

  return (
    <div className={`stock-row stock-row--${status}`}>
      <div className="stock-row-info">
        <span className="stock-row-name">{item.produit}</span>
        <div className="stock-row-badges">
          {status === 'empty' && (
            <Badge variant="error" size="sm">Épuisé</Badge>
          )}
          {status === 'low' && (
            <Badge variant="warning" size="sm">Bas</Badge>
          )}
        </div>
      </div>
      <QtyAdjuster item={item} adjusting={adjusting} onAdjust={onAdjust} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Section group
// ---------------------------------------------------------------------------

interface SectionGroupProps {
  sectionName: string;
  items: StockItem[];
  adjustingId: string | null;
  onAdjust: (item: StockItem, delta: number) => void;
}

const SectionGroup = memo(function SectionGroup({
  sectionName,
  items,
  adjustingId,
  onAdjust,
}: SectionGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <GlassCard
      title={sectionName}
      count={items.length}
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    >
      <div className="stock-section-body">
        {items.map((item) => (
          <StockRow
            key={`${item.lineIndex}-${item.produit}`}
            item={item}
            adjusting={adjustingId === `${item.lineIndex}`}
            onAdjust={onAdjust}
          />
        ))}
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Main Stock page
// ---------------------------------------------------------------------------

export default function Stock() {
  const { stock, readFile, writeFile, refresh } = useVault();
  const [search, setSearch] = useState('');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalItems = stock.length;
  const lowCount = useMemo(
    () => stock.filter((s) => getStockStatus(s) === 'low').length,
    [stock],
  );
  const emptyCount = useMemo(
    () => stock.filter((s) => getStockStatus(s) === 'empty').length,
    [stock],
  );

  // ── Filtered items ─────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!search.trim()) return stock;
    const q = normalize(search);
    return stock.filter(
      (s) =>
        normalize(s.produit).includes(q) ||
        (s.section && normalize(s.section).includes(q)) ||
        normalize(s.emplacement).includes(q),
    );
  }, [stock, search]);

  // ── Grouped by section ─────────────────────────────────────────────────────

  const sections = useMemo(() => {
    const map = new Map<string, StockItem[]>();
    for (const item of filteredItems) {
      const key = normalizeSection(item.section, item.emplacement);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    // Sort sections alphabetically
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [filteredItems]);

  // ── Quantity adjustment ────────────────────────────────────────────────────

  const handleAdjust = useCallback(
    async (item: StockItem, delta: number) => {
      const newQty = Math.max(0, item.quantite + delta);
      if (newQty === item.quantite) return;

      const id = `${item.lineIndex}`;
      setAdjustingId(id);

      try {
        const content = await readFile(STOCK_FILE);
        const lines = content.split('\n');
        const line = lines[item.lineIndex];
        if (line === undefined) return;

        // Replace the quantity number in the line
        // Format varies: "- Produit: X" or "  - Produit: X/Y" or "| X |"
        // parseStock writes quantity as a number; we replace the first number occurrence
        // that matches the current quantity on that line.
        const updated = line.replace(
          new RegExp(`\\b${item.quantite}\\b`),
          String(newQty),
        );

        if (updated === line) {
          // Fallback: replace first standalone number on the line
          const fallback = line.replace(/\b\d+\b/, String(newQty));
          lines[item.lineIndex] = fallback;
        } else {
          lines[item.lineIndex] = updated;
        }

        await writeFile(STOCK_FILE, lines.join('\n'));
        await refresh();
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur ajustement stock:', e);
      } finally {
        setAdjustingId(null);
      }
    },
    [readFile, writeFile, refresh],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">Stock &amp; fournitures</h1>
          <span className="page-count-badge">{totalItems}</span>
        </div>
      </div>

      {/* Search + stats row */}
      <div className="stock-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un produit..."
        />
        <div className="stock-stats">
          <StatCard label="Total" value={totalItems} />
          <StatCard label="Bas" value={lowCount} accent="#c49800" />
          <StatCard label="Épuisé" value={emptyCount} accent="#ea4335" />
        </div>
      </div>

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="stock-empty">
          <div className="stock-empty-icon">📦</div>
          <p className="stock-empty-text">
            {search ? 'Aucun produit trouvé.' : 'Aucun produit dans le stock.'}
          </p>
        </div>
      ) : (
        <div className="stock-sections">
          {sections.map(([sectionName, items]) => (
            <SectionGroup
              key={sectionName}
              sectionName={sectionName}
              items={items}
              adjustingId={adjustingId}
              onAdjust={handleAdjust}
            />
          ))}
        </div>
      )}
    </div>
  );
}
