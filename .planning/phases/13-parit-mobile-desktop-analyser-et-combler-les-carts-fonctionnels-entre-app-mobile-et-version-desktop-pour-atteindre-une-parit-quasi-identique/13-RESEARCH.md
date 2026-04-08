# Phase 14: Parité Mobile ↔ Desktop — Research

**Researched:** 2026-04-05
**Domain:** React desktop app (Tauri + Vite + React Router v7) — parité fonctionnelle avec l'app mobile React Native/Expo
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Scope — Tous les écrans manquants**
Les 10 écrans absents du desktop seront tous implémentés :
- Skills (arbre RPG compétences enfants)
- Health (suivi croissance, vaccins, historique médical)
- Routines (séquences visuelles avec timers)
- Pregnancy (timeline semaine par semaine)
- Night-Mode (interface sombre pour tétées nocturnes — sans brightness control)
- Compare (comparaison photos côte à côte)
- Stats (6 visualisations de données)
- RDV (écran dédié rendez-vous avec CRUD complet — actuellement redirigé vers /calendar)
- Notes (éditeur + import web via defuddle)
- More (menu navigation organisé)

**D-02: Interactions desktop — Hover menus + boutons contextuels + raccourcis clavier**
| Geste mobile | Équivalent desktop |
|---|---|
| Swipe-to-delete | Bouton supprimer au hover + touche Delete |
| Pull-to-refresh | Bouton refresh + Ctrl/Cmd+R |
| Long-press | Clic droit / menu contextuel |
| Pinch-to-zoom | Scroll wheel zoom + boutons +/- |
| Swipe carousel | Flèches clavier + boutons prev/next |
| Drag-to-reorder | Drag & drop natif HTML5 |
| Tap | Click |

**D-03: Animations — CSS transitions + Framer Motion**
- Transitions simples : CSS transitions natives (fade, slide, scale)
- Animations complexes (loot box opener, harvest burst, companion reactions) : Framer Motion
- Particules ambiantes (seasonal, ambiance) : Canvas 2D ou CSS keyframes
- Pas de react-native-reanimated — on utilise les équivalents web

**D-04: OCR Budget — Drag & drop fichier + bouton upload**
- Zone de drag & drop pour déposer une photo de reçu
- Bouton upload alternatif (file input classique)
- Même pipeline Claude Vision API que le mobile (`scanReceiptImage()`)
- Composant ReceiptReview pour éditer les items détectés avant sauvegarde
- Conversion image → base64 côté client avant envoi API

**D-05: Gamification — Parité complète**
Toutes les features gamification du mobile doivent exister sur desktop :
- Loot box opening avec animation Framer Motion (style Pokémon TCG)
- Confetti effect (librairie canvas-confetti ou équivalent)
- Companion system complet (picker, mood, messages IA, avatar mini)
- Sagas immersives (visiteur pixel, dialogues interactifs)
- Événements saisonniers (même engine, même contenu)
- Tech tree / building upgrades
- Active rewards display
- Badges collection

**D-06: VaultContext desktop — Opérations CRUD manquantes**
Le VaultContext desktop doit être étendu avec toutes les mutations présentes sur mobile :
- Budget : addBudgetEntry, updateBudgetEntry, deleteBudgetEntry
- Notes : addNote, updateNote, deleteNote
- RDV : addRDV, updateRDV, deleteRDV
- Défis : addDefi, updateDefi, checkInDefi
- Loot : openLootBox, markLootUsed
- Farm : saveSagaProgress, saveEventProgress
- Skills : unlockSkill
- Health : addHealthRecord, updateHealthRecord
- Pregnancy : addPregnancyEntry
- Routines : saveRoutine, completeRoutineStep

**D-07: Localisation — i18next complet**
- Réutiliser les fichiers de traduction existants (`locales/fr/*.json`, `locales/en/*.json`)
- Tous les nouveaux écrans doivent utiliser les namespaces existants
- Pas de texte hardcodé en français dans les composants

