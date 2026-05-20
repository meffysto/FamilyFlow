---
phase: 53-lightning-family-wallet
plan: 03a
type: execute
wave: 3
depends_on: [53-02]
files_modified:
  - components/lightning/HudLightningButton.tsx
  - components/lightning/BalanceCard.tsx
  - components/lightning/AuditLogItem.tsx
  - components/lightning/PayoutQueueItem.tsx
  - components/lightning/TriggerModeSelector.tsx
autonomous: true
requirements: [REQ-1, REQ-8, REQ-3, REQ-4]
requirements_addressed: [REQ-1, REQ-8, REQ-3, REQ-4]
tags: [lightning, ui, components, reanimated, memo]

user_setup: []

must_haves:
  truths:
    - "HudLightningButton expose `triggerPulse()` via `useImperativeHandle` + ref forward, scale animation Reanimated 4 (1→1.2→1 spring damping:10 stiffness:180 ~600ms) — D-04"
    - "Le style `hudCodexButton` ET `hudEmoji` sont copiés VERBATIM depuis `app/(tabs)/tree.tsx` lignes 3508-3524 + 4035-4048 (40×40, Radius.full, bg farm.parchmentDark, borderWidth 2, borderColor farm.woodDark, marginLeft Spacing.sm, emoji fontSize 14) — seul le glyph `⚡` et le testID changent — D-01"
    - "BalanceCard affiche balance en sats (FontSize.display 24px FontWeight.semibold) + timestamp 'Mis à jour il y a X min' + bouton Encaisser avec disabled state si !canCashOut — UI-SPEC Surface 2 + REQ-10"
    - "AuditLogItem (React.memo) affiche icône statut + titre tâche + prénom + JJ/MM/AAAA + chip statut via STATUS_DISPLAY map — UI-SPEC Surface 3"
    - "PayoutQueueItem (React.memo) affiche avatar emoji 36×36 + prénom + sats à droite + titre tâche + JJ/MM — UI-SPEC Surface 4"
    - "TriggerModeSelector affiche 3 radio cards (instant / daily-review / hybrid) avec accessibilityRole='radio' + accessibilityState — UI-SPEC Surface 6 + REQ-3"
    - "Zéro couleur hardcoded : `grep -nE '#[0-9A-Fa-f]{3,8}|rgba?\\(' components/lightning/*.tsx | grep -v '^[[:space:]]*//' | wc -l` → 0"
    - "Toutes les couleurs via `useThemeColors()` (CLAUDE.md conventions)"
    - "Animations Reanimated 4 uniquement (jamais RN Animated) — CLAUDE.md"
    - "Tous les libellés en français strict — UI-SPEC Copywriting Contract + CLAUDE.md"
    - "Aucun fichier d'app/écran/modal modifié dans ce plan — Plan 03b assure l'intégration"
    - "`npx tsc --noEmit` clean sur les nouveaux composants"
  artifacts:
    - path: "components/lightning/HudLightningButton.tsx"
      provides: "Bouton ⚡ HUD avec animation pulse Reanimated 4 + Haptics + ref forward triggerPulse"
      contains: "useSharedValue(1)"
    - path: "components/lightning/BalanceCard.tsx"
      provides: "Carte balance hero (display 24px) + timestamp + bouton Encaisser disabled state"
      contains: "FontSize.display"
    - path: "components/lightning/AuditLogItem.tsx"
      provides: "Item liste audit memoïsé avec STATUS_DISPLAY map"
      contains: "React.memo"
    - path: "components/lightning/PayoutQueueItem.tsx"
      provides: "Item liste validation memoïsé"
      contains: "React.memo"
    - path: "components/lightning/TriggerModeSelector.tsx"
      provides: "3 radio cards (instant / daily-review / hybrid) avec accessibilityRole radio"
      contains: "instant\\|daily-review\\|hybrid"
  key_links:
    - from: "HudLightningButton.tsx"
      to: "tree.tsx (consommé Plan 03b)"
      via: "ref triggerPulse + onPress"
      pattern: "forwardRef\\|useImperativeHandle"
    - from: "BalanceCard.tsx"
      to: "lightning-wallet.tsx (consommé Plan 03b)"
      via: "props balanceSats + lastUpdatedAt + canCashOut + onCashOut"
      pattern: "balanceSats"
    - from: "AuditLogItem.tsx + PayoutQueueItem.tsx"
      to: "lightning-wallet.tsx + PayoutQueueModal.tsx (consommés Plan 03b)"
      via: "props memoïsés"
      pattern: "React.memo"
