---
phase: 53
slug: lightning-family-wallet
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-18
---

# Phase 53 — UI Design Contract
# Lightning Family Wallet — 1 tâche = 100 sats (Labo)

> Contrat visuel et d'interaction pour Phase 53. Généré par gsd-ui-researcher.
> Langue UI : français strict (CLAUDE.md).

---

## Design System

| Propriété | Valeur |
|-----------|--------|
| Outil | none (React Native StyleSheet natif) |
| Preset | not applicable |
| Bibliothèque de composants | Composants maison `components/ui/` (Chip, Badge, Button, ModalHeader, etc.) |
| Bibliothèque d'icônes | `lucide-react-native` (Zap, Bitcoin, ChevronRight, Clock, CheckCircle2, XCircle, AlertTriangle, Camera, Clipboard) |
| Police | Système (San Francisco iOS) + DM Serif Display (titres) + Caveat (sous-titres chaleureux) via `FontFamily.*` |
| Tokens couleur | `useThemeColors()` — JAMAIS de couleur hardcodée |
| Tokens espacement | `Spacing.*` + `Radius.*` de `constants/spacing.ts` |
| Tokens typographie | `FontSize.*` + `FontWeight.*` + `FontFamily.*` de `constants/typography.ts` |
| Tokens ombre | `Shadows.*` de `constants/shadows.ts` |

Source : CLAUDE.md (conventions), constants/ (tokens), tree.tsx:3470-3526 (pattern HUD existant)

---

## Spacing Scale

Échelle projet établie (constants/spacing.ts) — réutilisée telle quelle :

| Token | Valeur | Usage Phase 53 |
|-------|--------|----------------|
| `Spacing.xs` | 4px | Gap icône-texte inline, gap micro |
| `Spacing.md` | 8px | Padding badge sats, gap liste audit |
| `Spacing.lg` | 10px | Padding vertical items liste validation |
| `Spacing.xl` | 12px | Padding card interne, gap sections |
| `Spacing['2xl']` | 16px | Padding horizontal écran `/lightning-wallet`, margin sections |
| `Spacing['3xl']` | 20px | Padding modal encaissement out |
| `Spacing['4xl']` | 24px | Padding safe-area bas, margin bas bouton batch |
| `Spacing['5xl']` | 32px | Espacement sections majeures dans `/lightning-wallet` |

Exceptions : tap targets bouton HUD ⚡ minimum 44×44pt (iOS HIG) — conforme à `styles.hudCodexButton` existant (pattern tree.tsx:3508-3524).

**Exception spacing — Spacing.lg (10px) :** Token projet établi pré-existant (cf. `constants/spacing.ts`). Utilisé pour le padding vertical des items liste validation pour cohérence avec les patterns de listes existants ailleurs dans l'app (cf. `components/settings/SettingsRow.tsx`). Ne PAS introduire de nouveau token 10px — réutiliser `Spacing.lg`. Toutes les autres valeurs d'espacement de cette phase respectent la grille 4px.

---

## Typography

Tokens projet établis (constants/typography.ts) — réutilisés tels quels.

**Poids déclarés : 2 uniquement — `FontWeight.normal` (400) et `FontWeight.semibold` (600).**