### Claude's Discretion
- Choix de la librairie de charts pour Stats (recharts, victory, chart.js — au choix du planner)
- Structure exacte des fichiers CSS (un par page vs modules CSS vs styled-components — pattern existant desktop)
- Ordre d'implémentation des écrans dans les plans (le planner optimise les dépendances)
- Librairie de confetti (canvas-confetti, react-confetti, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAR-01 | Chaque écran mobile a son équivalent desktop fonctionnel — aucun écran manquant | 10 écrans identifiés + structure d'implémentation détaillée ci-dessous |
| PAR-02 | Les interactions tactiles remplacées par équivalents desktop (hover, clic droit, raccourcis clavier) | Pattern hover-reveal + keyboard shortcuts documentés |
| PAR-03 | Les données créées sur desktop sont lisibles sur mobile et vice-versa | @family-vault/core partagé entre mobile et desktop — parsers/serializers identiques |
</phase_requirements>

---

## Summary

Le desktop FamilyFlow est une app Tauri + Vite + React + React Router v7, avec un `VaultProvider` dans `apps/desktop/src/contexts/VaultContext.tsx` (607 lignes, ~5 mutations actuelles). Le projet utilise un package partagé `@family-vault/core` qui contient tous les parsers, engines, types et constants — ce package est directement consommé par le desktop et évite toute duplication de logique.

L'état actuel du desktop montre 17 pages existantes (Dashboard, Tasks, Journal, Calendar, Meals, Stock, Budget, Photos, Birthdays, Wishlist, Challenges, Loot, Moods, Gratitude, Quotes, Tree, Settings), mais plusieurs sont incomplètes (Loot a un bouton "bientôt disponible", pas de vraie ouverture de coffre) et 10 routes sont manquantes ou redirigées (notamment `/rdv` redirige vers `/calendar`). La phase 14 comble ce gap de façon systématique.

Le gros du travail est réparti en trois axes : (1) implémenter les 10 écrans manquants en réutilisant les engines depuis `@family-vault/core`, (2) étendre `VaultContext.tsx` avec ~25 mutations CRUD manquantes, (3) intégrer Framer Motion pour les animations complexes (loot box, companion reactions) et canvas-confetti pour les célébrations.

**Primary recommendation:** Ajouter Framer Motion 12 + recharts 3 + canvas-confetti à `apps/desktop/package.json`, puis implémenter les mutations VaultContext en priorité (D-06) car tous les nouveaux écrans en dépendent.

---

## Standard Stack

### Core (déjà présent — ne pas modifier)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.1.0 | UI rendering | Déjà installé |
| react-router-dom | ^7 | Navigation côté client | Déjà installé, routes définies dans App.tsx |
| @tauri-apps/api | ^2 | Desktop native bridge | Déjà installé |
| @family-vault/core | * | Parsers, engines, types partagés | Source de vérité unique entre mobile et desktop |
| typescript | ~5.9.2 | Type checking | Déjà installé |
| vite | ^6 | Build tool | Déjà installé |

### À ajouter (phase 14)

| Library | Version vérifié | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.38.0 | Animations complexes (loot box, companion, transitions) | D-03 : animations qui dépassent CSS transitions |
| recharts | 3.8.1 | 6 visualisations de données Stats | PAR-01 (écran Stats) — choix du planner validé par research |
| canvas-confetti | 1.9.4 | Effet confetti loot box + level up | D-05 gamification |
| @types/canvas-confetti | 1.9.0 | Types TypeScript pour canvas-confetti | Devdependency |

**Installation:**
```bash
cd apps/desktop
npm install framer-motion recharts canvas-confetti
npm install -D @types/canvas-confetti
```

**Justification recharts vs alternatives:**
- recharts 3.x est la librairie charts React la plus mature (composants déclaratifs, TreeMap, BarChart, LineChart, responsive)
- victory : bonne mais moins bien maintenue en 2026
- chart.js : impératif, moins ergonomique avec React, nécessite ref management

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | chart.js | chart.js plus flexible mais API impérative — recharts est plus React-idiomatique |
| canvas-confetti | react-confetti | react-confetti est plus lourd et moins configurable — canvas-confetti est ~3KB |
| framer-motion | CSS animations only | CSS ne peut pas reproduire les effets card-flip Pokémon TCG |

---

## Architecture Patterns

### Structure existante desktop à respecter

```
apps/desktop/src/
├── pages/            # Un fichier .tsx + un .css par page (ex: Budget.tsx + Budget.css)
├── components/ui/    # Primitives partagées (GlassCard, Modal, Button, Badge, Chip, SearchInput, SegmentedControl)
├── contexts/         # VaultContext.tsx (source unique d'état)
├── lib/              # vault-service.ts, farm-vault.ts
├── styles/           # tokens.css, globals.css, layout.css, components.css
└── App.tsx           # Router + Sidebar + routes
```

### Pattern 1: Nouvelle page desktop

Chaque nouvelle page suit exactement ce pattern déjà établi dans Budget.tsx, Challenges.tsx, etc. :

```typescript
// Source: apps/desktop/src/pages/Budget.tsx (pattern établi)
import { useState, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import { /* types et parsers */ } from '@family-vault/core';
import './PageName.css';

export default function PageName() {
  const { data, mutationFn } = useVault();
  // ...
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">Titre</h1>
        </div>
      </div>
      {/* contenu avec GlassCard */}
    </div>
  );
}
```

### Pattern 2: Ajout de mutation dans VaultContext desktop

Le VaultContext desktop actuel expose seulement `toggleTask` comme mutation. Pour ajouter une mutation, le pattern est celui de `toggleTask` :

```typescript
// Source: apps/desktop/src/contexts/VaultContext.tsx (pattern toggleTask)
const addRDV = useCallback(
  async (rdv: Omit<RDV, 'sourceFile' | 'title'>) => {
    if (!vaultPath) return;
    try {
      // 1. Calculer le chemin du fichier
      // 2. Lire le fichier existant (si besoin)
      // 3. Sérialiser via @family-vault/core
      // 4. Écrire via writeVaultFile
      // 5. Mettre à jour l'état local via setRdvs(prev => ...)
    } catch (e) {
      if (import.meta.env.DEV) console.error('Erreur addRDV:', e);
    }
  },
  [vaultPath],
);
```

Toutes les mutations mobiles de référence sont dans `/hooks/useVault.ts` (3569 lignes) — les implémentations desktop doivent répliquer la logique de serialization mais sans les abstractions React Native (pas de `Alert.alert`, pas de `Haptics`).

### Pattern 3: Hover-reveal pour swipe-to-delete

```typescript
// Pattern CSS + React pour remplacer swipe-to-delete
// Aucune dépendance supplémentaire — CSS natif
```

```css
/* Dans PageName.css */
.item-row { position: relative; }
.item-actions {
  position: absolute; right: 0; top: 0; bottom: 0;
  display: flex; align-items: center; gap: var(--space-sm);
  opacity: 0; transition: opacity 120ms ease;
}
.item-row:hover .item-actions { opacity: 1; }
```

```typescript
// Raccourci Delete sur item sélectionné
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' && selectedId) {
      handleDelete(selectedId);
    }
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [selectedId, handleDelete]);
```

### Pattern 4: Animation Framer Motion (loot box)

```typescript
// Source: D-03 + D-05 decisions
import { motion, AnimatePresence } from 'framer-motion';

// Card flip style Pokémon TCG
const cardVariants = {
  hidden:  { rotateY: 180, scale: 0.8, opacity: 0 },
  visible: { rotateY: 0,   scale: 1,   opacity: 1,
             transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

<AnimatePresence>
  {isRevealing && (
    <motion.div
      key={reward.id}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.5 }}
      style={{ perspective: 1000 }}
    >
      {/* reward card */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 5: Drag & drop fichier pour OCR Budget

```typescript
// Source: D-04 decision + Dashboard.tsx pattern existant (drag & drop cartes)
// Dashboard.tsx montre déjà l'utilisation de DragEvent natif HTML5 — même approche

function ReceiptDropZone({ onFile }: { onFile: (file: File) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`receipt-drop-zone${isDragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}
```

La conversion base64 se fait avec `FileReader.readAsDataURL()` ou `file.arrayBuffer()` + btoa, puis l'appel `scanReceiptImage()` depuis `@family-vault/core/ai-service` prend un string base64.

### Pattern 6: Route dans App.tsx

Pour chaque nouvelle page, deux modifications dans `apps/desktop/src/App.tsx` :
1. `const NewPage = lazy(() => import('./pages/NewPage'));`
2. Dans `NAV_SECTIONS` (si visible dans sidebar) + `<Route path="/newpage" element={<NewPage />} />`

### Anti-Patterns à éviter

- **Ne pas créer de StyleSheet.create** : le desktop utilise des classes CSS — pas de inline styles sauf pour les valeurs dynamiques (couleurs thème, largeurs calculées)
- **Ne pas importer depuis `react-native`** : les pages desktop utilisent des éléments HTML natifs (`div`, `button`, `input`) — jamais `View`, `Text`, `TouchableOpacity`
- **Ne pas hardcoder les couleurs** : utiliser les CSS variables de `tokens.css` (ex: `var(--primary)`, `var(--text)`) — jamais de hex directs
- **Ne pas bypasser @family-vault/core** : tous les parsers/serializers existent déjà dans le core — ne pas réécrire la logique de parsing markdown

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Charts / graphiques | Composants SVG custom | recharts (BarChart, LineChart, ResponsiveContainer) | Axes, tooltips, responsive, accessibilité — ~500 lignes réduites à ~20 |
| Confetti | Canvas animation custom | canvas-confetti | API simple (`confetti({...})`), physique correcte, 3KB |
| Animations complexes | CSS @keyframes custom | framer-motion | Card flip 3D, spring physics, AnimatePresence exit animations |
| Parsing markdown | Code de parsing | `@family-vault/core` parsers | Déjà testé en production mobile — parser.ts fait 79KB |
| Gamification engine | Logique XP/loot | `@family-vault/core/gamification` | Même engine que mobile — déjà utilisé dans Tree.tsx desktop |
| Farm engine | Logique ferme | `@family-vault/core/mascot` | Déjà utilisé dans Tree.tsx + farm-vault.ts desktop |
| File I/O | Accès fichiers direct | `vault-service.ts` (listVaultFiles, readVaultFile, writeVaultFile) | Wrapper Tauri déjà établi |
| Confetti types | `// @ts-ignore` | `@types/canvas-confetti` | Types officiels disponibles |

**Key insight:** Le desktop est en avance sur ce front — Tree.tsx (82KB) démontre que les engines `@family-vault/core` sont 100% réutilisables sans modification. Les nouveaux écrans suivent le même pattern.

---

## Cartographie des 10 écrans manquants

### Inventaire précis

| Écran | Route actuelle | Fichier à créer | Mutations VaultContext à ajouter | Données mobiles source |
|-------|---------------|-----------------|----------------------------------|------------------------|
| RDV | `/rdv` → redirect `/calendar` | `RDV.tsx` + `RDV.css` | addRDV, updateRDV, deleteRDV (signatures dans hooks/useVault.ts:1882-1932) | `app/(tabs)/rdv.tsx` (713 lignes) |
| Notes | manquant | `Notes.tsx` + `Notes.css` | addNote, updateNote, deleteNote (via notesHook) | `app/(tabs)/notes.tsx` (472 lignes) |
| Stats | manquant | `Stats.tsx` + `Stats.css` | aucune mutation — lecture seule | `app/(tabs)/stats.tsx` (328 lignes) |
| Skills | manquant | `Skills.tsx` + `Skills.css` | unlockSkill | `app/(tabs)/skills.tsx` (576 lignes) |
| Health | manquant | `Health.tsx` + `Health.css` | saveHealthRecord, addGrowthEntry, updateGrowthEntry, deleteGrowthEntry, addVaccineEntry | `app/(tabs)/health.tsx` (1123 lignes) |
| Routines | manquant | `Routines.tsx` + `Routines.css` | saveRoutines | `app/(tabs)/routines.tsx` (867 lignes) |
| Pregnancy | manquant | `Pregnancy.tsx` + `Pregnancy.css` | (nouveau — à vérifier dans useVault.ts) | `app/(tabs)/` (si existe) |
| Night-Mode | manquant | `NightMode.tsx` + `NightMode.css` | aucune mutation | mobile night-mode screen |
| Compare | manquant | `Compare.tsx` + `Compare.css` | aucune mutation — lecture seule | mobile compare screen |
| More | manquant | `More.tsx` + `More.css` | aucune mutation | navigation mobile |

### Données existantes dans VaultContext desktop

Le `VaultState` actuel contient déjà :
- `rdvs: RDV[]` — chargé mais sans mutations CRUD
- `notes: Note[]` — chargé mais sans mutations CRUD
- `defis: Defi[]` — chargé mais sans mutations CRUD
- `gratitude: GratitudeDay[]`, `quotes: ChildQuote[]`, `moods: MoodEntry[]` — chargés

Données manquantes dans VaultContext desktop (à ajouter en state + load) :
- `gamiData` — gamification par profil (référencé par Loot mais absent)
- `healthRecords` — santé enfants
- `routines` — séquences routines
- `skillTrees` — arbres compétences par profil
- `pregnancyData` — données grossesse

---

## État des pages existantes avec gaps fonctionnels

| Page | État actuel | Gaps à combler (D-05/D-06) |
|------|------------|---------------------------|
| Loot | Affichage XP/stats OK, ouverture coffre désactivée ("bientôt disponible") | Implémenter openLootBox, animation Framer Motion, confetti, inventaire rewards, collection badges |
| Budget | CRUD dépenses OK, pas d'OCR | Ajouter ReceiptDropZone, pipeline scanReceiptImage(), ReceiptReview modal |
| Challenges | Affichage défis OK | Vérifier si mutations addDefi/checkInDefi/completeDefi manquent |
| Tree | Ferme complète, wear system OK | Vérifier companion picker, sagas, events saisonniers vs mobile |
| Calendar | RDV affiché en lecture seule | Mutations addRDV/updateRDV/deleteRDV manquantes |

---

## Common Pitfalls

### Pitfall 1: VaultContext desktop devenu trop monolithique

**What goes wrong:** Ajouter ~25 mutations directement dans VaultContext.tsx (607 lignes) le rend ingérable à >1500 lignes.
**Why it happens:** Pattern mobile = un hook useVaultInternal() de 3569 lignes — ne pas copier cette erreur sur desktop.
**How to avoid:** Grouper les mutations par domaine dans des fonctions helpers ou des hooks partiels importés dans VaultContext. Exemple : `useRdvMutations(vaultPath, readFile, writeFile, setRdvs)` retourne `{addRDV, updateRDV, deleteRDV}`.
**Warning signs:** VaultContext dépasse 1000 lignes.

### Pitfall 2: Import depuis react-native dans les pages desktop

**What goes wrong:** Copier-coller du code mobile sans nettoyer les imports React Native.
**Why it happens:** Les fichiers mobiles importent `View`, `Text`, `StyleSheet`, `TouchableOpacity` — ces imports crashent en environnement Vite/Web.
**How to avoid:** Toujours partir d'une page desktop existante comme template, jamais d'un fichier mobile. Vérifier `npx tsc --noEmit` après chaque nouvelle page.
**Warning signs:** Erreur TS `Cannot find module 'react-native'`.

### Pitfall 3: Framer Motion + perspective CSS

**What goes wrong:** Utiliser `perspective` dans les transform arrays (même piège que Reanimated mobile).
**Why it happens:** `perspective` en tant que transform est moins bien supporté que `style={{ perspective: 1000 }}` sur le parent.
**How to avoid:** Mettre `perspective` sur le parent container, pas en transform. `<div style={{ perspective: 1000 }}><motion.div style={{ rotateY }}>`
**Warning signs:** Card flip qui clippe ou disparaît à 90°.

### Pitfall 4: canvas-confetti dans Tauri (contexte desktop natif)

**What goes wrong:** canvas-confetti utilise `document.createElement('canvas')` — fonctionne en Tauri WebView mais pas dans un Web Worker.
**Why it happens:** Tauri rend dans une WebView Chromium, donc le DOM standard est disponible.
**How to avoid:** Appeler `confetti()` directement dans les event handlers React — pas dans un worker. `import confetti from 'canvas-confetti'; confetti({ particleCount: 100 });`
**Warning signs:** Aucun — fonctionne en Tauri par défaut.

### Pitfall 5: recharts dans Tauri — SSR et window

**What goes wrong:** recharts suppose `window` disponible — aucun problème en Tauri (pas de SSR), mais attention aux imports conditionnels.
**Why it happens:** Vite peut bundler pour différentes cibles.
**How to avoid:** Import direct sans lazy loading pour recharts en Tauri/Vite. `import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';`
**Warning signs:** Erreur `window is not defined` — pas attendue en Tauri.

### Pitfall 6: Serialization différente entre desktop et mobile

**What goes wrong:** Une mutation desktop sauvegarde dans un format légèrement différent et casse la lecture mobile.
**Why it happens:** Le desktop a parfois des mutations locales (comme dans Budget.tsx) qui réimplémentent la sérialisation plutôt que d'utiliser `@family-vault/core`.
**How to avoid:** Toujours utiliser les fonctions `serialize*` de `@family-vault/core` pour toutes les écritures vault. Vérifier que le fichier écrit est lisible par `parse*` du même core.
**Warning signs:** Données visibles sur desktop mais absentes sur mobile (ou vice versa).

### Pitfall 7: Chargement des données manquantes pour les nouveaux écrans

**What goes wrong:** La page Health est créée mais `healthRecords` n'est pas dans VaultState — la page affiche toujours vide.
**Why it happens:** VaultContext desktop charge seulement ce qu'il connaît — les nouveaux types de données doivent être ajoutés à `loadSecondaryData()`.
**How to avoid:** Pour chaque nouvel écran, vérifier si ses données sont déjà dans VaultState. Sinon, ajouter le state + le loader dans VaultContext AVANT de créer la page.
**Warning signs:** `undefined` ou `[]` pour toutes les données d'un nouvel écran.

---

## Code Examples

### Recharts — BarChart pour Stats (équivalent mobile BarChart)

```typescript
// Source: recharts documentation + équivalent de components/charts/BarChart.tsx mobile
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartData { label: string; value: number; }

function DesktopBarChart({ data, color = 'var(--primary)' }: { data: ChartData[]; color?: string }) {
  const formatted = data.map(d => ({ name: d.label, value: d.value }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={formatted} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Framer Motion — loot box card reveal

```typescript
// Source: D-03 + D-05 decisions
import { motion, AnimatePresence } from 'framer-motion';

const RARITY_GLOW: Record<string, string> = {
  commun: '0 0 8px rgba(100,100,100,0.4)',
  rare:   '0 0 16px rgba(59,130,246,0.6)',
  epique: '0 0 24px rgba(168,85,247,0.8)',
  legendaire: '0 0 32px rgba(245,158,11,1.0)',
};

function LootCard({ reward, onClose }: { reward: LootBox; onClose: () => void }) {
  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.1 }}
        style={{ boxShadow: RARITY_GLOW[reward.rarity] }}
        className="loot-card"
        onClick={onClose}
      >
        <span className="loot-card-emoji">{reward.emoji}</span>
        <span className="loot-card-name">{reward.name}</span>
      </motion.div>
    </div>
  );
}
```

### canvas-confetti — célébration level up

```typescript
// Source: canvas-confetti documentation
import confetti from 'canvas-confetti';