---

<objective>
Livrer **les 5 composants visuels purs Lightning** (sans intégration ni navigation) consommés par Plan 03b. Ces composants sont stateless ou avec état local minimum, totalement réutilisables. Le contrat visuel (style verbatim hudCodexButton, FontSize.display, STATUS_DISPLAY, radio cards) est figé ici. Aucun écran, aucun modal, aucun listener event — Plan 03b les consomme.

Purpose: Découpler la construction visuelle (Wave 3 — 5 composants) de l'intégration applicative (Wave 4 — modals, écran route, listener event-driven, extension tree.tsx + SettingsLightning). Diminuer le risque de PR géante et faciliter le review visuel sans contrainte logique.

Output: 5 nouveaux composants `components/lightning/*.tsx` + zéro hardcoded couleur + tokens design + animations Reanimated 4 + memoïsation list items.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/53-lightning-family-wallet/53-SPEC.md
@.planning/phases/53-lightning-family-wallet/53-CONTEXT.md
@.planning/phases/53-lightning-family-wallet/53-UI-SPEC.md
@.planning/phases/53-lightning-family-wallet/53-RESEARCH.md
@.planning/phases/53-lightning-family-wallet/53-PATTERNS.md
@CLAUDE.md
@lib/lightning/index.ts
@app/(tabs)/tree.tsx
@contexts/ThemeContext.tsx
@contexts/ToastContext.tsx
@constants/spacing.ts
@constants/typography.ts
@constants/shadows.ts
@components/ui/SettingsRow.tsx

<interfaces>
<!-- Style verbatim source — Plan 03b doit voir EXACTEMENT le même contrat -->

`app/(tabs)/tree.tsx` lignes 3508-3524 (référence verbatim pour `hudCodexButton`) :
```typescript
<TouchableOpacity
  style={styles.hudCodexButton}
  onPress={() => { Haptics.selectionAsync(); setShowCodex(true); }}
  accessibilityLabel={t('codex:modal.title')}
  accessibilityRole="button"
>
  <Text style={styles.hudEmoji}>{'📖'}</Text>
</TouchableOpacity>
{/* Capture d'écran sans HUD → partage iOS */}
<TouchableOpacity
  style={styles.hudCodexButton}
  onPress={handleScreenshot}
  accessibilityLabel="Capture d'écran"
  accessibilityRole="button"
>
  <Text style={styles.hudEmoji}>{'📷'}</Text>
</TouchableOpacity>
```

`app/(tabs)/tree.tsx` lignes 4035-4048 (StyleSheet definitions — à COPIER VERBATIM dans HudLightningButton.tsx) :
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

**WARNING #8 — Style verbatim mandatory** : NE PAS paraphraser, NE PAS recalculer en chiffres (pas de "32×32 padding 4 emoji 18px"). LIRE le source `app/(tabs)/tree.tsx` lignes 3508-3524 ET 4035-4048 ; COPIER les définitions VERBATIM. Adapter UNIQUEMENT (a) le glyph emoji `⚡`, (b) le testID/accessibilityLabel "Portefeuille Lightning".

HudLightningButton API :
```typescript
export interface HudLightningButtonRef { triggerPulse: () => void; }
export const HudLightningButton = forwardRef<HudLightningButtonRef, { onPress: () => void }>(...)
// useSharedValue(1) + useAnimatedStyle({ transform: [{ scale }] }) + withSpring(1.2, LIGHTNING_PULSE_SPRING) → withSpring(1) chain
// const LIGHTNING_PULSE_SPRING = { damping: 10, stiffness: 180 } as const;
// onPress : Haptics.selectionAsync() + props.onPress()
// triggerPulse : Haptics.impactAsync(Light) + scale.value sequence
```

