# Phase 51 : UX export + manuel Lulu + non-régression — Research

**Researched:** 2026-05-05
**Domain:** UX wiring (modals, screens, sharing, in-app PDF preview, i18n FR)
**Confidence:** HIGH (stack interne vérifié) — MEDIUM sur specs Lulu (URL non documentée)

## Summary

Phase 51 ne touche à aucun moteur (pipeline PDF Phase 49 + QR Phase 50 sont stables et exposés via `lib/pdf/index.ts`). Le travail est **pur wiring UX** : création d'un écran dédié (`app/impressions.tsx`), de deux modals chaînés (`BookExportModal` → écran post-export), et d'un manuel Lulu en français. Toutes les briques d'infrastructure existent déjà côté lib (`generateBookPdf`, `persistBookPdf`, `parseManifeste`, deep link router). i18next + react-i18next sont en place avec namespace pattern (`common`, `gamification`, etc.) — il faut ajouter un namespace `impressions`.

Trois décisions techniques structurantes :
1. **Aperçu PDF in-app** : `expo-print` génère déjà le PDF complet — ré-utiliser `Print.printAsync({ uri })` pour l'aperçu natif iOS (zéro dépendance ajoutée, expérience native-grade).
2. **Sauvegarde** : ajouter `expo-sharing` (~14.0.x pour SDK 54) — déclenche le Share Sheet iOS standard.
3. **Bouton Lulu** : `Linking.openURL('https://www.lulu.com/create/print-books/')` + modal d'instructions FR détaillée (Lulu n'accepte pas de query params pour pré-remplir).

**Primary recommendation:** ZÉRO `react-native-pdf` ni WebView. Utiliser `Print.printAsync({ uri })` pour l'aperçu (natif, déjà installé, pas de rebuild) + `Sharing.shareAsync(uri)` pour la sauvegarde + `Linking.openURL(uri)` pour le bouton "Voir". La modal d'aperçu affiche un **skeleton + métadonnées** (titre, format, nb pages, hash court) pendant la génération, puis un bouton "Aperçu plein écran" qui appelle `Print.printAsync`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Entry point** : écran dédié "Mes impressions" (PAS long-press menu saga, PAS écran fin génération). Accessible depuis `app/(tabs)/more.tsx`.
- **Aperçu PDF** : génération complète à l'ouverture du modal (~3-5s budget perf), affichage via visualiseur natif (lib choice = discrétion planner).
- **Bouton Lulu** : `Linking.openURL('https://www.lulu.com/create/print-books/')` + modal d'instructions FR (pas d'API Lulu Direct).
- **Post-export** : écran dédié avec 3 actions (Sauvegarder via expo-sharing, Voir le PDF, Commander chez Lulu). Drag-to-dismiss. Haptic Medium au succès.
- **Manifeste** : `persistBookPdf` (Phase 49) écrit déjà → Phase 51 = lecture pure dans l'écran "Mes impressions".
- **i18n** : FR strict, namespace `impressions`, haptic Medium succès / Light tap.
- **Docs CLAUDE.md** : ajouter `expo-print`, `expo-sharing`, `qrcode`, `expo-clipboard` au Stack ; `lib/pdf/` à Architecture ; `12 - Impressions/` au Vault.

### Claude's Discretion

- Choix exact lib aperçu PDF (`react-native-pdf` vs WebView vs `expo-print.printAsync` mode preview) — **recommandation Phase 51 : `Print.printAsync({ uri })` natif, voir Section 1**.
- Layout exact écran "Mes impressions" (cards / table / timeline) — **recommandation : cards verticales scrollables, voir Section 3**.
- Position bouton "Générer" (FAB / header / inline) — **recommandation : header CTA primaire + état vide actionnable**.

### Deferred Ideas (OUT OF SCOPE)

- Long-press menu cartes saga + bouton fin génération histoire
- Lulu Direct API (création commande automatique)
- Aperçu via snapshots images pré-générés
- Partage social direct (Instagram, etc.)
- Email auto avec PDF en pièce jointe
- Multi-langues UI (en, es) — FR strict
- Statistiques exports dans le manifeste

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Écran "Mes impressions" accessible depuis menu Plus | Section 3 (manifest list UI) + Section 8 (more.tsx integration) |
| UX-02 | `BookExportModal` aperçu + générer + drag-to-dismiss | Section 1 (PDF preview) + Section 4 (modal stack) + Section 7 (perf UX) |
| UX-03 | Écran post-export 3 actions | Section 2 (expo-sharing) + Section 4 (modal chain) + Section 5 (Lulu) |
| UX-04 | Manifeste affiché dans "Mes impressions" | Section 3 (lecture `parseManifeste`) |
| UX-05 | i18n FR strict + haptic | Section 6 (i18next) |
| UX-06 | Manuel Lulu FR | Section 5 (specs + URL canonique) |
| QA-01 | tsc + jest verts | Pas de tests lourds — wiring UI pur |
| QA-02 | CLAUDE.md mis à jour | Section 9 (gating dev-deep-link) + ajouts CLAUDE.md |
| QA-03 | Non-régression device | Section 9 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Liste exports | Screen (`app/impressions.tsx`) | `lib/pdf/manifest-parser` | Lecture pure du manifeste vault |
| Génération PDF | `lib/pdf/pdf-generator` (existant) | — | Déjà encapsulé Phase 49 |
| Aperçu PDF | Modal (`BookExportModal`) → `expo-print.printAsync` | OS natif iOS (QLPreviewController) | Présentation, pas de stockage |
| Sauvegarde fichier | `expo-sharing.shareAsync` | OS UIActivityViewController | Délégué OS |
| Lien Lulu | `Linking.openURL` + `LuluInstructionsModal` | Browser système | Pas d'API |
| Manifeste write | `lib/pdf/book-storage.persistBookPdf` (existant) | VaultManager | Phase 51 = read-only |
| Deep link story | `app/story/[id].tsx` (existant Phase 50) | — | Hors scope Phase 51 |
| i18n | `lib/i18n.ts` + `locales/fr/impressions.json` | `react-i18next` | Convention projet |

## Standard Stack

### Core (déjà installé)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-print` | ~15.0.8 | Génération + aperçu PDF natif | Déjà utilisé Phase 49 [VERIFIED: package.json] |
| `expo-clipboard` | ~8.0.8 | (existant) | Pas requis Phase 51 |
| `react-i18next` | ^16.6.0 | i18n | Pattern projet établi [VERIFIED: package.json] |
| `i18next` | ^25.10.2 | i18n moteur | [VERIFIED: package.json] |
| `react-native-reanimated` | ~4.1 | Drag-to-dismiss + animations | Convention projet [VERIFIED: CLAUDE.md] |
| `expo-haptics` | (installé) | Feedback tactile | Convention projet |
| `lucide-react-native` | (installé) | Icônes | Convention projet |
| `expo-router` | v6 | Navigation `app/impressions.tsx` | Stack projet |

### Supporting (à ajouter)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-sharing` | ~14.0.8 (SDK 54) | Share Sheet iOS — sauvegarde PDF | Action "Sauvegarder" écran post-export [VERIFIED: npm view expo-sharing] |

