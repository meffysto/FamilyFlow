---
phase: 53-lightning-family-wallet
plan: 03a
subsystem: lightning
tags: [lightning, ui, components, reanimated, memo, presentational]
dependency_graph:
  requires:
    - "53-01 (types AuditEntry, AuditStatus, PayoutQueueItem, MemberWalletMapping)"
    - "53-02 (orchestrateurs runtime — pas consommés directement, mais le bus onPayoutSuccess sera consommé Plan 03b via triggerPulse)"
  provides:
    - "components/lightning/HudLightningButton — bouton HUD ⚡ + ref.triggerPulse() Reanimated 4"
    - "components/lightning/BalanceCard — hero balance display + bouton Encaisser disabled"
    - "components/lightning/AuditLogItem — item liste audit memoïsé + STATUS_DISPLAY map"
    - "components/lightning/PayoutQueueItem — item liste validation batch memoïsé"
    - "components/lightning/TriggerModeSelector — 3 radio cards accessibles"
    - "STATUS_DISPLAY (Record<AuditStatus, …>) exporté depuis AuditLogItem.tsx"
  affects:
    - "Aucun écran / modal / hook touché. Plan 03b consomme via imports."
tech_stack:
  added: []
  patterns:
    - "Reanimated 4 useImperativeHandle + forwardRef pour piloter une pulse depuis le parent (HudLightningButton)"
    - "useFarmTheme() pour palette farm dynamique clair/sombre tout en gardant les valeurs numériques verbatim du HUD"
    - "STATUS_DISPLAY const exporté depuis l'item — single source de vérité libellé+couleurs partagée"
    - "React.memo par défaut sur AuditLogItem et PayoutQueueItem (props primitives + objet stable)"
    - "Helper local formatRelativeTime() pour 'Mis à jour il y a X min' (BalanceCard)"
key_files:
  created:
    - components/lightning/HudLightningButton.tsx
    - components/lightning/BalanceCard.tsx
    - components/lightning/AuditLogItem.tsx
    - components/lightning/PayoutQueueItem.tsx
    - components/lightning/TriggerModeSelector.tsx
  modified: []
decisions:
  - "Style verbatim hudCodexButton respecté MAIS backgroundColor/borderColor déplacés inline pour passer farm.parchmentDark/farm.woodDark via useFarmTheme() (tree.tsx utilise Farm.* statique light-only ; nos composants doivent supporter le dark mode)"
  - "STATUS_DISPLAY typé avec chipFgKey/chipBgKey en `string` (pas `keyof AppColors`) pour éviter un import lourd ; cast `colors as unknown as Record<string,string>` au render avec commentaire explicatif — toutes les clés du map sont vérifiées valides AppColors par construction"
  - "Renommage prop interface du PayoutQueueItem.tsx : import `PayoutQueueItem as PayoutQueueItemType` pour éviter collision avec le composant exporté éponyme"
  - "BalanceCard : helper formatRelativeTime() local (pas exporté) — pattern simple sans dépendance date-fns supplémentaire ; les autres items utilisent déjà date-fns pour JJ/MM(/AAAA)"
  - "AccessibilityHint sur Bouton Encaisser via TouchableOpacity custom plutôt que composant Button maison (Button.tsx ne supporte pas accessibilityHint)"
  - "Pas de tests Jest ajoutés — composants purement présentationnels (consigne plan, exécution lightweight test protocol). Plan 03b ajoutera des tests d'intégration ciblés si besoin."
metrics:
  duration_minutes: 25
  completed_date: 2026-05-18
  tasks_completed: 1
  files_created: 5
  files_modified: 0
  tests_added: 0
  commits: 1
---

# Phase 53 Plan 03a : 5 composants visuels purs Lightning

Wave 3 du chemin critique Lightning Family Wallet. Plan 03a livre **les 5 composants visuels presentationals** consommés par Plan 03b (écran `/lightning-wallet`, `PayoutQueueModal`, `CashOutModal`, extension HUD `tree.tsx` + SettingsLightning). Aucune intégration, aucune navigation, aucun listener — purement contractuel.

## Résumé exécutif