BalanceCard API :
```typescript
interface BalanceCardProps {
  balanceSats: number | null;  // null = loading
  lastUpdatedAt?: Date;
  canCashOut: boolean;
  onCashOut: () => void;
  errorMessage?: string;       // si présent : "—" + AlertTriangle + message
}
```

AuditLogItem API :
```typescript
interface AuditLogItemProps {
  entry: AuditEntry;
  profileName: string;
  taskTitle: string;
}
```

STATUS_DISPLAY (constante module exposée, consommée par AuditLogItem) :
```typescript
const STATUS_DISPLAY: Record<AuditStatus, { label: string; icon: 'CheckCircle2'|'Clock'|'AlertTriangle'|'XCircle'; chipFgKey: string; chipBgKey: string }> = {
  paid:                { label: 'Reçu',         icon: 'CheckCircle2', chipFgKey: 'successText', chipBgKey: 'successBg' },
  cash_out:            { label: 'Encaissé',     icon: 'CheckCircle2', chipFgKey: 'successText', chipBgKey: 'successBg' },
  queued:              { label: 'En attente',   icon: 'Clock',        chipFgKey: 'warningText', chipBgKey: 'warningBg' },
  capped:              { label: 'Plafond',      icon: 'AlertTriangle',chipFgKey: 'warningText', chipBgKey: 'warningBg' },
  failed:              { label: 'Échoué',       icon: 'XCircle',      chipFgKey: 'errorText',   chipBgKey: 'errorBg'   },
  already_paid_today:  { label: 'Déjà payé',    icon: 'XCircle',      chipFgKey: 'textMuted',   chipBgKey: 'cardAlt'   },
  undone:              { label: 'Annulé',       icon: 'XCircle',      chipFgKey: 'textMuted',   chipBgKey: 'cardAlt'   },
  attribution_failed:  { label: 'Non attribué', icon: 'XCircle',      chipFgKey: 'textMuted',   chipBgKey: 'cardAlt'   },
};
```

PayoutQueueItem API :
```typescript
interface PayoutQueueItemProps {
  item: PayoutQueueItem;
  profile: Profile | undefined;
  taskTitle: string;
}
```