**Vérification version :** `npm view expo-sharing version` → `14.0.8` est la dernière compatible SDK 54 (latest npm = `15.0.7` mais aligné SDK 55). Utiliser `npx expo install expo-sharing` qui résout automatiquement la version SDK-compatible.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Print.printAsync({ uri })` | `react-native-pdf` 7.0.4 | + : preview embarqué dans modal RN ; − : Pods natifs, **rebuild dev-client requis**, +1MB bundle, gestion mémoire WKWebView pour PDFs >5MB |
| `Print.printAsync({ uri })` | `WebView source={{ uri: 'data:application/pdf;base64,...' }}` | + : zéro dépendance ; − : iOS WKWebView refuse data URIs >5MB, conversion base64 = +33% mémoire, rendu PDF imparfait sur iOS |
| `Print.printAsync({ uri })` | `Linking.openURL(uri)` | + : zéro overhead ; − : sort de l'app (Files / Books), pas d'aperçu in-modal |

**Recommandation finale : `Print.printAsync({ uri })`** — déjà installé, ouvre le QLPreviewController natif iOS (l'utilisateur reste dans le contexte de l'app via présentation modale système), zéro rebuild, gère nativement les PDFs lourds, expose impression physique gratuite en bonus.

**Installation :**
```bash
npx expo install expo-sharing
# Puis npx expo prebuild si pas déjà fait — l'utilisateur est en cours de rebuild dev-client
```

## Architecture Patterns

### System Architecture Diagram

```
                          ┌────────────────────────┐
  app/(tabs)/more.tsx ──▶ │ Row "Mes impressions"  │
                          └────────────┬───────────┘
                                       │ router.push('/impressions')
                                       ▼
              ┌──────────────────────────────────────────────┐
              │ app/impressions.tsx                          │
              │ ─────────────────                            │
              │ - parseManifeste(vault.readFile)             │
              │ - Liste cards (titre, date, hash court)      │
              │ - Tap card → Print.printAsync({uri: chemin}) │
              │ - CTA "Nouveau livre" → BookExportModal      │
              │ - Pull-to-refresh re-parse manifeste         │
              └──────────────┬───────────────────────────────┘
                             │ ouvre Modal pageSheet
                             ▼
              ┌──────────────────────────────────────────────┐
              │ <BookExportModal>                            │
              │ ─────────────────                            │
              │ 1. Sélection histoire (liste vault.stories)  │
              │ 2. État "génération…" → spinner + étapes     │
              │ 3. generateBookPdf() + persistBookPdf()      │
              │ 4. Affiche métadonnées (titre/format/hash)   │
              │ 5. Bouton "Aperçu" → Print.printAsync(uri)   │
              │ 6. Bouton "Continuer" → écran post-export    │
              └──────────────┬───────────────────────────────┘
                             │ replace navigation
                             ▼
              ┌──────────────────────────────────────────────┐
              │ <PostExportScreen> (modal)                   │
              │ ─────────────────                            │
              │ ✅ Haptic Medium succès au mount             │
              │ [Sauvegarder] → Sharing.shareAsync(uri)      │
              │ [Voir]        → Print.printAsync({uri})      │
              │ [Lulu]        → LuluInstructionsModal        │
              └──────────────────────────────────────────────┘
                                       │ via Lulu button
                                       ▼
                          ┌──────────────────────────┐
                          │ <LuluInstructionsModal>  │
                          │ FR strict, étapes 1-5    │
                          │ + CTA "Ouvrir Lulu"      │
                          │   → Linking.openURL      │
                          └──────────────────────────┘
```

### Recommended Project Structure

```
app/
├── impressions.tsx                  # NEW — écran liste manifeste + CTA générer
└── (tabs)/more.tsx                  # MODIFIED — ajout row "Mes impressions"

components/
└── pdf/                             # NEW — barrel UI export
    ├── BookExportModal.tsx          # 51-01 — modal sélection + génération + aperçu
    ├── PostExportScreen.tsx         # 51-03 — 3 actions (sauvegarder/voir/Lulu)
    ├── LuluInstructionsModal.tsx    # 51-03 — manuel FR
    ├── ExportCard.tsx               # 51-02 — item liste manifeste
    └── index.ts                     # barrel

locales/fr/
└── impressions.json                 # NEW — namespace i18n

locales/en/
└── impressions.json                 # NEW — namespace mirror (clés EN ou FR si projet mono-langue effectif)

lib/i18n.ts                          # MODIFIED — ajout namespace `impressions`
CLAUDE.md                            # MODIFIED — Stack/Architecture/Vault
```

### Pattern 1 : Modal pageSheet drag-to-dismiss (convention projet)

```tsx
// Source: components/AnniversaryEditor.tsx:140-146 + components/RDVEditor.tsx:514-518
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="pageSheet"   // drag-to-dismiss natif iOS
  onRequestClose={onClose}        // Android back + drag end iOS
>
  <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
    <ModalHeader
      title={t('impressions.export.title')}
      onClose={onClose}
      rightLabel={t('common.next')}
      onRight={handleNext}
      rightDisabled={busy}
    />
    {/* contenu */}
  </SafeAreaView>
</Modal>
```

### Pattern 2 : Génération PDF + persistence (existant, à réutiliser)

```tsx
// Source: app/dev-deep-link.tsx:76-105 (à reproduire dans BookExportModal)
import { generateBookPdf, persistBookPdf } from '../../lib/pdf';

const result = await generateBookPdf({ story, allStories: stories });
const persisted = await persistBookPdf(vaultManager, result.uri, result.entry);
// result.uri = cache app PDF (à utiliser pour Print.printAsync / Sharing)
// persisted.chemin = chemin vault permanent (pour re-ouverture future)
```

### Pattern 3 : Aperçu PDF natif iOS

```tsx
// Source: docs.expo.dev/versions/latest/sdk/print/
import * as Print from 'expo-print';

async function previewPdf(uri: string) {
  try {
    await Print.printAsync({ uri });
    // Sur iOS : ouvre QLPreviewController + UIPrintInteractionController
    // L'utilisateur peut zoomer, paginer, AirPrint, ou fermer
  } catch (err) {
    // L'utilisateur a annulé OU printer non disponible (non-bloquant)
    if (__DEV__) console.warn('[preview]', err);
  }
}
```

**Note iOS :** `Print.printAsync({ uri })` ouvre le **dialog d'impression natif** qui inclut un aperçu plein écran. C'est l'expérience standard iOS pour visualiser un PDF généré. Pour une visualisation pure sans le bouton "Imprimer", `Linking.openURL(uri)` ouvre dans Files.app/Books.app. Le projet privilégie `Print.printAsync` (cohérence avec la sémantique "livre imprimable").

### Pattern 4 : Sharing iOS Share Sheet

```tsx
// Source: docs.expo.dev/versions/latest/sdk/sharing/
import * as Sharing from 'expo-sharing';

async function savePdf(uri: string, storyTitle: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(t('common.error'), t('impressions.errors.sharingUnavailable'));
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: t('impressions.share.dialogTitle', { title: storyTitle }),
  });
  // iOS : UIActivityViewController → Files, AirDrop, Mail, Messages, Books, etc.
  // Android : ACTION_SEND intent
}
```

### Pattern 5 : i18n namespace (convention projet)

```tsx
// Source: lib/i18n.ts:11 + components/AnniversaryEditor.tsx:132
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// Namespaces existants : common (default), gamification, help, insights, skills, codex
// Phase 51 : ajouter `impressions`
t('impressions.list.empty')               // si namespace courant
t('impressions:list.empty')               // explicite cross-namespace
```

```ts
// lib/i18n.ts — modification 51-03
import frImpressions from '../locales/fr/impressions.json';
import enImpressions from '../locales/en/impressions.json';