| Rôle | Token | Taille | Poids | Line Height | Usage Phase 53 |
|------|-------|--------|-------|-------------|----------------|
| Body | `FontSize.body` | 15px | `FontWeight.normal` (400) | `LineHeight.body` (22) | Description items audit log, texte formulaire bolt11 |
| Label | `FontSize.label` | 13px | `FontWeight.normal` (400) | `LineHeight.tight` (18) | Timestamps audit, métadonnées (JJ/MM/AAAA), sous-titres config |
| Body semibold | `FontSize.body` | 15px | `FontWeight.semibold` (600) | `LineHeight.body` (22) | Nom profil dans liste validation, libellé config trigger mode |
| Heading | `FontSize.heading` | 18px | `FontWeight.semibold` (600) | `LineHeight.title` (28) | Titre section "Ma cagnotte", titre modal "Pay-outs en attente" |
| Title | `FontSize.title` | 20px | `FontWeight.semibold` (600) | `LineHeight.title` (28) | Balance affichée en sats (ex : "3 200 sats") |
| Display balance | `FontSize.display` | 24px | `FontWeight.semibold` (600) | `LineHeight.title` (28) | Chiffre balance hero en haut de `/lightning-wallet` — hiérarchie visuelle assurée par la taille (24px), pas le poids |
| Serif (chaleureux) | `FontFamily.serif` | `FontSize.subtitle` (17px) | 400 | `LineHeight.loose` (26) | Titre toast "+100 sats ⚡" (style ToastSeal existant) |
| Caption | `FontSize.caption` | 12px | `FontWeight.normal` (400) | `LineHeight.tight` (18) | Tooltip "Admin key requise", micro-infos |

**Exception typographie — échelle projet :** Les tailles `FontSize.*` (caption 12, label 13, sm 14, body 15, subtitle 17, heading 18, title 20, display 24) sont des tokens projet établis pré-existants (cf. `constants/typography.ts`), réutilisés tels quels pour cohérence avec les 52 phases précédentes. Aucune nouvelle taille n'est introduite par cette phase. La hiérarchie visuelle s'appuie sur la taille (pas le poids — 2 poids seulement, cf. ci-dessus).

Source : constants/typography.ts (déclaration), ToastContext.tsx:595 (pattern ToastSeal), SettingsRow.tsx (pattern label/subtitle)

---

## Color

Palette gérée exclusivement via `useThemeColors()`. Aucune couleur hardcodée en Phase 53.

| Rôle | Token | Usage Phase 53 |
|------|-------|----------------|
| Dominant (60%) | `colors.bg` | Fond écran `/lightning-wallet`, fond modal validation batch |
| Secondaire (30%) | `colors.card` | Card balance, items liste audit, card section SettingsLightning |
| Accent principal (10%) | `primary` | Icône Zap dans SectionHeader, bordure active radio trigger mode |
| Success | `colors.success` / `colors.successBg` | Statut `paid` dans audit log (icône + fond chip), toast batch réussi |
| Warning | `colors.warning` / `colors.warningBg` | Statut `queued` / `pending` dans audit (icône + fond chip), toast "en attente de réseau" |
| Error | `colors.error` / `colors.errorBg` | Statut `failed` / `capped` dans audit (icône + fond chip), état erreur batch mi-parcours |
| Or brand | `colors.brand.or` | Bordure cadre QR scan (Surface 5) — token projet uniquement, pas de valeur hex inline |
| Texte principal | `colors.text` | Balance sats, titres, libellés boutons |
| Texte secondaire | `colors.textSub` | Timestamps, noms tâches dans audit |
| Texte muted | `colors.textMuted` | Labels config, hints formulaire |
| Texte faint | `colors.textFaint` | Placeholders inputs bolt11 |
| Input | `colors.inputBg` / `colors.inputBorder` | Textarea bolt11, input dailyCap |
| Destructive | `colors.error` | Bouton "Effacer l'historique" (texte uniquement, pas fond) |

Accent (`primary`) réservé exclusivement pour :
- Icône Zap dans les `SectionHeader` Lightning
- Bordure active du radio sélectionné (trigger mode)
- Indicateur de progression FaceID (throbber, si visible)

Source : constants/colors.ts (LightColors/DarkColors), SettingsLightning.tsx (pattern Switch/SectionHeader), CLAUDE.md

---

## Surfaces UI — Contrat par écran

### Surface 1 — Bouton HUD ⚡ (`app/(tabs)/tree.tsx`)

**Composant :** `TouchableOpacity` inline, style `styles.hudCodexButton` (à dupliquer sans modification).