TriggerModeSelector API :
```typescript
interface TriggerModeSelectorProps {
  value: 'instant' | 'daily-review' | 'hybrid';
  onChange: (mode: 'instant' | 'daily-review' | 'hybrid') => void;
}
// 3 radio cards via TouchableOpacity, accessibilityRole="radio", accessibilityState={{ checked }}
// Sélectionné : borderColor: primary, borderWidth: 1.5 + dot blanc 8px sur fond primary
// Non sélectionné : borderColor: colors.border, borderWidth: 1 + dot vide
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1 : 5 composants visuels Lightning (HudLightningButton + BalanceCard + AuditLogItem + PayoutQueueItem + TriggerModeSelector)</name>
  <read_first>
    - .planning/phases/53-lightning-family-wallet/53-UI-SPEC.md (sections Surface 1, Surface 2, Surface 3 statuts, Surface 4, Surface 6, Animations)
    - .planning/phases/53-lightning-family-wallet/53-PATTERNS.md (sections HUD button, BalanceCard, AuditLogItem, SettingsRow)
    - app/(tabs)/tree.tsx lignes 3508-3524 (pattern hudCodexButton à dupliquer) ET lignes 4035-4048 (StyleSheet hudCodexButton + hudEmoji à COPIER VERBATIM)
    - contexts/ToastContext.tsx (signature ToastSeal V2 — référence)
    - constants/spacing.ts, constants/typography.ts, constants/shadows.ts (tokens)
    - components/ui/SettingsRow.tsx (pattern row navigable — référence pour cohérence styling)
    - CLAUDE.md (animations Reanimated 4 + useThemeColors + tokens)
  </read_first>
  <behavior>
    - HudLightningButton : visible avec emoji ⚡, scale 1 par défaut. Méthode triggerPulse() lance withSpring 1→1.2→1 (LIGHTNING_PULSE_SPRING). Tap → onPress callback + Haptics.selectionAsync().
    - BalanceCard : affiche balance en sats (FontSize.display 24px semibold), timestamp "Mis à jour il y a X min", bouton Encaisser disabled si !canCashOut (accessibilityHint "Admin key requise"). Skeleton si balanceSats === null.
    - AuditLogItem : icône statut (14px) + titre tâche + prénom + JJ/MM/AAAA + chip statut via STATUS_DISPLAY map. memoïsé.
    - PayoutQueueItem : avatar emoji profil 36×36 Radius.full, prénom + sats à droite, titre tâche + JJ/MM en colonne. memoïsé.
    - TriggerModeSelector : 3 radio cards, sélectionné bordure primary 1.5px + radio dot plein, callback onChange(mode), accessibilityRole="radio".
  </behavior>
  <action>
    1. **components/lightning/HudLightningButton.tsx** — Créer composant Reanimated 4. Imports : `forwardRef, useImperativeHandle, useState`, `TouchableOpacity, Text, View, StyleSheet`, `Animated, useSharedValue, useAnimatedStyle, withSpring` depuis `react-native-reanimated`, `Haptics` depuis `expo-haptics`, `Radius, Spacing` depuis `constants/*`, `farm` palette utilisée verbatim depuis `app/(tabs)/tree.tsx` (vérifier l'import du module palette farm — `import { farm } from '../../constants/colors'` ou similaire selon le pattern existant).
       - Constante module en haut : `const LIGHTNING_PULSE_SPRING = { damping: 10, stiffness: 180 } as const;`
       - Export : `export interface HudLightningButtonRef { triggerPulse: () => void; }` + `export const HudLightningButton = forwardRef<HudLightningButtonRef, { onPress: () => void }>((props, ref) => { ... })`
       - À l'intérieur :
         - `const scale = useSharedValue(1);`
         - `const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));`
         - `useImperativeHandle(ref, () => ({ triggerPulse: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); scale.value = withSpring(1.2, LIGHTNING_PULSE_SPRING, () => { scale.value = withSpring(1, LIGHTNING_PULSE_SPRING); }); } }));`
         - Render :
           ```tsx
           <Animated.View style={animatedStyle}>
             <TouchableOpacity
               style={styles.hudCodexButton}
               onPress={() => { Haptics.selectionAsync(); props.onPress(); }}
               accessibilityLabel="Portefeuille Lightning"
               accessibilityRole="button"
               testID="hud-lightning-button"
             >
               <Text style={styles.hudEmoji}>{'⚡'}</Text>
             </TouchableOpacity>
           </Animated.View>
           ```
       - StyleSheet **VERBATIM depuis `app/(tabs)/tree.tsx` lignes 4035-4048** (WARNING #8 — interdiction de paraphraser/recalculer) :
         ```typescript
         const styles = StyleSheet.create({
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
         });
         ```
       - **OBLIGATION D'EXÉCUTION** : LIRE les lignes 3508-3524 ET 4035-4048 de `app/(tabs)/tree.tsx` à l'instant de l'implémentation. NE PAS recalculer en chiffres. COPIER VERBATIM le style — adapter UNIQUEMENT le glyph emoji `⚡` et le testID. Si la palette `farm` n'est pas exportée depuis `constants/colors`, l'importer du même endroit que `tree.tsx` (lire les imports de tree.tsx pour identifier le chemin exact).

    2. **components/lightning/BalanceCard.tsx** — Composant props `{ balanceSats: number | null; lastUpdatedAt?: Date; canCashOut: boolean; onCashOut: () => void; errorMessage?: string }`. Card avec `Shadows.md`, `Radius.xl`, padding `Spacing['3xl']`. Background `colors.card`. Balance : si `errorMessage` → "—" + icône `AlertTriangle` 16px `colors.warning` + texte error sous-fond. Sinon si `balanceSats === null` → skeleton (2 View rectangles `colors.cardAlt` opacity 0.6). Sinon : `<Text style={{ fontSize: FontSize.display, fontWeight: FontWeight.semibold, color: colors.text }}>{balanceSats} sats</Text>`. Timestamp : helper local `formatRelativeTime(lastUpdatedAt)` retournant "Mis à jour il y a X min" (Math.floor((Date.now() - lastUpdatedAt.getTime()) / 60000) — "à l'instant" si < 1min ; "il y a 1 h" si > 60min, etc.). Bouton Encaisser : `Button` maison existant (ou TouchableOpacity styled) primaire, `disabled={!canCashOut}`, `accessibilityHint={!canCashOut ? "Admin key requise pour encaisser" : undefined}`, onPress={onCashOut}.

    3. **components/lightning/AuditLogItem.tsx** — Composant `React.memo` props `{ entry: AuditEntry; profileName: string; taskTitle: string }`. Layout horizontal : (a) icône statut Lucide-React-Native via icon-name lookup (CheckCircle2/Clock/AlertTriangle/XCircle, 14px), contenue dans un View 24×24 `Radius.full` avec bg dérivé du statut (`colors[STATUS_DISPLAY[entry.status].chipBgKey]`). (b) col centrale flex:1 : titre tâche (`FontSize.body`, `FontWeight.semibold`, `numberOfLines:1`) + prénom + JJ/MM/AAAA (`FontSize.caption`, `colors.textSub`). (c) chip statut à droite via composant `Chip` maison existant (`components/ui/Chip.tsx`), props `{ label, fgColor, bgColor }`. Format date : utiliser `date-fns` format `'dd/MM/yyyy'` locale fr (vérifier import depuis `date-fns/locale` — pattern existant `lib/parser.ts`).
       - **STATUS_DISPLAY** const exportée depuis `AuditLogItem.tsx` (cf. `<interfaces>` block) — consommée par PayoutQueueItem si besoin et tests.
       - Si pas de `profileName` (entry.profileId orphelin) → afficher "—".
       - `React.memo` avec equality function par défaut (les props sont primitives + objet entry stable).

    4. **components/lightning/PayoutQueueItem.tsx** — Composant `React.memo` props `{ item: PayoutQueueItem; profile: Profile | undefined; taskTitle: string }`. Card bg `colors.card`, `Radius.lg`, `Shadows.sm`, padding `Spacing.xl`. Avatar emoji 36×36 (`profile.avatar` du projet — si pas dispo : emoji '👤' en fallback). À droite du avatar : prénom (`FontSize.body`, `FontWeight.semibold`) + sats "{item.sats} sats" (aligné à droite `FontSize.body`, `FontWeight.semibold`). En dessous : taskTitle (`FontSize.label`, `colors.textMuted`, `numberOfLines:1`) + JJ/MM (`FontSize.label`, `colors.textMuted`). Format date `dd/MM` via `date-fns`. `React.memo` par défaut.

    5. **components/lightning/TriggerModeSelector.tsx** — Composant props `{ value: 'instant'|'daily-review'|'hybrid'; onChange: (mode) => void }`. Constante locale `OPTIONS = [{ id:'instant', title:'Instantané', subtitle:'Chaque tâche déclenche un pay-out immédiat' }, { id:'daily-review', title:'Validation parentale', subtitle:'Tu valides les pay-outs en batch une fois par jour' }, { id:'hybrid', title:'Hybride', subtitle:'Instantané jusqu\'à 100 sats/jour, puis en attente' }] as const;`. Render 3 `TouchableOpacity` (gap `Spacing.md`). Pour chaque option : View row avec radio dot 20×20 `Radius.full` + col texte (title + subtitle). Sélectionné (`value === option.id`) : container `borderColor: primary, borderWidth: 1.5`, radio bg primary + petit View 8×8 `Radius.full` bg white centré. Non sélectionné : container `borderColor: colors.border, borderWidth: 1`, radio bg `colors.cardAlt` + border `colors.border`. `accessibilityRole="radio"` + `accessibilityState={{ checked: value === option.id }}` + `accessibilityLabel={option.title}`. `Haptics.selectionAsync()` à chaque onChange.

    6. **Vérification finale** : `npx tsc --noEmit` clean sur tous les nouveaux fichiers. Aucun hardcoded `#`/`rgba`/valeur numérique nue : `grep -nE "#[0-9A-Fa-f]{3,8}|rgba?\\(" components/lightning/*.tsx | grep -v "^[[:space:]]*//" | wc -l` retourne 0.
    7. **Vérification verbatim hudCodexButton** : `grep -A 10 "hudCodexButton:" app/(tabs)/tree.tsx | head -20` (référence à comparer manuellement avec `components/lightning/HudLightningButton.tsx`). Le commit final doit prouver le copier-coller verbatim — pas de divergence chiffrée.
  </action>
  <verify>
    <automated>test -f components/lightning/HudLightningButton.tsx && test -f components/lightning/BalanceCard.tsx && test -f components/lightning/AuditLogItem.tsx && test -f components/lightning/PayoutQueueItem.tsx && test -f components/lightning/TriggerModeSelector.tsx</automated>
    <automated>grep -c "useSharedValue" components/lightning/HudLightningButton.tsx # >= 1</automated>
    <automated>grep -c "withSpring" components/lightning/HudLightningButton.tsx # >= 1</automated>
    <automated>grep -c "LIGHTNING_PULSE_SPRING" components/lightning/HudLightningButton.tsx # >= 1</automated>
    <automated>grep -c "damping: 10" components/lightning/HudLightningButton.tsx # >= 1 (verbatim spring config)</automated>
    <automated>grep -c "stiffness: 180" components/lightning/HudLightningButton.tsx # >= 1 (verbatim spring config)</automated>
    <automated>grep -c "forwardRef" components/lightning/HudLightningButton.tsx # >= 1</automated>
    <automated>grep -c "width: 40" components/lightning/HudLightningButton.tsx # >= 1 (style verbatim — WARNING #8)</automated>
    <automated>grep -c "height: 40" components/lightning/HudLightningButton.tsx # >= 1 (style verbatim — WARNING #8)</automated>
    <automated>grep -c "borderWidth: 2" components/lightning/HudLightningButton.tsx # >= 1 (style verbatim — WARNING #8)</automated>
    <automated>grep -c "fontSize: 14" components/lightning/HudLightningButton.tsx # >= 1 (hudEmoji verbatim — WARNING #8)</automated>
    <automated>grep -c "farm.parchmentDark" components/lightning/HudLightningButton.tsx # >= 1 (palette verbatim — WARNING #8)</automated>
    <automated>grep -c "farm.woodDark" components/lightning/HudLightningButton.tsx # >= 1 (palette verbatim — WARNING #8)</automated>
    <automated>grep -A 10 "hudCodexButton:" app/\(tabs\)/tree.tsx | head -20 # référence verbatim affichée pour audit visuel</automated>
    <automated>grep -c "FontSize.display" components/lightning/BalanceCard.tsx # >= 1</automated>
    <automated>grep -c "React.memo" components/lightning/AuditLogItem.tsx # >= 1</automated>
    <automated>grep -c "STATUS_DISPLAY" components/lightning/AuditLogItem.tsx # >= 1</automated>
    <automated>grep -c "React.memo" components/lightning/PayoutQueueItem.tsx # >= 1</automated>
    <automated>grep -c "accessibilityRole=\"radio\"" components/lightning/TriggerModeSelector.tsx # >= 1</automated>
    <automated>grep -nE "#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}\\b|rgba?\\(" components/lightning/*.tsx | grep -v "^[[:space:]]*//" | wc -l # == 0 (zéro hardcoded)</automated>
    <automated>grep -lE "useThemeColors" components/lightning/*.tsx | wc -l # >= 4 (presque tous utilisent)</automated>
    <automated>npx tsc --noEmit 2>&1 | grep "components/lightning/" | wc -l # == 0</automated>
  </verify>
  <done>
    5 composants visuels créés avec animation Reanimated 4 (pulse), tokens design, FR strict, memoïsés. Zéro hardcoded couleur. Le style `hudCodexButton` + `hudEmoji` est copié VERBATIM depuis tree.tsx (WARNING #8 enforcé). TSC clean.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Aucun (composants visuels purs) | Aucune entrée non-sollicitée, aucune sortie réseau, aucune persistance. Les composants reçoivent props et exposent callbacks ; toute logique sensible vit dans Plan 03b et au-dessous. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-03a-01 | Information Disclosure | AuditLogItem affiche statut public | accept | Les libellés (Reçu/Encaissé/En attente/Plafond/Échoué/Déjà payé/Annulé/Non attribué) ne révèlent pas de données sensibles (pas de paymentHash, pas d'invoice, pas d'amount > 100 sats fixe). Plan 03b filtre l'audit par profileId actif. |
| T-53-03a-02 | Tampering | Style verbatim hudCodexButton non respecté | mitigate | WARNING #8 enforcé via 7 greps automatiques sur les valeurs verbatim (width 40, height 40, borderWidth 2, fontSize 14, farm.parchmentDark, farm.woodDark, marginLeft Spacing.sm). Toute divergence chiffrée fait échouer le plan. |
| T-53-03a-03 | Denial of Service | Animation Reanimated 4 boucle infinie | mitigate | `triggerPulse` séquence `withSpring(1.2) → withSpring(1)` est borné (2 frames spring max). Aucun setInterval. Aucun listener non-cleanup. |

**Block-on severity:** low. Composants visuels purs, surface d'attaque minimale.
</threat_model>

<verification>
- 5 composants `components/lightning/*.tsx` créés (HudLightningButton, BalanceCard, AuditLogItem, PayoutQueueItem, TriggerModeSelector)
- Style verbatim hudCodexButton (width:40, height:40, borderRadius:Radius.full, backgroundColor:farm.parchmentDark, borderWidth:2, borderColor:farm.woodDark, alignItems:'center', justifyContent:'center', marginLeft:Spacing.sm) et hudEmoji (fontSize:14) appliqué à HudLightningButton
- `useSharedValue` + `withSpring` + `forwardRef` + `useImperativeHandle` présents dans HudLightningButton
- `LIGHTNING_PULSE_SPRING = { damping: 10, stiffness: 180 }` défini comme constante module
- `React.memo` sur AuditLogItem et PayoutQueueItem
- `accessibilityRole="radio"` sur TriggerModeSelector
- `npx tsc --noEmit` clean
- Aucune couleur hardcoded dans `components/lightning/*.tsx` (grep `#[0-9A-Fa-f]{3,6}|rgba?\(` retourne 0 ligne non-commentaire)
- Aucun fichier d'application/écran/modal modifié dans ce plan (Plan 03b s'en charge)
</verification>

<success_criteria>
- 5 composants visuels purs livrés
- HUD ⚡ style identique au visuel HUD existant (📖 codex, 📷 screenshot) — diff visuel imperceptible
- Animation pulse Reanimated 4 prête à être déclenchée via ref
- AuditLogItem et PayoutQueueItem memoïsés pour perf liste
- TriggerModeSelector accessible avec accessibilityRole="radio"
- BalanceCard prête à être consommée par /lightning-wallet (Plan 03b)
- TSC clean
- Aucune dépendance UI non-respectée (CLAUDE.md + UI-SPEC)
</success_criteria>

<output>
After completion, create `.planning/phases/53-lightning-family-wallet/53-03a-SUMMARY.md` listing :
- 5 composants `components/lightning/*.tsx` créés + leur API
- Confirmation style verbatim hudCodexButton (snippet de diff entre tree.tsx:4035-4048 et HudLightningButton.tsx styles)
- Note pour Plan 03b : les composants sont prêts à être consommés (HudLightningButton via ref, BalanceCard/AuditLogItem/PayoutQueueItem en props, TriggerModeSelector via value/onChange)
- TSC clean confirmé
</output>