i18n.use(initReactI18next).init({
  // …
  ns: ['common', 'gamification', 'help', 'insights', 'skills', 'codex', 'impressions'],
  resources: {
    fr: { /* … */ impressions: frImpressions },
    en: { /* … */ impressions: enImpressions },
  },
  // …
});
```

### Anti-Patterns to Avoid

- **WebView base64 data URI** : taille mémoire prohibitive (PDF 5MB → string 6.7MB → encodage base64 → décodage WKWebView). Sur iOS, WKWebView refuse silencieusement les data URIs PDF >5MB.
- **`react-native-pdf`** : Pods natifs → rebuild dev-client (déjà en cours actuellement pour autre chose), +1MB bundle, problèmes connus avec New Architecture SDK 54. Non justifié pour un usage d'aperçu unique.
- **Re-générer PDF à chaque ouverture du modal** : si le PDF est déjà persistant dans le vault (manifeste), passer le chemin existant à l'aperçu. Génération uniquement si nouveau livre demandé.
- **Animer la liste avec `Animated`** : utiliser `react-native-reanimated` (CLAUDE.md), shared values + `withSpring` cf. SPRING_CONFIG.
- **Hardcoder couleurs** : `useThemeColors()` toujours (CLAUDE.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aperçu PDF in-app | WebView custom + base64 | `Print.printAsync({ uri })` | Native QLPreviewController gère gestures, zoom, mémoire, AirPrint |
| Share Sheet iOS | UIActivityViewController bridge | `expo-sharing` | API stable, multi-OS, déjà testé Expo SDK |
| Modal drag-to-dismiss | Pan gesture custom | `presentationStyle="pageSheet"` | Native iOS, accessibility-friendly, déjà convention projet |
| Liste manifeste | Custom file watcher | Pull-to-refresh + re-parse | Manifeste petit (<100 entrées attendues), pas de besoin temps-réel |
| Format Lulu validation | Custom rules engine | Manuel d'instructions FR statique | Lulu Studio fait la validation côté upload |

**Key insight:** Phase 51 = pur wiring. Toute logique métier vit déjà dans `lib/pdf/`. Phase 51 ajoute uniquement des écrans, modals et un namespace i18n.

## Section 1 — Aperçu PDF in-app (analyse approfondie)

### Comparatif des 3 options

| Critère | `Print.printAsync({ uri })` ⭐ | `react-native-pdf` | WebView data URI |
|---------|-------------------------------|--------------------|-----------------|
| Dépendance ajoutée | **Aucune** (déjà installé) | Pods natifs + rebuild | Aucune (`react-native-webview` déjà transitive) |
| Rebuild dev-client | Non | **Oui** | Non |
| Bundle size | 0 | +~1 MB | 0 |
| Mémoire pour PDF 5 MB | Native (négligeable) | ~10 MB JS bridge | **~13 MB string base64** |
| iOS PDF >5 MB | OK natif | OK | **❌ WKWebView crash silencieux** |
| Android | Print framework natif | OK | OK plus permissif |
| Expérience UX | QLPreviewController natif (zoom, pages, AirPrint) | Embedded RN view (custom UI) | Embedded WebView |
| Quitte le contexte app | Modal système (revient automatiquement) | Non | Non |
| Boutons custom dans le viewer | Non | Oui | Oui |
| Cohérence avec "livre imprimable" | **Excellente** | OK | Faible |

### Recommandation finale : `Print.printAsync({ uri })`

**Pourquoi :**
1. **Zéro nouveau code natif** — l'utilisateur est en cours de rebuild dev-client pour `expo-print`/`expo-clipboard` Phase 50 ; ajouter `react-native-pdf` allongerait ce cycle inutilement.
2. **Sémantique alignée** — le livre est un objet d'impression Lulu ; offrir l'aperçu via le dialog d'impression natif (qui propose AirPrint en bonus) renforce la métaphore.
3. **PDFs FamilyVault sont lourds** (~2-5 MB avec illustrations forêt 2480×2480 inlined base64) → WebView data URI risqué, `react-native-pdf` lourd ; QLPreviewController natif gère sans broncher.
4. **Pas de gestion d'état complexe** — l'utilisateur ouvre, regarde, ferme. La modal `BookExportModal` reprend la main automatiquement après dismiss du dialog système.

### Snippet d'intégration `BookExportModal`

```tsx
// components/pdf/BookExportModal.tsx
import { useState } from 'react';
import { Modal, View, Text, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { generateBookPdf, persistBookPdf } from '../../lib/pdf';
import { useVault } from '../../contexts/VaultContext';
import type { BedtimeStory } from '../../lib/types';

interface Props {
  visible: boolean;
  story: BedtimeStory;
  onClose: () => void;
  onSuccess: (uri: string, storyTitle: string) => void;  // → naviguer vers PostExportScreen
}

type ExportPhase = 'idle' | 'generating' | 'ready' | 'error';

export function BookExportModal({ visible, story, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { stories, vault: vaultManager } = useVault();
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [perfMs, setPerfMs] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!vaultManager) return;
    setPhase('generating');
    try {
      const result = await generateBookPdf({ story, allStories: stories });
      await persistBookPdf(vaultManager, result.uri, result.entry);
      setPdfUri(result.uri);
      setPerfMs(result.perf.totalMs);
      setPhase('ready');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setPhase('error');
      Alert.alert(t('impressions.errors.generationTitle'), String(err));
    }
  };

  const handlePreview = async () => {
    if (!pdfUri) return;
    Haptics.selectionAsync();
    try {
      await Print.printAsync({ uri: pdfUri });
    } catch { /* user cancel — non-bloquant */ }
  };

  const handleContinue = () => {
    if (!pdfUri) return;
    onSuccess(pdfUri, story.titre);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* SafeAreaView + ModalHeader + body conditionnel selon phase */}
    </Modal>
  );
}
```

## Section 2 — expo-sharing

**Installé ?** ❌ NON (`grep expo-sharing package.json` vide). À ajouter en 51-03.

**Installation :**
```bash
npx expo install expo-sharing
# Résout automatiquement la version SDK 54 (~14.0.8)
```

**API minimale Phase 51 :**

```ts
import * as Sharing from 'expo-sharing';

// Vérification disponibilité (gracieux, recommandé)
const available = await Sharing.isAvailableAsync(); // true sur iOS/Android, false sur web
if (!available) {
  Alert.alert(t('impressions.errors.sharingUnavailable'));
  return;
}