**Anatomie :**
```
<TouchableOpacity
  style={styles.hudCodexButton}           // copie exacte du pattern 📖 et 📷
  onPress={handleLightningPress}          // Haptics.selectionAsync() + router.push('/lightning-wallet')
  accessibilityLabel="Portefeuille Lightning"
  accessibilityRole="button"
>
  <Text style={styles.hudEmoji}>{'⚡'}</Text>
</TouchableOpacity>
```

**Visibilité :** conditionnel strict — `LIGHTNING_ENABLED === true && memberWallets[activeProfile.id] !== undefined`. Si condition non remplie : `null` (pas de rendu, pas de bouton désactivé).

**États visuels :**
| État | Apparence |
|------|-----------|
| Default | Emoji ⚡, même opacité/taille que 📖 et 📷 — aucun indicateur permanent |
| Loading (navigation en cours) | Pas d'état loading visible (navigation instantanée) |
| Pulse (pay-out reçu) | Scale 1.0 → 1.2 → 1.0 + glow overlay (voir section Animations) |
| Disabled (LIGHTNING off / profil sans wallet) | Non rendu (`return null`) |

**Position :** après le bouton 📷 (screenshot), ligne ~3524, à l'intérieur de `hudContent`.

---

### Surface 2 — Toast "+100 sats ⚡"

**Composant :** `useToast().showToast()` — variante V2 "Sceau de cire" (ToastSeal) car `icon` ET `subtitle` fournis.

**Déclencheur :** listener pay-out success (D-04), app en foreground.

**Appel exact :**
```typescript
showToast(
  '+100 sats ⚡',        // message principal
  'success',              // type → palette sapin warm
  undefined,              // pas d'action undo
  {
    icon: '⚡',
    subtitle: nomProfil,  // ex : "Lucas"
  }
);
```

**Résultat visuel :** ToastSeal existant avec fond gradient parchemin→miel, sceau vert sapin, glyph ⚡, titre "+100 sats ⚡" en DM Serif 16px, sous-titre nomProfil en Caveat SemiBold 16px. Auto-dismiss 2500ms. Slide-in translateY -120→0 + scale 0.9→1.0, durée 280ms easing Easing.out(cubic).

**Copywriting :** "+100 sats ⚡" (message) + nomProfil (subtitle). Jamais "Bravo !", "Tu as gagné !", "Récompense !".