function triggerLevelUpConfetti() {
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#7C3AED', '#EDE9FE', '#F59E0B', '#FFFFFF'],
  });
}

// Usage dans openLootBox handler
async function handleOpenLoot(profile: Profile) {
  const result = await openLootBox(profile);
  if (result.leveledUp) {
    triggerLevelUpConfetti();
  }
  setRevealedReward(result.reward);
}
```

### Ajout d'une mutation dans VaultContext desktop

```typescript
// Source: pattern toggleTask dans apps/desktop/src/contexts/VaultContext.tsx
// Référence mobile: hooks/useVault.ts:1882-1932 (addRDV, updateRDV, deleteRDV)
import { serializeRDV } from '@family-vault/core';

const addRDV = useCallback(
  async (rdv: Omit<RDV, 'sourceFile' | 'title'>) => {
    if (!vaultPath) return;
    try {
      const date = rdv.date ?? new Date().toISOString().slice(0, 10);
      const [year, month] = date.split('-');
      const fileName = `RDV-${rdv.type ?? 'autre'}-${date}-${Date.now()}.md`;
      const relPath = `04 - Rendez-vous/${year}/${month}/${fileName}`;
      const content = serializeRDV(rdv);
      await writeVaultFile(`${vaultPath}/${relPath}`, content);
      const newRdv: RDV = { ...rdv, sourceFile: relPath, title: fileName };
      setRdvs(prev => [...prev, newRdv]);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Erreur addRDV:', e);
    }
  },
  [vaultPath],
);
```

### Route supplémentaire dans App.tsx

```typescript
// Source: pattern existant App.tsx (apps/desktop/src/App.tsx)
// 1. Lazy import
const RDV = lazy(() => import('./pages/RDV'));
const Notes = lazy(() => import('./pages/Notes'));
const Stats = lazy(() => import('./pages/Stats'));