await Sharing.shareAsync(pdfUri, {
  mimeType: 'application/pdf',
  UTI: 'com.adobe.pdf',                                          // iOS — identification PDF
  dialogTitle: `Sauvegarder "${storyTitle}"`,                    // Android intent title
});
```

**Pitfall iOS connu :** `Mail.app` est parfois absente du Share Sheet pour les PDFs (issue #7991 expo/expo). Mitigation : si l'utilisateur veut envoyer par mail, il peut passer par "Files" → Mail. Documenter dans le manuel Lulu si pertinent (probablement non — l'utilisateur upload directement sur lulu.com).

**Pitfall Android :** sur certains devices, l'intent expose seulement les apps qui déclarent `application/pdf` dans leur manifest. Comportement attendu, pas de mitigation app-side.

## Section 3 — Liste manifeste UI

### Pattern recommandé : cards verticales scrollables + pull-to-refresh

```tsx
// app/impressions.tsx (squelette)
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import { useTranslation } from 'react-i18next';
import { useVault } from '../contexts/VaultContext';
import { useThemeColors } from '../contexts/ThemeContext';
import { parseManifeste, MANIFESTE_FILE } from '../lib/pdf/manifest-parser';
import type { BookManifestEntry } from '../lib/pdf/types';
import { BookExportModal } from '../components/pdf/BookExportModal';
import { ExportCard } from '../components/pdf/ExportCard';

export default function ImpressionsScreen() {
  const { t } = useTranslation();
  const { vault, stories } = useVault();
  const { colors } = useThemeColors();
  const [entries, setEntries] = useState<BookManifestEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exportModal, setExportModal] = useState<{ open: boolean; story?: BedtimeStory }>({ open: false });

  const loadManifeste = useCallback(async () => {
    if (!vault) return;
    try {
      const raw = await vault.readFile(MANIFESTE_FILE);
      setEntries(parseManifeste(raw));
    } catch {
      // Manifeste absent (premier export pas encore fait) → liste vide
      setEntries([]);
    }
  }, [vault]);

  useEffect(() => { loadManifeste(); }, [loadManifeste]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadManifeste();
    setRefreshing(false);
  }, [loadManifeste]);

  const openPdf = async (entry: BookManifestEntry) => {
    if (!vault) return;
    // Construire URI complet à partir du chemin relatif manifeste
    const fullUri = `${vault.vaultPath.replace(/\/$/, '')}/${entry.chemin}`;
    const uri = fullUri.startsWith('file://') ? fullUri : `file://${fullUri}`;
    try {
      await Print.printAsync({ uri });
    } catch (err) {
      Alert.alert(t('impressions.errors.openTitle'), String(err));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header avec CTA "Nouveau livre" */}
      {/* ScrollView + RefreshControl */}
      {entries.length === 0
        ? <EmptyState onCreate={() => setExportModal({ open: true })} />
        : entries.map(e => (
            <ExportCard
              key={`${e.id}-${e.date}`}
              entry={e}
              storyTitle={stories.find(s => s.id === e.id)?.titre ?? e.id}
              onPress={() => openPdf(e)}
            />
          ))}
      <BookExportModal
        visible={exportModal.open}
        story={exportModal.story!}
        onClose={() => { setExportModal({ open: false }); loadManifeste(); }}
        onSuccess={(uri, title) => router.push({ pathname: '/post-export', params: { uri, title } })}
      />
    </SafeAreaView>
  );
}
```

### ExportCard — données affichées

| Champ | Source | Format affiché |
|-------|--------|----------------|
| Titre histoire | `stories.find(s => s.id === entry.id)?.titre` | "Le voyage de Lucas" |
| Date export | `entry.date` (YYYY-MM-DD) | "04/05/2026" (JJ/MM/AAAA cf. CLAUDE.md) |
| Format | `entry.format` | "Lulu 21×21" |
| Hash court | `entry.hash.slice(0, 8)` | "a3f9c2b1" |
| Action | tap card | `Print.printAsync({ uri })` |

**Empty state :** "Aucun livre exporté pour le moment. Crée ton premier livre imprimable !" + CTA "Nouveau livre".

### Reconstruction URI vault

Important : `entry.chemin` est relatif (`12 - Impressions/PDFs/{id}-{date}.pdf`). Pour `Print.printAsync({ uri })` il faut un URI absolu `file://`. Reproduire la logique de `book-storage.ts:72-92` (`buildVaultUri`) — ou exporter cette fonction dans `lib/pdf/book-storage.ts` (refactor mineur si manquant). **Recommandation 51-02 : ajouter export `buildVaultPdfUri(vault, entry)` dans `book-storage.ts` pour éviter la duplication.**

## Section 4 — Modal stack architecture

### Problème

Phase 51 a 2 modals successives :
1. `BookExportModal` — sélection histoire + génération + aperçu PDF
2. Écran post-export — 3 actions

### Trois options envisagées

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Modal pageSheet → replace contenu interne | 1 seul `<Modal>` avec phase state machine (`select` → `generating` → `ready` → `post-export`) | ✅ **Recommandé** |
| B. Modal pageSheet ouvre 2e Modal pageSheet | Nesting `<Modal>` dans `<Modal>` | ⚠️ Comportement iOS imprévisible (animation conflict, drag-to-dismiss bug) |
| C. Route stack `app/post-export.tsx` accessible via `router.push` | Modal close + navigate vers route dédiée | ✅ **Acceptable alternative** — propre mais double animation transition |

### Recommandation : Option A (state machine interne)

Un seul `<Modal>` `BookExportModal` qui gère 4 phases :

```tsx
type ExportPhase =
  | { kind: 'select' }                                          // sélection histoire
  | { kind: 'generating'; step: 'assets'|'render'|'hash'|'print' }  // spinner + étape
  | { kind: 'ready'; uri: string; perfMs: number }              // aperçu CTA
  | { kind: 'post-export'; uri: string; storyTitle: string };   // 3 actions
```

**Avantages :**
- Une seule modal pageSheet → drag-to-dismiss cohérent
- Transitions internes fluides via `react-native-reanimated` (`withSpring` cross-fade)
- Pas de `router.push` qui complique le retour à la liste manifeste

**ModalHeader dynamique** par phase (titre + boutons droite changent selon `phase.kind`).

### Alternative Option C — si l'écran post-export devient trop riche

Si la doc Lulu, le partage, et 3+ actions deviennent ingérables dans un seul `<Modal>`, séparer en `app/post-export.tsx` (modal full screen via `presentation: 'modal'` dans `_layout.tsx` Stack.Screen).

```tsx
// app/_layout.tsx — ajout dans Stack
<Stack.Screen
  name="post-export"
  options={{ presentation: 'modal', headerShown: false }}
/>
```

**Recommandation Phase 51 : Option A** — démarrer simple avec state machine. Si feedback utilisateur demande plus de richesse post-export, refactorer vers Option C en Phase 52+.

## Section 5 — Lulu Studio integration

### URL canonique vérifiée

```
https://www.lulu.com/create/print-books/
```

[VERIFIED: WebFetch lulu.com/create/print-books/]

**Query params pré-remplis :** ❌ AUCUN. Lulu Studio n'expose pas de deep link avec format/pages/binding pré-sélectionnés. L'utilisateur doit configurer manuellement le projet.

### Specs Lulu pour notre format

[VERIFIED: lib/pdf/constants.ts] FamilyVault génère `21 cm × 21 cm trim + 0.32 cm bleed = 21.64 × 21.64 cm = 8.52 × 8.52 inches`, 16 pages saddle-stitch.

[CITED: Lulu blog + Lulu products page] :
- **Tailles carrées Lulu standard** : 7.5″×7.5″ et **8.5″×8.5″** (≈ 21.59×21.59 cm) — c'est cette taille qu'il faut sélectionner.
- **Bleed Lulu** : 0.125″ (3.175 mm) tous bords. FamilyVault génère 0.32 cm = 3.2 mm → conforme.
- **Saddle-stitch** : 4 à 48 pages, multiples de 4. FamilyVault = 16 pages → conforme.
- **Perfect Bound** : 32 à 800 pages — ne s'applique pas (16 pages trop peu).
- **Papiers** : 60# Cream uncoated, 60# White uncoated, 80# White coated, 100# White coated. Pour livre illustré → recommander **80# White coated** (rendu illustrations).