**Toast réseau indisponible :**
```typescript
showToast('En attente de réseau — pay-out mis en file', 'info');
```
Variante V1 "Tag parchemin" (pas d'icon+subtitle), fond parchemin, bandeau or, dismiss 2500ms.

**Toast résumé batch (post-FaceID) :**
```typescript
// Succès total
showToast('3 pay-outs validés · 300 sats envoyés', 'success');
// Succès partiel
showToast('2/3 pay-outs réussis · 1 en attente de retry', 'info');
// Échec total
showToast('Aucun pay-out n\'a abouti — tous en attente', 'error');
```

---

### Surface 3 — Écran `/lightning-wallet`

**Route expo-router :** `app/lightning-wallet.tsx` (hors tabs).
**Header :** `ScreenHeader` existant avec titre "Ma cagnotte" + bouton retour natif iOS.
**Scroll :** `ScrollView` avec `contentContainerStyle={{ paddingHorizontal: Spacing['2xl'], paddingBottom: Spacing['4xl'] }}`.

**Anatomie (top → bas) :**

#### Section 1 — Balance hero
```
┌─────────────────────────────────────┐
│  ⚡  [balance] sats                  │  ← FontSize.display (24px) semibold, colors.text
│  Mis à jour il y a [N] min          │  ← FontSize.caption (12px) colors.textMuted
│  [Bouton Encaisser]                  │
└─────────────────────────────────────┘
```
Card : `colors.card`, `Shadows.md`, `Radius.xl`, padding `Spacing['3xl']`.
Balance : `FontSize.display` (24px), `FontWeight.semibold` (600), `colors.text`. Hiérarchie visuelle assurée par la taille (24px display).
Timestamp : `FontSize.caption` (12px), `colors.textMuted`, format "Mis à jour il y a X min" (pas de format clock).
Bouton "Encaisser" : composant `Button` existant, variante primaire, disabled si `!memberWallet.adminKey` (voir état disabled ci-dessous).

**État balance loading :** placeholder animé — 2 rectangles `colors.cardAlt` (skeleton), `Radius.sm`, largeur 120px + 80px, hauteur 28px + 16px, opacity 0.6.
**État balance error :** texte "—" à la place du chiffre + icône `AlertTriangle` 16px `colors.warning`. Sous le "—" : texte `lightning.balance.error` = "Solde indisponible — vérifiez votre connexion." (`FontSize.caption` 12px, `FontWeight.normal` 400, `colors.warning`).

#### Section 2 — Historique (10 dernières entrées audit)

Titre section : "Historique" — `FontSize.heading` (18px), `FontWeight.semibold`, `FontFamily.serif`, `colors.text`, margin bottom `Spacing.xl`.

Chaque item audit :
```
┌──┬────────────────────────────────┬──────────┐
│⬤ │ [Titre tâche]             sats │ [chip]   │
│  │ [Prénom profil] · [JJ/MM]      │          │
└──┴────────────────────────────────┴──────────┘
```
- Icône statut (24×24pt, `Radius.full`) : voir tableau statuts ci-dessous
- Titre tâche : `FontSize.body` (15px), `FontWeight.semibold` (600), `colors.text`, 1 ligne max
- Sats : `FontSize.sm` (14px), `FontWeight.semibold` (600), `colors.text`
- Prénom + date : `FontSize.caption` (12px), `colors.textSub`, format JJ/MM/AAAA
- Chip statut : `Chip` existant (voir tableau statuts)
- Séparateur : `StyleSheet.hairlineWidth`, `colors.separator`

**Tableau statuts audit :**
| Statut | Icône Lucide | Couleur icône | Chip label | Chip couleur fond | Chip couleur texte |
|--------|-------------|---------------|------------|-------------------|-------------------|
| `paid` | `CheckCircle2` 14px | `colors.success` | "Reçu" | `colors.successBg` | `colors.successText` |
| `cash_out` | `CheckCircle2` 14px | `colors.success` | "Encaissé" | `colors.successBg` | `colors.successText` |
| `queued` | `Clock` 14px | `colors.warning` | "En attente" | `colors.warningBg` | `colors.warningText` |
| `capped` | `AlertTriangle` 14px | `colors.warning` | "Plafond" | `colors.warningBg` | `colors.warningText` |
| `failed` | `XCircle` 14px | `colors.error` | "Échoué" | `colors.errorBg` | `colors.errorText` |
| `already_paid_today` | `XCircle` 14px | `colors.textMuted` | "Déjà payé" | `colors.cardAlt` | `colors.textMuted` |
| `undone` | `XCircle` 14px | `colors.textMuted` | "Annulé" | `colors.cardAlt` | `colors.textMuted` |

**État empty :** icône `Zap` 40px `colors.textFaint`, texte "Aucun paiement pour l'instant" (`FontSize.body`, `colors.textMuted`), sous-texte "Les pay-outs apparaîtront ici au fil des tâches." (`FontSize.label`, `colors.textFaint`). Centré verticalement avec `paddingTop: Spacing['5xl']`.

#### Section 3 — Bouton "Effacer l'historique"
Texte seul, `FontSize.label` (13px), `colors.error`, centré, margin top `Spacing['5xl']`. Confirmation via `Alert.alert('Effacer l\'historique ?', 'Toutes les entrées seront supprimées définitivement.', [{text:'Annuler',style:'cancel'},{text:'Effacer',style:'destructive',onPress:…}])`.

---

### Surface 4 — Modal "Pay-outs en attente" (validation batch parent)

**Présentation :** `Modal` + `presentationStyle="pageSheet"` + `animationType="slide"`. `ModalHeader` existant avec titre "Pay-outs en attente" + bouton fermeture (drag-to-dismiss activé).

**Focal point :** Bouton batch "Valider les N pay-outs (N×100 sats)" en bas pleine largeur (52pt, `FontSize.subtitle` 17px semibold, `colors.primary` background). C'est l'ancre visuelle primaire — le parent voit le commitment total avant FaceID. La liste verticale au-dessus est le contexte secondaire.

**Anatomie :**

```
[ModalHeader "Pay-outs en attente"]
─────────────────────────────────────
ScrollView
  [Item 1] [Item 2] [Item 3]...
─────────────────────────────────────
[Bouton "Valider N pay-outs (N×100 sats)"]
[SafeAreaView padding bas]
```

**Item liste validation :**
```
┌─────────────────────────────────────────┐
│  [Avatar emoji profil, 36×36, Radius.full]  │
│  [Prénom]                    100 sats   │  ← FontSize.body semibold + FontSize.body semibold
│  [Titre tâche]               [JJ/MM]    │  ← FontSize.label + FontSize.label colors.textMuted
└─────────────────────────────────────────┘
```
Background : `colors.card`, `Radius.lg`, `Shadows.sm`, padding `Spacing.xl`.
Séparateur entre items : `Spacing.md` de gap (FlatList/ScrollView gap, pas de ligne).

**État liste vide :** impossible (modal n'est accessible que si queue non vide — bouton absent dans Settings si N=0).

**Bouton batch :**
- Label exact : `Valider {N} pay-out{N>1?'s':''} ({N*100} sats)`
- Composant `Button` variante primaire, pleine largeur, hauteur 52pt, `Radius.xl`
- `FontSize.subtitle` (17px), `FontWeight.semibold`
- Padding horizontal : `Spacing['2xl']`, margin bottom : `Spacing['4xl']` + insets.bottom
- État loading (FaceID en cours) : `Button` disabled + ActivityIndicator inline (remplacement label)
- État success (post-validation) : dismiss automatique de la modal

**FaceID gate :** `authenticatePayOut({ reason: 'Valider les pay-outs Lightning' })`. Pas d'UI custom — biometric sheet iOS natif.

**Comportement échec mid-batch (D-09) :** toast résumé via `showToast('X/Y pay-outs réussis · N en attente de retry', 'info')` puis fermeture de la modal. Les items restants réapparaissent à la réouverture.

---

### Surface 5 — Modal "Encaisser" (bolt11 + scan QR)

**Présentation :** `Modal` + `presentationStyle="pageSheet"` + `animationType="slide"`. `ModalHeader` "Encaisser vers wallet externe" + bouton fermeture.

**Anatomie :**

```
[ModalHeader "Encaisser vers wallet externe"]
─────────────────────────────────────────────
ScrollView (KeyboardAvoidingView behavior="padding")
  [Label "Coller une invoice Lightning (bolt11)"]
  [TextInput multiline, 4 lignes, monospace, secureTextEntry:false]
  [Bouton "Coller depuis le presse-papiers"] (secondaire)
  ──────────────────────────────────────────
  [Bouton "Scanner un QR code"]             (secondaire, icône Camera)
  ──────────────────────────────────────────
  [Info : "La transaction est définitive. Vérifiez l'invoice avant de valider."]
─────────────────────────────────────────────
[Bouton "Confirmer l'encaissement"] (primaire, gated FaceID)
[SafeAreaView padding bas]
```

**TextInput bolt11 :**
- `colors.inputBg`, `colors.inputBorder`, `Radius.md`, padding `Spacing.xl`
- `FontSize.sm` (14px), `FontWeight.normal`, `colors.text`
- `placeholder="lnbc1..."`, `placeholderTextColor={colors.textFaint}`
- `multiline={true}`, `numberOfLines={4}`, `autoCapitalize="none"`, `autoCorrect={false}`

**Bouton "Coller depuis le presse-papiers" :**
- Variante secondaire (outline), icône `Clipboard` 16px, label "Coller depuis le presse-papiers"
- `FontSize.body` (15px), pleine largeur, `Radius.md`

**Bouton "Scanner un QR code" :**
- Variante secondaire (outline), icône `Camera` 16px, label "Scanner un QR code"
- `FontSize.body` (15px), pleine largeur, `Radius.md`

**Info disclaimer :**
- Background `colors.warningBg`, border `colors.warning`, `Radius.md`, padding `Spacing.xl`
- Icône `AlertTriangle` 14px `colors.warningText` + texte "La transaction Lightning est définitive. Vérifiez l'invoice avant de confirmer."
- `FontSize.caption` (12px), `colors.warningText`

**Bouton "Confirmer l'encaissement" :**
- Primaire, disabled si textarea vide
- Label : "Confirmer l'encaissement"
- `FontSize.subtitle` (17px), `FontWeight.semibold`, pleine largeur, hauteur 52pt

**FaceID gate :** `authenticatePayOut({ reason: 'Confirmer l\'encaissement Lightning' })` au tap sur Confirmer.

**Écran scan QR (expo-camera) :**
- Modal plein écran (pas pageSheet) par-dessus la modal encaissement
- Fond noir, cadre de scan centré (overlay carré 240×240pt, bordure 2px `colors.brand.or`)
- Bouton fermeture en haut à droite : ✕ blanc sur fond `colors.overlay` (token projet existant — scrim modal plein, cf. `constants/colors.ts:54`), 44×44pt
- Feedback au scan réussi : `Haptics.notificationAsync(NotificationFeedbackType.Success)` + fermeture automatique + paste dans le textarea

---

### Surface 6 — Section SettingsLightning étendue

**Fichier :** `components/settings/SettingsLightning.tsx` (extension du composant existant).

#### Sous-section "Mode de déclenchement"

Titre : `SectionHeader` avec icône `Clock` 16px, label "Déclenchement des pay-outs".

Trois options radio (pattern SegmentedControl ou liste radio custom) :

| Option | Label | Sous-label |
|--------|-------|------------|
| `instant` | "Instantané" | "Chaque tâche déclenche un pay-out immédiat" |
| `daily-review` | "Validation parentale" | "Tu valides les pay-outs en batch une fois par jour" |
| `hybrid` | "Hybride" | "Instantané jusqu'à 100 sats/jour, puis en attente" |

Style item radio : `TouchableOpacity`, background `colors.card`, `Shadows.xs`, `Radius.md`. Sélectionné : bordure `primary` 1.5px. Non sélectionné : bordure `colors.border` 1px.
Icône radio : disque 20×20pt — sélectionné : fond `primary` + point blanc 8px ; non sélectionné : fond `colors.cardAlt` + bord `colors.border`.
Label : `FontSize.body` (15px), `FontWeight.semibold`, `colors.text`. Sous-label : `FontSize.label` (13px), `colors.textSub`.

#### Sous-section "Plafond quotidien par membre"

Label : "Plafond quotidien (sats)" — `FontSize.body`, `colors.text`.
Sous-label : "Par défaut 1000. Plage : 100–10 000." — `FontSize.label`, `colors.textSub`.

Input numérique :
- `TextInput`, `keyboardType="number-pad"`, `colors.inputBg`, `colors.inputBorder`, `Radius.md`
- Largeur 100pt (inline à droite du label), hauteur 40pt, centré
- `FontSize.body` (15px), `colors.text`, placeholder "1000"

#### Entrée "Pay-outs en attente (N)" — conditionnelle

Affiché uniquement si queue de validation non vide (N ≥ 1). Style : `SettingsRow` existant.

| Propriété | Valeur |
|-----------|--------|
| Icône | `Clock` 18px |
| Titre | "Pay-outs en attente" |
| Sous-titre | "N pay-out{N>1?'s':''} à valider · N×100 sats" |
| Action | Ouvre la modal "Pay-outs en attente" (Surface 4) |
| Accessibilité | `accessibilityLabel="Pay-outs en attente, N paiements à valider"` |

#### Nettoyage liens playgrounds

Supprimer les deux `TouchableOpacity` "Ouvrir l'écran de test" → `/lightning-spike` et → `/lightning-family-spike`. Aucune UI de remplacement.

---

## Animations — Contrat Reanimated 4

**Règle absolue :** `react-native-reanimated` uniquement. Pas de `Animated` de React Native core. Configs spring comme constantes module.

### Animation 1 — Pulse bouton HUD ⚡ (D-04)

```typescript
const LIGHTNING_PULSE_SPRING: WithSpringConfig = {
  damping: 10,
  stiffness: 180,
};

// Dans le composant HUD :
const pulseScale = useSharedValue(1);

// Déclencheur (appel depuis listener pay-out success) :
function triggerPulse() {
  pulseScale.value = withSpring(1.2, LIGHTNING_PULSE_SPRING, () => {
    pulseScale.value = withSpring(1.0, LIGHTNING_PULSE_SPRING);
  });
  runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
}

const pulseAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: pulseScale.value }],
}));
```

Durée totale estimée : ~600ms (montée ~250ms + descente ~350ms). Pas de glow permanent — effet scale pur. Pas de `perspective` dans transform (CLAUDE.md).

### Animation 2 — Toast "+100 sats ⚡"

Réutilise le système ToastContext existant (ToastSeal) sans modification. Pattern slide-in `translateY -120→0` + `scale 0.9→1.0`, `withTiming` 280ms `Easing.out(cubic)`. Aucune animation custom à implémenter.

### Animation 3 — Modals (encaissement, validation batch)

`Modal` natif RN avec `animationType="slide"` + `presentationStyle="pageSheet"`. Pas d'animation Reanimated custom sur les modals. Drag-to-dismiss natif iOS.

### Animation 4 — Balance refresh (post pay-out)

Pas d'animation de transition pour la mise à jour du chiffre balance. Le refresh est event-driven (D-05) et la valeur se met à jour directement via setState. Si un feedback visuel discret est souhaité : `withTiming` opacity 0.5→1.0 sur le Text balance, durée 300ms.

---

## Accessibility

| Surface | Exigence |
|---------|----------|
| Bouton HUD ⚡ | `accessibilityLabel="Portefeuille Lightning"`, `accessibilityRole="button"` |
| Items audit statut | `accessibilityLabel="[Titre tâche], [statut label], [sats] sats, [date]"` |
| Bouton batch | `accessibilityLabel="Valider N pay-outs, N×100 sats"`, `accessibilityRole="button"` |
| Bouton "Encaisser" (disabled) | `accessibilityHint="Admin key requise pour encaisser"` quand disabled |
| Input bolt11 | `accessibilityLabel="Invoice Lightning bolt11"` |
| Radio trigger mode | `accessibilityRole="radio"`, `accessibilityState={{ checked: triggerMode === option }}` |
| Input dailyCap | `accessibilityLabel="Plafond quotidien en sats"` |

Règle statuts : jamais de couleur seule pour transmettre l'information. Chaque statut utilise icône + label chip + couleur (triple signal).

Tap targets : minimum 44×44pt sur toutes les zones interactives. Le bouton HUD ⚡ hérite du `hitSlop` ou de la taille de `hudCodexButton` existant.

---

## Copywriting Contract

| Élément | Copie |
|---------|-------|
| CTA principal (wallet) | "Encaisser vers wallet externe" |
| CTA batch validation | "Valider {N} pay-out{N>1?'s':''} ({N×100} sats)" |
| CTA confirmation bolt11 | "Confirmer l'encaissement" |
| CTA coller presse-papiers | "Coller depuis le presse-papiers" |
| CTA scanner QR | "Scanner un QR code" |
| Toast pay-out reçu (message) | "+100 sats ⚡" |
| Toast pay-out reçu (subtitle) | "{nomProfil}" (ex : "Lucas") |
| Toast offline (network) | "En attente de réseau — pay-out mis en file" |
| Toast batch réussi total | "{N} pay-outs validés · {N×100} sats envoyés" |
| Toast batch partiel | "{X}/{Y} pay-outs réussis · {N} en attente de retry" |
| Toast batch échec total | "Aucun pay-out n'a abouti — tous en attente" |
| Empty state wallet (titre) | "Aucun paiement pour l'instant" |
| Empty state wallet (corps) | "Les pay-outs apparaîtront ici au fil des tâches." |
| Tooltip encaisser disabled | "Admin key requise pour encaisser" |
| Label balance loading | "—" (tiret cadratin, pas de spinner texte) |
| Balance error (`lightning.balance.error`) | "Solde indisponible — vérifiez votre connexion." |
| Disclaimer bolt11 | "La transaction Lightning est définitive. Vérifiez l'invoice avant de confirmer." |
| Effacer historique (bouton) | "Effacer l'historique" |
| Effacer historique (confirmation titre) | "Effacer l'historique ?" |
| Effacer historique (confirmation corps) | "Toutes les entrées seront supprimées définitivement." |
| Effacer historique (bouton destructif) | "Effacer" |
| Supprimer config (titre) | "Effacer la configuration ?" |
| Supprimer config (corps) | "Supprime l'URL, les clés et désactive Lightning." |
| Supprimer config (bouton destructif) | "Effacer" |
| FaceID reason (batch) | "Valider les pay-outs Lightning" |
| FaceID reason (encaissement) | "Confirmer l'encaissement Lightning" |
| Notif locale parent (template) | "Lumière Lightning · {N} pay-out{N>1?'s':''} validé{N>1?'s':''}{plafond?', plafond atteint pour {prenom}':''}{pending>0?', {pending} en attente':''}" |
| Notif locale (sous-titre) | Ex : "2 pay-outs validés, plafond atteint pour Lucas · 1 en attente" |
| SettingsRow label | "Pay-outs en attente" |
| SettingsRow sous-titre | "{N} pay-out{N>1?'s':''} à valider · {N×100} sats" |
| SectionHeader trigger | "Déclenchement des pay-outs" |
| Radio instant | "Instantané" / "Chaque tâche déclenche un pay-out immédiat" |
| Radio daily-review | "Validation parentale" / "Tu valides les pay-outs en batch une fois par jour" |
| Radio hybrid | "Hybride" / "Instantané jusqu'à 100 sats/jour, puis en attente" |
| Input dailyCap placeholder | "1000" |
| Input dailyCap label | "Plafond quotidien (sats)" |
| Input dailyCap sous-label | "Par défaut 1000. Plage : 100–10 000." |

**Tonalité :** factuel et chaleureux. Jamais "Bravo !", "Tu as gagné !", "Récompense !", "Félicitations !". Affichage en sats uniquement — pas de conversion fiat (SPEC Out of Scope).

---

## Notification locale parent (D-10)

| Propriété | Valeur |
|-----------|--------|
| Canal | `expo-notifications`, identique au canal tâches/RDV existant |
| Fréquence max | 1 notif/jour (timestamp dernière notif en SecureStore) |
| Silencieuse | 09h00–16h00 heure locale (heures école) |
| Titre | "Lumière Lightning" |
| Corps | Agrégation : "{N} pay-out{N>1?'s':''} validé{N>1?'s':''} · {éléments}..." |
| Exemple cible | "Lumière Lightning · 2 pay-outs validés, plafond atteint pour Lucas · 1 en attente" |
| Son | `false` (silencieuse par design — récap fin de journée, pas alerte) |
| Catégorie | Informatif — pas de bouton d'action dans la notif |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | non applicable (projet React Native) | not required |
| Third-party | aucun | not required |

Tous les composants utilisés sont des composants maison ou des libs déjà installées dans le projet (`expo-notifications`, `expo-camera`, `expo-clipboard`, `expo-haptics`, `lucide-react-native`).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approbation :** en attente — gsd-ui-checker