// 2. NAV_SECTIONS — section Famille
{ path: '/rdv', label: 'Rendez-vous', icon: '📅' }  // remplacer redirect existant

// 3. Route (remplacer la Navigate existante)
<Route path="/rdv" element={<RDV />} />
```

---

## Ordre d'implémentation recommandé (à confirmer par le planner)

L'ordre logique suit les dépendances — les mutations VaultContext d'abord car tous les écrans CRUD en dépendent :

**Wave 0 — Infrastructure (bloquant):**
- Ajouter framer-motion, recharts, canvas-confetti à `apps/desktop/package.json`
- Étendre VaultContext : state manquant (gamiData, healthRecords, routines, skillTrees) + mutations D-06

**Wave 1 — Écrans CRUD (dépendent des mutations):**
- RDV (addRDV/updateRDV/deleteRDV) — plus simple à implémenter, duplique Calendar
- Notes (addNote/updateNote/deleteNote)
- Health (saveHealthRecord + variants)
- Skills (unlockSkill)
- Routines (saveRoutines)

**Wave 2 — Écrans lecture seule + animations:**
- Stats (recharts, pas de mutations)
- Loot (openLootBox + animation Framer Motion + confetti)
- Budget OCR (drag & drop + scanReceiptImage)

**Wave 3 — Écrans spécialisés:**
- Pregnancy
- Night-Mode
- Compare
- More (menu)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-router v6 `<Switch>` | react-router v7 `<Routes>` (déjà utilisé) | 2024 | Déjà correct dans App.tsx |
| framer-motion v10 (breaking API) | framer-motion v12 (motion.div simplifié) | 2025 | API stable, pas de breaking change v11→v12 |
| recharts v2 (breaking API) | recharts v3 (ResponsiveContainer obligatoire) | 2024 | Toujours wrapper avec ResponsiveContainer |
| canvas-confetti v1 | canvas-confetti v1.9.4 (stable) | — | API inchangée |

**Deprecated/outdated:**
- `<Swipeable>` de react-native-gesture-handler : remplacé par `<ReanimatedSwipeable>` sur mobile. Desktop n'utilise ni l'un ni l'autre — utiliser hover+button.
- `perspective` dans transform array : remplacé par `style={{ perspective }}` sur parent — règle valide Reanimated mobile ET Framer Motion desktop.

---

## Open Questions

1. **Pregnancy screen existe-t-il sur mobile ?**
   - What we know: `app/(tabs)/` n'a pas de `pregnancy.tsx` visible dans la liste des fichiers mobiles de référence CONTEXT.md
   - What's unclear: L'écran Pregnancy est peut-être dans un autre répertoire ou sous un nom différent
   - Recommendation: Vérifier `ls app/(tabs)/` — si absent, implémenter une version minimale basée sur `lib/pregnancy.ts` dans `@family-vault/core`

2. **Budget : serializeRDV vs format de fichier RDV**
   - What we know: `parseRDV()` existe dans `@family-vault/core`, mais `serializeRDV()` doit être vérifié dans le core
   - What's unclear: Si serializeRDV existe dans le core ou doit être ajouté
   - Recommendation: Vérifier `packages/core/src/parser.ts` pour serializeRDV avant d'implémenter addRDV

3. **gamiData dans VaultContext desktop**
   - What we know: Tree.tsx desktop accède aux données gami via le profile (points, coins, level) mais pas via un objet gamiData structuré
   - What's unclear: Le Loot desktop a besoin de `gamiData` pour openLootBox — doit-on charger gami-{id}.md dans VaultContext ?
   - Recommendation: Oui — ajouter `gamiData: Record<string, GamificationData>` dans VaultState desktop, similaire au chargement par profil dans `loadProfiles()`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | via projet | — |
| framer-motion | D-03 animations | ✗ (à installer) | 12.38.0 | CSS transitions pour animations simples uniquement |
| recharts | Stats screen | ✗ (à installer) | 3.8.1 | — |
| canvas-confetti | D-05 confetti | ✗ (à installer) | 1.9.4 | CSS @keyframes basique |
| @family-vault/core | Tous les écrans | ✓ | * (workspace) | — |
| @tauri-apps/plugin-fs | File I/O vault | ✓ | ^2 | — |

**Missing dependencies with no fallback:**
- recharts (Stats screen non implémentable sans charts)

**Missing dependencies with fallback:**
- framer-motion (animations importantes mais CSS peut couvrir les cas simples)
- canvas-confetti (nice-to-have — célébrations)

---

## Project Constraints (from CLAUDE.md)

Directives applicables au desktop dans cette phase :

- **Couleurs** : toujours utiliser les CSS variables de `tokens.css` (`var(--primary)`, `var(--text)`) — jamais de hex hardcodés
- **TypeScript strict** : `npx tsc --noEmit` doit passer sans nouvelles erreurs après chaque plan
- **Langue UI** : français — textes UI en français, pas de texte hardcodé (utiliser les namespaces i18next)
- **Animations** : react-native-reanimated interdit sur desktop — utiliser Framer Motion + CSS transitions
- **Swipe dans ScrollView** : ne s'applique pas au desktop (HTML natif) — utiliser hover menus et drag & drop HTML5
- **Architecture** : VaultContext comme source unique d'état — pas de state global alternatif (Redux, Zustand)
- **Fichiers publics** : jamais de noms personnels réels dans les commits — utiliser des génériques (Lucas, Emma, Dupont)
- **Validation** : `npx tsc --noEmit` (pas de test suite) — `nyquist_validation: false` confirmé dans config.json

---

## Sources

### Primary (HIGH confidence)
- `apps/desktop/src/` — Analyse directe du code source existant (App.tsx, VaultContext.tsx, Budget.tsx, Tree.tsx, Loot.tsx, styles/)
- `packages/core/src/` — Inventaire complet des parsers/engines disponibles (index.ts, gamification/, mascot/)
- `hooks/useVault.ts:3540-3567` — Liste complète des mutations mobiles disponibles pour référence
- `apps/desktop/package.json` — Dépendances actuelles desktop

### Secondary (MEDIUM confidence)
- npm view framer-motion version → 12.38.0 (vérifié en direct)
- npm view recharts version → 3.8.1 (vérifié en direct)
- npm view canvas-confetti version → 1.9.4 (vérifié en direct)
- npm view @types/canvas-confetti version → 1.9.0 (vérifié en direct)

### Tertiary (LOW confidence)
- Aucune — toutes les claims critiques vérifiées sur le code source du projet

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — dépendances vérifiées en direct avec npm view
- Architecture: HIGH — patterns analysés directement sur le code source existant
- Pitfalls: HIGH — basés sur le code source existant (VaultContext, Tree.tsx, Budget.tsx)
- Inventaire 10 écrans: HIGH — basé sur App.tsx routes + CONTEXT.md D-01

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable — recharts/framer-motion/canvas-confetti ont des APIs stables)