⚠️ **Note importante :** `LULU_FORMAT_LABEL = 'Lulu 21×21'` dans `constants.ts` correspond à 21.59cm × 21.59cm officiel Lulu, pas exactement 21cm. Mentionner cette précision dans le manuel ("équivalent 8.5″×8.5″ Lulu standard").

### Manuel Lulu FR — structure recommandée

Modal `LuluInstructionsModal` avec liste numérotée, scrollable. Texte FR strict, ton bienveillant et pédagogique :

```markdown
# Comment imprimer ton livre chez Lulu

Lulu est un service d'impression à la demande. Tu n'as qu'à uploader le PDF
généré et choisir tes options. Compte ~15 € par livre + frais d'envoi.

## Étape 1 — Sauvegarde le PDF
Avant tout, sauvegarde le PDF sur ton iPhone (bouton "Sauvegarder" précédent).
Tu peux l'envoyer dans Files, sur ton ordinateur via AirDrop, ou par email.

## Étape 2 — Va sur Lulu Studio
Ouvre lulu.com sur ordinateur (l'upload PDF est plus simple sur grand écran).
Crée un compte gratuit si ce n'est pas déjà fait.

## Étape 3 — Crée un nouveau projet "Print Book"
- Type : Photo Book (Livre photo)
- Taille : 8.5" × 8.5" (Square / Carré) — ≈ 21,59 × 21,59 cm
- Reliure : Saddle Stitch (Piqué à cheval) — pour 16 pages
- Pages intérieures : 80# White Coated (papier blanc couché 120g) — recommandé pour les illustrations
- Couverture : Glossy Cover (couverture brillante) ou Matte (mat)
- Couleur : Color (couleur intégrale)

## Étape 4 — Upload du PDF
Upload le PDF généré (couverture + intérieur intégrés dans le même fichier).
Lulu détectera automatiquement les 16 pages.
Vérifie l'aperçu en ligne — toutes les pages doivent être correctes.

## Étape 5 — Vérifie le bleed et commande
Lulu affiche les marges de fond perdu (bleed). Tout doit être aligné.
Ajoute au panier, choisis ton mode d'envoi, et passe commande.

🎁 Astuce : Lulu offre régulièrement des codes promo (-15%, -20%).
Cherche "Lulu coupon" avant de payer.

[Ouvrir Lulu Studio]  → Linking.openURL('https://www.lulu.com/create/print-books/')
```

### Bouton CTA dans la modal

```tsx
<PressableScale
  onPress={() => {
    Haptics.selectionAsync();
    Linking.openURL('https://www.lulu.com/create/print-books/').catch(() => {
      Alert.alert(t('impressions.lulu.errorTitle'), t('impressions.lulu.errorOpen'));
    });
  }}
  style={[styles.luluCta, { backgroundColor: primary }]}
>
  <Text>{t('impressions.lulu.openButton')}</Text>
</PressableScale>
```

## Section 6 — i18n

### Setup existant [VERIFIED: lib/i18n.ts]

- Moteur : `i18next` 25.10.2 + `react-i18next` 16.6.0
- Detection : `getLocales()[0]?.languageCode` (expo-localization)
- Persistence : `expo-secure-store` clé `app_language`
- Namespaces actuels : `common` (default), `gamification`, `help`, `insights`, `skills`, `codex`
- Structure : `locales/{fr|en}/{namespace}.json`
- Fallback : `fr`

### Ajouts Phase 51 (à faire en 51-03)

1. Créer `locales/fr/impressions.json` :

```json
{
  "screen": {
    "title": "Mes impressions",
    "subtitle": "Tes livres imprimables prêts à commander",
    "empty": {
      "title": "Aucun livre exporté",
      "description": "Crée ton premier livre imprimable depuis tes histoires.",
      "cta": "Nouveau livre"
    },
    "newButton": "Nouveau livre"
  },
  "card": {
    "format": "Format {{format}}",
    "exportedOn": "Exporté le {{date}}",
    "hashShort": "#{{hash}}"
  },
  "export": {
    "modal": {
      "selectTitle": "Choisis une histoire",
      "selectSubtitle": "Sélectionne l'histoire à transformer en livre",
      "generating": {
        "title": "Création de ton livre…",
        "step.assets": "Préparation des illustrations…",
        "step.render": "Mise en page…",
        "step.hash": "Vérification…",
        "step.print": "Génération du PDF…"
      },
      "ready": {
        "title": "Ton livre est prêt !",
        "format": "Format : {{format}}",
        "pages": "{{count}} pages",
        "duration": "Généré en {{ms}} ms",
        "previewBtn": "Aperçu du PDF",
        "continueBtn": "Continuer"
      },
      "buttons": { "cancel": "Annuler", "generate": "Générer" }
    }
  },
  "postExport": {
    "title": "Et maintenant ?",
    "subtitle": "Trois manières de profiter de ton livre :",
    "save": {
      "title": "Sauvegarder le PDF",
      "description": "Dans Files, par AirDrop, par email…"
    },
    "preview": {
      "title": "Voir le PDF",
      "description": "Ouvre l'aperçu plein écran"
    },
    "lulu": {
      "title": "Commander chez Lulu",
      "description": "Imprime un vrai livre à la demande"
    },
    "doneBtn": "Terminé"
  },
  "lulu": {
    "modalTitle": "Imprimer chez Lulu",
    "intro": "Lulu est un service d'impression à la demande. Compte ~15 € + envoi.",
    "step1": { "title": "1. Sauvegarde le PDF", "body": "…" },
    "step2": { "title": "2. Va sur Lulu Studio", "body": "…" },
    "step3": { "title": "3. Crée le projet", "body": "Taille 8.5″×8.5″, Saddle Stitch, 80# White Coated, Color." },
    "step4": { "title": "4. Upload le PDF", "body": "…" },
    "step5": { "title": "5. Commande", "body": "…" },
    "tip": "🎁 Cherche un code promo Lulu avant de payer.",
    "openButton": "Ouvrir Lulu Studio",
    "errorTitle": "Impossible d'ouvrir le navigateur",
    "errorOpen": "Vérifie ta connexion internet et réessaye."
  },
  "errors": {
    "generationTitle": "Erreur lors de la génération",
    "openTitle": "Impossible d'ouvrir le PDF",
    "sharingUnavailable": "Le partage n'est pas disponible sur cet appareil."
  },
  "share": { "dialogTitle": "Partager \"{{title}}\"" }
}
```