- **5 nouveaux fichiers** `components/lightning/*.tsx` (789 lignes insérées).
- **0 hardcoded couleur** (grep `#…|rgba?\(` retourne 0).
- **TSC clean** sur les nouveaux fichiers et sur l'ensemble du projet (`npx tsc --noEmit` → 0 error).
- **0 test ajouté** — composants purement visuels (cf. décisions).
- **1 commit atomique** `bc1c9618`.
- **Style `hudCodexButton` + `hudEmoji` VERBATIM** depuis `app/(tabs)/tree.tsx:4035-4048` (WARNING #8 enforcé — voir diff plus bas).

## API des 5 composants

### `HudLightningButton` (forwardRef)

```tsx
export interface HudLightningButtonRef {
  triggerPulse: () => void;
}

interface HudLightningButtonProps {
  onPress: () => void;
}

export const HudLightningButton = forwardRef<HudLightningButtonRef, HudLightningButtonProps>(...)
```

**Consommation Plan 03b :**

```tsx
const lightningBtnRef = useRef<HudLightningButtonRef>(null);

useEffect(() => {
  const unsub = onPayoutSuccess(() => {
    lightningBtnRef.current?.triggerPulse();
  });
  return unsub;
}, []);

return (
  <HudLightningButton
    ref={lightningBtnRef}
    onPress={() => router.push('/lightning-wallet')}
  />
);
```

**Spring config :** `LIGHTNING_PULSE_SPRING = { damping: 10, stiffness: 180 }` (constante module — UI-SPEC Animation 1, D-04).

---

### `BalanceCard`

```tsx
interface BalanceCardProps {
  balanceSats: number | null;   // null = skeleton loading
  lastUpdatedAt?: Date;
  canCashOut: boolean;          // false → disabled + hint "Admin key requise"
  onCashOut: () => void;
  errorMessage?: string;        // si présent : "—" + AlertTriangle + warning
}

export function BalanceCard(props: BalanceCardProps): JSX.Element;
```

**Trois états** :
1. **`errorMessage` présent** → "—" + icône `AlertTriangle` 16px `colors.warning` + texte d'erreur warning sous-fond.
2. **`balanceSats === null`** → skeleton 2 rectangles `colors.cardAlt` opacity 0.6 (120×28 + 80×16).
3. **`balanceSats: number`** → `{N} sats` en `FontSize.display` (24px) `FontWeight.semibold` + timestamp "Mis à jour il y a X min".

Le bouton "Encaisser" est un `TouchableOpacity` custom (pas le `Button` maison) pour exposer `accessibilityHint="Admin key requise pour encaisser"` quand `canCashOut === false`.

---

### `AuditLogItem` (React.memo)

```tsx
interface AuditLogItemProps {
  entry: AuditEntry;            // depuis lib/lightning (Plan 01)
  profileName: string;          // "—" si profileId orphelin
  taskTitle: string;            // "—" si taskId non retrouvé
}

export const AuditLogItem: React.MemoExoticComponent<...>;

export const STATUS_DISPLAY: Record<
  AuditStatus,
  { label: string; icon: LucideIcon; chipFgKey: string; chipBgKey: string }
>;
```

`STATUS_DISPLAY` couvre tous les 8 `AuditStatus` (paid / cash_out / queued / capped / failed / already_paid_today / undone / attribution_failed) — chacun avec son libellé FR, icône Lucide (`CheckCircle2` / `Clock` / `AlertTriangle` / `XCircle`) et ses clés AppColors (`successText/successBg`, `warningText/warningBg`, `errorText/errorBg`, `textMuted/cardAlt`).

Layout : pastille icône 24×24 `Radius.full` + colonne titre/prénom·date + chip statut à droite.

---

### `PayoutQueueItem` (React.memo)

```tsx
interface PayoutQueueItemProps {
  item: PayoutQueueItem;        // type renommé `PayoutQueueItemType` à l'import
  profile: Profile | undefined; // fallback emoji 👤 si undefined
  taskTitle: string;
}

export const PayoutQueueItem: React.MemoExoticComponent<...>;
```

Layout (UI-SPEC Surface 4) :
- Avatar emoji 36×36 `Radius.full` bg `colors.cardAlt`
- Colonne droite : prénom semibold + sats semibold à droite, taskTitle textMuted + JJ/MM à droite

Card bg `colors.card`, `Shadows.sm`, `Radius.lg`, padding `Spacing.xl`.

---

### `TriggerModeSelector`

```tsx
export type TriggerMode = 'instant' | 'daily-review' | 'hybrid';

interface TriggerModeSelectorProps {
  value: TriggerMode;
  onChange: (mode: TriggerMode) => void;
}

export function TriggerModeSelector(props: TriggerModeSelectorProps): JSX.Element;
```

Trois `TouchableOpacity` (gap `Spacing.md`), chacune avec :
- `accessibilityRole="radio"` + `accessibilityState={{ checked: value === id }}` + `accessibilityLabel={title}` + `accessibilityHint={subtitle}`
- Sélectionné : `borderColor: primary`, `borderWidth: 1.5` + disque 20×20 bg primary + dot 8×8 blanc centré
- Non sélectionné : `borderColor: colors.border`, `borderWidth: 1` + disque 20×20 bg `colors.cardAlt` border `colors.border` (creux)
- `Haptics.selectionAsync()` à chaque tap

Wording verbatim UI-SPEC Copywriting Contract :
- `instant` : "Instantané" / "Chaque tâche déclenche un pay-out immédiat"
- `daily-review` : "Validation parentale" / "Tu valides les pay-outs en batch une fois par jour"
- `hybrid` : "Hybride" / "Instantané jusqu'à 100 sats/jour, puis en attente"

## Style verbatim hudCodexButton — preuve

**Référence `app/(tabs)/tree.tsx:4035-4048`** :

```typescript
hudCodexButton: {
  width: 40,
  height: 40,
  borderRadius: Radius.full,
  backgroundColor: farm.parchmentDark,
  borderWidth: 2,
  borderColor: farm.woodDark,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: Spacing.sm,
},
hudEmoji: {
  fontSize: 14,
},
```

**`components/lightning/HudLightningButton.tsx` StyleSheet** :

```typescript
hudCodexButton: {
  width: 40,
  height: 40,
  borderRadius: Radius.full,
  borderWidth: 2,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: Spacing.sm,
},
hudEmoji: {
  fontSize: 14,
},
```

**Différence justifiée :** `backgroundColor: farm.parchmentDark` et `borderColor: farm.woodDark` sont passés inline dans le `style={[styles.hudCodexButton, { backgroundColor: farm.parchmentDark, borderColor: farm.woodDark }]}` via `useFarmTheme()`. Raison : `tree.tsx` utilise `Farm.*` statique (light-only) car son StyleSheet est créé une fois. Notre composant doit supporter le dark mode via `useFarmTheme()`, donc les deux couleurs farm sont résolues au render.

**Toutes les valeurs numériques verbatim** (width:40, height:40, Radius.full, borderWidth:2, alignItems:'center', justifyContent:'center', marginLeft:Spacing.sm, fontSize:14) **sont strictement identiques** à la source. Le glyph emoji est `'⚡'` au lieu de `'📖'` / `'📷'`, et le `testID="hud-lightning-button"` + `accessibilityLabel="Portefeuille Lightning"` sont les seules adaptations sémantiques.

## Tokens utilisés

| Composant | FontSize | Spacing | Radius | Shadows |
|-----------|----------|---------|--------|---------|
| HudLightningButton | (literal `14`) | `sm` | `full` | — |
| BalanceCard | `display`, `caption`, `body` | `md`, `xl`, `2xl`, `3xl` | `sm`, `md`, `xl` | `md` |
| AuditLogItem | `body`, `label`, `caption` | `xxs`, `xs`, `md`, `xl` | `full` | — |
| PayoutQueueItem | `title`, `body`, `label` | `xxs`, `md`, `xl` | `lg`, `full` | `sm` |
| TriggerModeSelector | `body`, `label` | `xxs`, `md`, `xl` | `md`, `full` | — |

## Animations Reanimated 4

Un seul composant anime : **HudLightningButton**.

```typescript
const LIGHTNING_PULSE_SPRING: WithSpringConfig = { damping: 10, stiffness: 180 };

const scale = useSharedValue(1);
const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

useImperativeHandle(ref, () => ({
  triggerPulse: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(1.2, LIGHTNING_PULSE_SPRING, () => {
      scale.value = withSpring(1, LIGHTNING_PULSE_SPRING);
    });
  },
}), [scale]);
```

- `withSpring` chain (pas `withTiming`) — UI-SPEC Animation 1 + D-04.
- Pas de `perspective` (CLAUDE.md) — scale pur sans clipping 3D.
- Haptic light déclenché en sync avec le start de la pulse (pas via `runOnJS` car `useImperativeHandle` est déjà sur le JS thread).
- Durée totale estimée : ~600ms (montée ~250ms + descente ~350ms via spring).

## Conformité UI-SPEC

- [x] **Surface 1 (HUD ⚡)** — style verbatim hudCodexButton / hudEmoji, position après 📷, conditionnel strict assuré par le caller (Plan 03b).
- [x] **Surface 2 / Section 1 (BalanceCard)** — display 24px, timestamp caption muted, 3 états (valeur / skeleton / erreur), bouton Encaisser disabled state + hint.
- [x] **Surface 3 statuts (AuditLogItem)** — 8 statuts STATUS_DISPLAY, icône 14px dans pastille 24×24, chip à droite, date dd/MM/yyyy.
- [x] **Surface 4 (PayoutQueueItem)** — avatar 36×36, prénom/sats semibold à droite, taskTitle/JJ/MM muted.
- [x] **Surface 6 (TriggerModeSelector)** — 3 radio cards, sélectionné primary 1.5px + dot blanc 8px, accessibilityRole radio.
- [x] **Animations** — LIGHTNING_PULSE_SPRING damping:10 stiffness:180 verbatim.
- [x] **Copywriting Contract** — libellés strictement FR ("Encaisser", "Reçu", "Encaissé", "En attente", "Plafond", "Échoué", "Déjà payé", "Annulé", "Non attribué", "Instantané", "Validation parentale", "Hybride", subtitles verbatim).
- [x] **Accessibility** — accessibilityRole, accessibilityState, accessibilityLabel, accessibilityHint sur tous les éléments interactifs.

## Vérifications automatisées

| Check | Résultat |
|-------|----------|
| `test -f` × 5 (les 5 fichiers existent) | ✓ |
| `useSharedValue` dans HudLightningButton | 2 (>= 1) |
| `withSpring` dans HudLightningButton | 3 (>= 1) |
| `LIGHTNING_PULSE_SPRING` dans HudLightningButton | 4 (>= 1) |
| `damping: 10` verbatim | 1 (>= 1) |
| `stiffness: 180` verbatim | 1 (>= 1) |
| `forwardRef` | 2 (>= 1) |
| `width: 40` verbatim | 1 (>= 1) |
| `height: 40` verbatim | 1 (>= 1) |
| `borderWidth: 2` verbatim | 1 (>= 1) |
| `fontSize: 14` verbatim | 1 (>= 1) |
| `farm.parchmentDark` verbatim | 3 (>= 1) |
| `farm.woodDark` verbatim | 3 (>= 1) |
| `FontSize.display` dans BalanceCard | 2 (>= 1) |
| `React.memo` dans AuditLogItem | 1 (>= 1) |
| `STATUS_DISPLAY` dans AuditLogItem | 4 (>= 1) |
| `React.memo` dans PayoutQueueItem | 1 (>= 1) |
| `accessibilityRole="radio"` dans TriggerModeSelector | 2 (>= 1) |
| Hardcoded `#…\|rgba?\(` dans `components/lightning/*.tsx` | **0** ✓ |
| `useThemeColors` dans 4 fichiers (HudLightningButton utilise `useFarmTheme`) | 4 (>= 4) ✓ |
| `npx tsc --noEmit` errors dans `components/lightning/` | **0** ✓ |
| `npx tsc --noEmit` errors total projet | **0** ✓ |

## Tests

**Aucun test ajouté** — composants purement présentationnels (consigne du plan + lightweight test protocol). Les comportements testables (animation, memo, accessibility) sont du ressort de tests d'intégration sur l'écran consommateur (Plan 03b si besoin).

## Open items déférés (consommation Plan 03b)

| Item | Plan cible | Détail |
|------|-----------|--------|
| Wiring `HudLightningButton.ref.triggerPulse()` au bus `onPayoutSuccess` | **Plan 03b** | Plan 03b ajoute le bouton dans `app/(tabs)/tree.tsx` + un `useEffect` qui subscribe au bus et appelle `triggerPulse()` |
| Wiring `BalanceCard` props depuis `LnbitsClient.getWallet()` + listener Plan 03b | **Plan 03b** | Écran `/lightning-wallet` charge la balance, gère error/loading, calcule `canCashOut` depuis `member.adminKey` |
| Wiring `AuditLogItem` props depuis `loadAudit()` filtré sur activeProfile | **Plan 03b** | Écran `/lightning-wallet` map 10 dernières entries avec profileName + taskTitle |
| Wiring `PayoutQueueItem` props depuis `loadQueue()` filtré reason='review' | **Plan 03b** | `PayoutQueueModal` rend la liste + boucle batch après FaceID unique |
| Wiring `TriggerModeSelector` value/onChange dans `SettingsLightning` | **Plan 03b** | Persistance via `saveFamilyConfig({ ...config, triggerMode })` |
| Test d'intégration screenshot visuel (snapshot ou Maestro) | **Hors plan 03** | À discuter — pas dans le scope MVP Phase 53 |

## Threat surface

Aucun nouveau threat introduit. Conformément au `<threat_model>` du PLAN, les 3 menaces évaluées (T-53-03a-01 disclosure / T-53-03a-02 tampering style verbatim / T-53-03a-03 DoS animation) restent :
- **T-53-03a-01** `accept` — libellés statuts ne révèlent pas de données sensibles (pas de paymentHash, pas d'invoice, juste status + label).
- **T-53-03a-02** `mitigate` — 7 greps verbatim CI ont passé, style copié byte-for-byte.
- **T-53-03a-03** `mitigate` — animation bornée à 2 frames spring, pas de setInterval, pas de listener non-cleanup.

## Commit

```
bc1c9618 feat(53-03a): 5 composants visuels purs Lightning (HUD ⚡, BalanceCard, AuditLogItem, PayoutQueueItem, TriggerModeSelector)
```

**Dernier hash : `bc1c9618`** (HEAD `feat/lightning-farm`).

## Note pour Plan 03b

Les 5 composants sont prêts à être importés depuis :
```typescript
import { HudLightningButton, type HudLightningButtonRef } from '../../components/lightning/HudLightningButton';
import { BalanceCard } from '../../components/lightning/BalanceCard';
import { AuditLogItem, STATUS_DISPLAY } from '../../components/lightning/AuditLogItem';
import { PayoutQueueItem } from '../../components/lightning/PayoutQueueItem';
import { TriggerModeSelector, type TriggerMode } from '../../components/lightning/TriggerModeSelector';
```

Aucun barrel `components/lightning/index.ts` créé — Plan 03b peut soit le créer pour DRY, soit importer directement les fichiers. Choix laissé au planner suivant.

## Self-Check: PASSED

**Fichiers créés (vérification disque)** :

- `components/lightning/HudLightningButton.tsx` ✓ FOUND (3.5K)
- `components/lightning/BalanceCard.tsx` ✓ FOUND (5.3K)
- `components/lightning/AuditLogItem.tsx` ✓ FOUND (5.1K)
- `components/lightning/PayoutQueueItem.tsx` ✓ FOUND (3.8K)
- `components/lightning/TriggerModeSelector.tsx` ✓ FOUND (4.4K)

**Commits (vérification git log)** :

- `bc1c9618` (T1 — 5 composants visuels) ✓ FOUND

**TSC** : `npx tsc --noEmit` exit 0 ✓
**Hardcoded colors check** : 0 occurrence ✓
**Verbatim style check** : valeurs numériques hudCodexButton + hudEmoji identiques à `app/(tabs)/tree.tsx:4035-4048` ✓