2. Créer `locales/en/impressions.json` (mirror — l'app supporte EN même si FR strict UI default).
3. Modifier `lib/i18n.ts` (5 lignes : 2 imports + 1 ns array + 2 resources).

### Convention clés

- camelCase pour les clés
- Imbrication par feature/section
- Interpolation : `{{var}}`
- Pluralisation : non utilisée Phase 51

## Section 7 — Performance UX pendant génération

### Budget perf [VERIFIED: pdf-generator.ts:124-130]

`generateBookPdf` warn si > 5000 ms. Décomposition `assetsMs`, `renderMs`, `hashMs`, `printMs` exposée dans `result.perf`.

### UX recommandée pendant 3-5s

**Stratégie : faux progressif réaliste avec étapes nommées**

`generateBookPdf` n'expose pas de callback de progression intermédiaire. Deux approches :

#### Approche A — Étapes simulées (recommandée, simple)

Affichage `step.assets → step.render → step.hash → step.print` séquentiel basé sur des durées attendues. L'utilisateur perçoit du mouvement, pas de fausse promesse.

```tsx
const STEPS = [
  { key: 'assets', durationMs: 1500, label: 'step.assets' },
  { key: 'render', durationMs: 800,  label: 'step.render' },
  { key: 'hash',   durationMs: 200,  label: 'step.hash' },
  { key: 'print',  durationMs: 2000, label: 'step.print' },
];

// useEffect — démarre setTimeout cascade quand phase = 'generating'
useEffect(() => {
  if (phase.kind !== 'generating') return;
  let cancelled = false;
  let acc = 0;
  STEPS.forEach((s, i) => {
    setTimeout(() => {
      if (!cancelled) setPhase({ kind: 'generating', step: STEPS[i].key });
    }, acc);
    acc += s.durationMs;
  });
  return () => { cancelled = true; };
}, [phase.kind]);
```

**Composant visuel :**
- `ActivityIndicator` size large + couleur primary
- Texte `t('impressions.export.modal.generating.step.{currentStep}')`
- Anim subtle scale/fade (`react-native-reanimated`) sur changement d'étape
- Pas de barre de progression (mensonger sans callback réel)

#### Approche B — Callback de progression (refactor lib/pdf)

Ajouter `onProgress?: (step) => void` à `generateBookPdf` qui appelle le callback entre chaque section. **Hors scope Phase 51** (touche au moteur Phase 49) — déférer si feedback UX demande précision.

### Recommandation

**Approche A** — bonne UX pour < 5s, pas de refactor lib. Si la génération dépasse 5s régulièrement (warn `__DEV__`), envisager Approche B en Phase 52+.

## Section 8 — Suppression / gating de `app/dev-deep-link.tsx`

### État actuel [VERIFIED: app/dev-deep-link.tsx]

- L'écran teste deep links + a un bouton "PDF" en dev (lignes 76-105)
- Gating actuel : `if (!__DEV__) return <Indisponible/>` ligne 60

### Recommandation Phase 51-04

**Garder le fichier, retirer uniquement les boutons "PDF" :**

1. L'écran reste utile en dev (test deep links Phase 50, non-régression import-note / open/meals)
2. Les boutons PDF (lignes 149-162 + handler ligne 76-105) deviennent redondants — Phase 51 a une vraie UI export utilisateur
3. **Action concrète 51-04** :
   - Supprimer la fonction `generatePdf` (lignes 76-105)
   - Supprimer le `<View style={styles.row}>` qui wrap PressableScale "PDF" — revenir au simple `<Pressable>` ligne 128-148
   - Garder `import { generateBookPdf, persistBookPdf }` ❌ supprimer (plus utilisé)
   - Garder `__DEV__` gate

**Pourquoi pas supprimer le fichier entier :**
- Phase 50 carry-over : "scan QR papier réel" et "test cold start deep link" se font via cet écran
- Le gating `__DEV__` empêche l'inclusion en prod (App Store build)

**Alternative à proposer si l'utilisateur préfère :** déplacer dans une sous-route `app/(dev)/deep-links.tsx` cachée du router. Hors scope Phase 51 sauf demande explicite.

## Section 9 — Pitfalls

### Pitfall 1 — Rebuild dev-client en cours

**Contexte :** L'utilisateur est en cours de rebuild dev-client pour `expo-print`/`expo-clipboard` Phase 50. Phase 51 ajoute `expo-sharing` (~14.0.8) qui nécessite **un nouveau prebuild** (Pods natifs).

**Mitigation :**
- 51-03 doit annoncer clairement que `npx expo prebuild --clean` + `npx expo run:ios --device` sont requis avant le test sur device
- Si rebuild en cours = bloqué temporairement, prévoir un fallback gracieux : `await Sharing.isAvailableAsync()` → si `false`, fallback `Linking.openURL(uri)` + toast "Sauvegarde indisponible, ouverture dans Files."
- Le code peut être écrit sans prebuild — les tests Jest et tsc passent (expo-sharing est tree-shake-friendly avec `try { require } catch`)

### Pitfall 2 — Working tree user en cours sur `more.tsx`

**Contexte :** [VERIFIED: git status] L'utilisateur a des modifs non-commit sur `app/(tabs)/more.tsx`, `hooks/useFarm.ts`, `app/(tabs)/_layout.tsx`, `app/(tabs)/{calendar,index,journal,tasks,tree}.tsx`.

**Risque :** Plan 51-02 modifie `more.tsx` pour ajouter row "Mes impressions" → conflit potentiel avec modifs en cours.

**Mitigation :**
- 51-02 task instruction : **NE PAS** faire `git checkout` ou `git stash` (cf. Incident 1 Phase 50). Lire le fichier en l'état, ajouter le row au bon endroit (categorie 'organisation' ou 'souvenirs'), commit minimal targeting que ce fichier.
- Si conflit logique, demander confirmation utilisateur avant edit.
- L'incident Phase 50-03 est documenté dans `gsd-executor.md` patch — orchestrateur a maintenant l'instruction explicite.

### Pitfall 3 — PDF preview iOS vs Android

**iOS :** `Print.printAsync({ uri })` ouvre QLPreviewController natif → expérience excellente.

**Android :** `Print.printAsync` ouvre le print framework Android → expérience moins polie. Pour Android, considérer un fallback `Linking.openURL(uri)` qui ouvre le viewer PDF par défaut (Drive PDF Viewer ou équivalent).

**Mitigation 51-01 :**
```tsx
async function handlePreview() {
  if (Platform.OS === 'ios') {
    await Print.printAsync({ uri: pdfUri });
  } else {
    await Linking.openURL(pdfUri);  // Android : viewer système
  }
}
```

**Note projet :** FamilyVault est principalement testé sur iOS device (CLAUDE.md mentionne `npx expo run:ios --device`). Android est best-effort.

### Pitfall 4 — Mémoire si PDF >5 MB

**Risque :** Si l'utilisateur stocke beaucoup d'illustrations ou si futures phases ajoutent images haute résolution, le PDF peut dépasser 5 MB.

**Mitigation :** `Print.printAsync({ uri })` lit le fichier disque (pas en RAM JS) → pas de problème. **C'est précisément pour ça qu'on évite WebView base64.**

### Pitfall 5 — Manifeste vide au premier export

[VERIFIED: book-storage.ts:48-52] `persistBookPdf` crée le manifeste paresseusement (try/catch). `parseManifeste('')` retourne `[]` proprement.

**Mitigation :** L'écran "Mes impressions" doit gérer le cas `entries.length === 0` avec un empty state + CTA "Nouveau livre". Voir Section 3.

### Pitfall 6 — Reconstruction URI manifeste→file

`entry.chemin` est relatif. Pour ouvrir le PDF il faut un URI absolu `file://`. **Recommandation 51-02 : exporter `buildVaultPdfUri(vault, entry)` depuis `book-storage.ts` plutôt que de dupliquer la logique dans `app/impressions.tsx`.**

### Pitfall 7 — Modal stack drag-to-dismiss interaction

Si l'utilisateur drag-to-dismiss `BookExportModal` pendant la génération (`phase = 'generating'`), il faut soit :
- (A) Bloquer le dismiss (`onRequestClose` no-op pendant generating)
- (B) Permettre le dismiss et abort proprement (mais `generateBookPdf` n'expose pas d'abort signal)

**Recommandation :** Option A. Pendant `generating`, `onRequestClose` affiche `Alert.alert(t('impressions.confirmCancel'))` ou no-op. Voir code exemple Section 1.

## Runtime State Inventory

> Phase 51 = wiring UX, mais elle ajoute une dépendance native (`expo-sharing`) et touche au manifeste vault.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Manifeste `12 - Impressions/manifeste.md` (déjà écrit Phase 49 par `persistBookPdf`) | Aucune migration — Phase 51 = lecture pure |
| Live service config | None — pas de service externe | None |
| OS-registered state | None — pas de Task Scheduler / launchd | None |
| Secrets/env vars | None — Lulu = lien web pur, pas d'API key | None |
| Build artifacts | `ios/Pods/` à régénérer après ajout `expo-sharing` | `npx expo prebuild --clean` + `npx expo run:ios --device` |

## Common Pitfalls (résumé table)

| # | Pitfall | Détection | Mitigation |
|---|---------|-----------|------------|
| 1 | Rebuild dev-client requis | Lancement crash `Native module 'ExpoSharing' not found` | Documenter prebuild + fallback `isAvailableAsync` |
| 2 | Working tree user `more.tsx` | git status M | Edit minimal, pas de checkout |
| 3 | Android PDF preview moins poli | Test device Android | Platform.OS branch — Linking.openURL fallback |
| 4 | PDF >5MB | Warn `pdf-generator` total>5000ms | `Print.printAsync({ uri })` lit disque, pas RAM JS |
| 5 | Manifeste absent au boot | `vault.readFile` throw | try/catch → `setEntries([])` |
| 6 | URI manifeste relatif | `Print.printAsync({ uri: '12 - Impressions/...' })` échoue | Exporter `buildVaultPdfUri` depuis `book-storage.ts` |
| 7 | Drag-to-dismiss pendant génération | UX inconsistante | `onRequestClose` no-op si phase = generating |

## Code Examples — récapitulatif des snippets clés

### Génération + persistance (depuis `BookExportModal`)

```tsx
import { generateBookPdf, persistBookPdf } from '../../lib/pdf';

const result = await generateBookPdf({ story, allStories: stories });
const persisted = await persistBookPdf(vaultManager, result.uri, result.entry);
// result.uri → cache app (utilisable pour Print.printAsync, Sharing)
// persisted.chemin → vault permanent (relative path stocké manifeste)
```

### Aperçu PDF natif iOS

```tsx
import * as Print from 'expo-print';
await Print.printAsync({ uri: pdfUri }); // QLPreviewController + AirPrint
```

### Sauvegarde Share Sheet

```tsx
import * as Sharing from 'expo-sharing';
if (await Sharing.isAvailableAsync()) {
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: t('impressions.share.dialogTitle', { title }),
  });
}
```

### Lulu external link

```tsx
import { Linking } from 'react-native';
import * as Haptics from 'expo-haptics';

Haptics.selectionAsync();
Linking.openURL('https://www.lulu.com/create/print-books/').catch(() => {
  Alert.alert(t('impressions.lulu.errorTitle'), t('impressions.lulu.errorOpen'));
});
```

### Lecture manifeste

```tsx
import { parseManifeste, MANIFESTE_FILE } from '../lib/pdf/manifest-parser';

try {
  const raw = await vault.readFile(MANIFESTE_FILE);
  setEntries(parseManifeste(raw));
} catch {
  setEntries([]); // manifeste pas encore créé
}
```

### Modal pageSheet drag-to-dismiss

```tsx
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={phase.kind === 'generating' ? undefined : onClose}
>
  <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
    {/* … */}
  </SafeAreaView>
</Modal>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-native-pdf` for in-app preview | `Print.printAsync({ uri })` natif | Expo SDK 49+ | Zéro dépendance, native QLPreviewController |
| `react-native-share` | `expo-sharing` | Expo SDK 40+ | Standardisé, multi-OS, peer deps gérées Expo |
| Custom WebView base64 PDF preview | `Print.printAsync` ou `Linking.openURL` | iOS 14+ WKWebView restrictions | Mémoire safe, pas de crash silencieux |
| Old Lulu API integration | URL externe + manuel utilisateur | Décision Phase 51 (CONTEXT) | Pas d'OAuth, pas de compte business — UX simple |

**Deprecated/outdated:**
- ⚠️ `react-native-pdf` < 6.7 a des problèmes connus avec New Architecture SDK 54. Si jamais utilisé, version 7.0.4 minimum + `@config-plugins/react-native-pdf`.
- ⚠️ `react-native-share` (community) — privilégier `expo-sharing` dans le tooling Expo.

## Project Constraints (from CLAUDE.md)

- **Langue UI/commits/commentaires** : français strict
- **Couleurs** : TOUJOURS `useThemeColors()` / `colors.*` — jamais hardcoded
- **Modals** : `pageSheet` + drag-to-dismiss
- **Animations** : `react-native-reanimated` ~4.1 (pas RN Animated)
- **Spring config** : constante module `const SPRING_CONFIG = { damping: 10, stiffness: 180 }`
- **Haptics** : `expo-haptics` (`selectionAsync`, `impactAsync`)
- **Format date** : JJ/MM/AAAA
- **Privacy** : noms personnels génériques (Lucas, Emma, Dupont) dans docs/commits
- **Pour livrer** : `/ship` (tsc + privacy check + commit FR + push)
- **Type check** : `npx tsc --noEmit` obligatoire avant chaque commit
- **Tests** : `npx jest --no-coverage` (erreurs pré-existantes MemoryEditor.tsx, cooklang.ts, useVault.ts à ignorer)
- **List items** : `React.memo()`, handlers `useCallback()`
- **Errors user-facing** : `Alert.alert()` FR
- **__DEV__** logs only
- **`SectionErrorBoundary`** entoure les sections dashboard

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (default Expo) |
| Config file | `jest.config.js` (existant) |
| Quick run command | `npx jest --no-coverage <file>` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UX-04 | parseManifeste round-trip | unit (existant Phase 49) | `npx jest --no-coverage pdf-manifest-parser` | ✅ existant |
| UX-05 | i18n FR clés présentes | snapshot/unit | `npx jest --no-coverage i18n` | ✅ existant `lib/__tests__/i18n.test.ts` (extension recommandée pour ns `impressions`) |
| QA-01 | tsc clean | type check | `npx tsc --noEmit` | ✅ command-only |
| UX-01 à UX-03, UX-06 | UI wiring | manual-only (RN Testing Library lourd, pas dans projet) | manual device test | ❌ manuel device |

**Justification manual-only UI** : projet n'a pas RN Testing Library configuré (CLAUDE.md mentionne uniquement `npx tsc --noEmit` + `npx jest --no-coverage`). Tests UI deviendraient un sous-projet à part entière. Préférer test device + tsc + jest existants.

### Sampling Rate

- **Per task commit** : `npx tsc --noEmit` (obligatoire)
- **Per wave merge** : `npx jest --no-coverage` complet
- **Phase gate** : test device manuel + manifeste validé (`12 - Impressions/manifeste.md` non corrompu après 3 exports)

### Wave 0 Gaps

- [ ] `lib/__tests__/i18n.test.ts` — étendre pour vérifier `impressions` namespace (clé `screen.title` retourne FR strict)
- [ ] (optionnel) `components/pdf/__tests__/BookExportModal.test.tsx` — non recommandé, projet n'a pas RNTL

*Aucun gap bloquant — l'infra de test existe.*

## Security Domain

> Phase 51 = wiring UI vers libs déjà installées + lien externe public. Surface attaque minimale.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Pas d'auth ajoutée |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | partial | `entry.chemin` du manifeste — déjà validé Phase 49 (`buildVaultUri` path traversal check book-storage.ts:73-78) |
| V6 Cryptography | no | Hash SHA-256 déjà fait Phase 49 (lecture seule Phase 51) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via manifeste corrompu | Tampering | `parseManifeste` ignore lignes malformées + `buildVaultUri` re-valide path |
| Lien Lulu phishing-spoof | Information Disclosure | URL hardcodée `https://www.lulu.com/...` (pas de string interpolée user-input) |
| PDF malicieux dans cache | — | PDF généré en local par expo-print, pas téléchargé externe |

**Recommandation :** valider que `buildVaultUri` (book-storage.ts:72-92) est ré-utilisé pour reconstruire l'URI absolu en Section 3 — ne pas dupliquer la logique sans le check `relativePath.includes('..')`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-print` | Aperçu PDF + génération | ✓ | ~15.0.8 | — |
| `expo-sharing` | Sauvegarde PDF | ✗ (à installer) | (target ~14.0.8) | `Linking.openURL(uri)` si `isAvailableAsync()` false |
| `expo-haptics` | Feedback tactile | ✓ | (installé) | silent — feature non-critique |
| `react-i18next` | i18n | ✓ | ^16.6.0 | — |
| `lucide-react-native` | Icônes | ✓ | (installé) | — |
| Lulu Studio (web) | Bouton "Commander" | N/A | — | Toast "Vérifie ta connexion" si Linking fail |
| Dev-client rebuild | `expo-sharing` natif | ⚠️ en cours utilisateur | — | Coordonner avec utilisateur avant test device 51-03/51-04 |

**Missing dependencies with no fallback:** Aucun bloquant. `expo-sharing` a un fallback `Linking.openURL(uri)`.

**Missing dependencies with fallback:** `expo-sharing` → fallback `Linking.openURL(uri)` qui ouvre le PDF dans Files.app/Books.app (l'utilisateur utilise ensuite le bouton Share natif iOS).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Print.printAsync({ uri })` ouvre QLPreviewController natif sur iOS avec aperçu pleine page | Section 1 | Si limité à dialog d'impression sans preview embedded → fallback `Linking.openURL(uri)` (ouvre Books.app) |
| A2 | Lulu Studio n'accepte pas de query params pour pré-remplir taille/binding | Section 5 | Si possible (ex: `?size=8.5x8.5&binding=saddle`) → simplifier le manuel — vérification rapide en testant l'URL |
| A3 | `expo-sharing` ~14.0.8 est compatible SDK 54 | Stack | Si incompatibilité → `npx expo install expo-sharing` résout automatiquement la bonne version |
| A4 | Le projet n'a pas configuré React Native Testing Library | Validation | Si présent → ajouter tests UI BookExportModal serait possible — vérification rapide `grep "@testing-library/react-native" package.json` |
| A5 | Le manifeste reste petit (<100 entrées attendues) | Section 3 | Si grande croissance → ajouter pagination/virtualisation FlatList — non urgent |
| A6 | Lulu papier "80# White Coated" est le bon choix pour livre illustré 21×21 cm | Section 5 | Recommandation indicative — l'utilisateur peut choisir autrement, mentionner dans manuel comme "recommandé" pas "obligatoire" |
| A7 | Drag-to-dismiss iOS pageSheet appelle `onRequestClose` (comme back Android) | Section 4, Pitfall 7 | Si non, ajouter listener custom — comportement standard RN Modal SDK 54 |

## Open Questions

1. **L'utilisateur a-t-il une préférence pour le placement de la nouvelle row dans `more.tsx` ?**
   - Options : catégorie 'organisation' (livres comme productivité) vs 'souvenirs' (livres comme mémoire).
   - Recommandation : `'souvenirs'` (cohérent avec le storytelling familial — l'utilisateur tranchera).

2. **Faut-il aussi proposer "Imprimer ici" via AirPrint dans le post-export ?**
   - `Print.printAsync({ uri })` permet déjà d'imprimer sur AirPrint depuis le dialog natif.
   - Recommandation : ne pas exposer un 4e bouton — l'aperçu inclut AirPrint naturellement.

3. **Universal Links Lulu pour ouvrir l'app Lulu si installée ?**
   - Hors scope confirmé CONTEXT — défère.

4. **Si une histoire a été supprimée mais le manifeste contient encore son entrée ?**
   - L'écran "Mes impressions" affiche le PDF (qui existe encore dans `12 - Impressions/PDFs/`) avec le titre = `entry.id` (pas de `stories.find()`).
   - Recommandation : afficher l'ID en italique avec `t('impressions.card.deletedStory')` ; PDF reste lisible. Ajout mineur 51-02.

## Sources

### Primary (HIGH confidence)
- `lib/pdf/pdf-generator.ts` — code source vérifié
- `lib/pdf/book-storage.ts` — code source vérifié
- `lib/pdf/manifest-parser.ts` — code source vérifié
- `lib/i18n.ts` — config vérifiée
- `app/dev-deep-link.tsx` — référence wiring existante
- `components/AnniversaryEditor.tsx`, `components/RDVEditor.tsx` — patterns modal pageSheet vérifiés
- `package.json` — versions vérifiées (`grep -E "expo-sharing|expo-print|i18next|qrcode"`)
- [Expo Print docs](https://docs.expo.dev/versions/latest/sdk/print/) — `printAsync` vs `printToFileAsync`
- [Expo Sharing docs](https://docs.expo.dev/versions/latest/sdk/sharing/) — `shareAsync(uri, options)`

### Secondary (MEDIUM confidence)
- [Lulu products page](https://www.lulu.com/products) — sizes + bindings (8.5″×8.5″ confirmé)
- [Lulu Knowledge Base](https://help.lulu.com) — bleed 0.125″ specs
- [config-plugins/react-native-pdf](https://www.npmjs.com/package/@config-plugins/react-native-pdf) — alternative Pods natifs
- `npm view expo-sharing versions` — version `14.0.8` SDK 54 compatible

### Tertiary (LOW confidence)
- Lulu URL pré-remplissage — non documenté officiellement, conclusion par observation web (assomption A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions vérifiées package.json + npm registry
- Architecture: HIGH — patterns modal/i18n vérifiés sur code projet existant
- Pitfalls: HIGH — basés sur Phase 49/50 incidents documentés + RN/iOS specs connues
- Lulu specs: MEDIUM — official docs publics suffisants pour le manuel, pas d'API officielle à intégrer

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stack stable Expo SDK 54 ; ré-évaluer si SDK 55 publié)
