---
phase: quick-260411-wyx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/stories/VoiceRecorder.tsx
  - components/stories/StoryPlayer.tsx
  - hooks/useVaultProfiles.ts
  - hooks/useVault.ts
autonomous: true
requirements:
  - VOICE-01 — Composant VoiceRecorder expo-av avec upload ElevenLabs IVC
  - VOICE-02 — Sélecteur voix parent dans StoryPlayer (chips adultes + bouton enregistrement)
  - VOICE-03 — Étendre updateProfile pour persister voiceElevenLabsId / voiceSource / voicePersonalId

must_haves:
  truths:
    - "Un parent peut taper sur un chip adulte dans la config StoryPlayer pour choisir sa voix comme narrateur"
    - "Un parent sans voix clonée voit un bouton + à côté de son chip qui ouvre un modal VoiceRecorder"
    - "Après 1-2 min d'enregistrement, le parent voit 'Voix créée !' et le profil est persisté avec voiceElevenLabsId + voiceSource='elevenlabs-cloned'"
    - "Si un chip parent avec voiceElevenLabsId est sélectionné, la lecture utilise engine='elevenlabs' avec ce voice_id"
    - "Si aucun chip parent n'est sélectionné, le comportement voix global existant (voiceConfig de useStoryVoice) est inchangé"
    - "La génération/lecture/vitesse/waveform existants de StoryPlayer continuent de fonctionner sans régression"
  artifacts:
    - path: "components/stories/VoiceRecorder.tsx"
      provides: "Composant d'enregistrement vocal 2 min + upload ElevenLabs IVC"
      contains: "VoiceRecorderProps, états idle|recording|uploading|done, Audio.Recording, uploadVoiceClone"
    - path: "components/stories/StoryPlayer.tsx"
      provides: "Section 'Voix du narrateur' avec chips profils adultes + modal VoiceRecorder + override voiceConfig session"
      contains: "useVault().profiles filter role==='adulte', Modal pageSheet, selectedParentId state"
    - path: "hooks/useVaultProfiles.ts"
      provides: "updateProfile étendu avec champs voix"
      contains: "voiceElevenLabsId?, voicePersonalId?, voiceSource?"
    - path: "hooks/useVault.ts"
      provides: "Signature updateProfile propagée dans l'interface VaultState"
      contains: "voiceElevenLabsId?, voicePersonalId?, voiceSource?"
  key_links:
    - from: "components/stories/VoiceRecorder.tsx"
      to: "lib/voice-clone.ts uploadVoiceClone"
      via: "import + appel au stop de l'enregistrement"
      pattern: "uploadVoiceClone\\("
    - from: "components/stories/StoryPlayer.tsx"
      to: "hooks/useVault updateProfile"
      via: "useVault().updateProfile(profileId, { voiceElevenLabsId, voiceSource })"
      pattern: "updateProfile\\(.*voiceElevenLabsId"
    - from: "components/stories/StoryPlayer.tsx"
      to: "lib/elevenlabs generateSpeech (existant)"
      via: "override voiceConfig local session quand chip parent sélectionné"
      pattern: "engine:\\s*'elevenlabs'"
---

<objective>
Ajouter un composant `VoiceRecorder` réutilisable (enregistrement 2 min + upload ElevenLabs IVC) et intégrer un sélecteur de voix parent dans `StoryPlayer` (chips profils adultes + modal d'enregistrement pour les parents sans voix clonée).

Purpose: Permettre aux parents de raconter les histoires du soir avec leur propre voix clonée via IVC ElevenLabs, sans casser le pipeline existant de génération / lecture / contrôle vitesse.

Output: Nouveau composant `VoiceRecorder.tsx`, modification de `StoryPlayer.tsx`, extension de la signature `updateProfile` pour persister les champs voix dans `famille.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/types.ts
@lib/voice-clone.ts
@lib/personal-voice.ts
@contexts/StoryVoiceContext.tsx
@components/stories/StoryPlayer.tsx
@hooks/useVaultProfiles.ts
@hooks/useVault.ts
@constants/spacing.ts

<interfaces>
<!-- Contrats clés extraits du codebase — l'exécuteur n'a PAS besoin d'explorer davantage. -->

From lib/voice-clone.ts:
```typescript
export async function uploadVoiceClone(
  audioUri: string,
  profileName: string,
  apiKey: string,
): Promise<string>; // retourne voice_id ElevenLabs
// Throws Error FR si fichier introuvable / upload échoue / voice_id manquant
```

From lib/types.ts (Profile — champs voix déjà présents):
```typescript
voiceElevenLabsId?: string;
voicePersonalId?: string;
voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'expo-speech';
```

From lib/types.ts (StoryVoiceConfig — déjà utilisé par StoryPlayer):
```typescript
export interface StoryVoiceConfig {
  engine: 'expo-speech' | 'elevenlabs';
  language: 'fr' | 'en';
  elevenLabsVoiceId?: string;
}
```

From hooks/useVaultProfiles.ts (signature ACTUELLE à étendre) :
```typescript
updateProfile: (profileId: string, updates: {
  name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender
}) => Promise<void>;
```
⚠️ L'implémentation `updateProfile` (lignes 301-412) boucle sur `Object.entries(updates)` et écrit chaque paire `key: value` dans la section `### {profileId}` de `famille.md`. **Ajouter des champs à la signature TypeScript suffit** — la boucle les traite automatiquement. Le parser `parseFamille` (lib/parser.ts ligne 733-736) relit déjà `voiceElevenLabsId`, `voicePersonalId`, `voiceSource` et `serializeFamille` (ligne 799-801) les sérialise.

From hooks/useVault.ts ligne 158 (signature propagée dans l'interface VaultState à étendre en miroir) :
```typescript
updateProfile: (profileId: string, updates: { name?: string; avatar?: string; birthdate?: string; propre?: boolean; gender?: Gender }) => Promise<void>;
```

From components/stories/StoryPlayer.tsx (Props actuels à préserver) :
```typescript
interface Props {
  histoire: BedtimeStory;
  voiceConfig: StoryVoiceConfig;
  elevenLabsKey: string;
  onFinish: () => void;
}
```
⚠️ `voiceConfig` est actuellement passé depuis le parent (stories.tsx via useStoryVoice). Pour l'override session : introduire un state local `effectiveVoiceConfig` qui démarre à `voiceConfig` et est remplacé quand un parent est sélectionné. **Ne PAS persister** l'override — c'est session-only.
</interfaces>

<notes>
- expo-av et expo-haptics sont déjà utilisés dans StoryPlayer.tsx → aucun ajout de dépendance.
- `Audio.RecordingOptionsPresets.HIGH_QUALITY` : preset standard expo-av (pas besoin de custom config).
- Permission micro : `Audio.requestPermissionsAsync()` avant `Audio.Recording.createAsync()`.
- `useVault()` retourne `profiles: Profile[]` — filtrer avec `p.role === 'adulte'` (NOT statut).
- `elevenLabsKey` est passé en prop à StoryPlayer (depuis `useStoryVoice()` du parent) → réutiliser cette valeur pour `VoiceRecorder`, ne PAS re-lire SecureStore.
- Conventions : `useThemeColors()` inline pour dynamique, `Spacing.*` tokens, textes FR, `Alert.alert` FR, `console.warn` sous `if (__DEV__)`, constantes spring en module-level, `React.memo` sur le composant final.
- Modal drag-to-dismiss : `<Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={...}>` (pattern existant dans l'app).
- **NE PAS** toucher à la logique existante de lecture `startPlayback` / `stopPlayback` / `changeSpeed` / waveform WaveBar — seulement ajouter une section de config AVANT le bloc actuel + override de `voiceConfig` via state local.
</notes>
</context>

<tasks>

<task type="auto">
  <name>Task 1 : Étendre la signature updateProfile pour les champs voix</name>
  <files>hooks/useVaultProfiles.ts, hooks/useVault.ts</files>
  <action>
Étendre le type du paramètre `updates` de `updateProfile` dans **deux endroits** pour inclure les 3 champs voix :

1. `hooks/useVaultProfiles.ts` ligne 58 (interface) ET ligne 301 (implémentation `useCallback`) :
```typescript
updateProfile: (profileId: string, updates: {
  name?: string;
  avatar?: string;
  birthdate?: string;
  propre?: boolean;
  gender?: Gender;
  voiceElevenLabsId?: string;
  voicePersonalId?: string;
  voiceSource?: 'ios-personal' | 'elevenlabs-cloned' | 'elevenlabs-preset' | 'expo-speech';
}) => Promise<void>;
```

2. `hooks/useVault.ts` ligne 158 (interface VaultState) — mirror exact de la signature ci-dessus.

**Aucune modification de l'implémentation** : la boucle `Object.entries(updates)` (lignes 322-342) traite déjà tous les champs génériquement, et `parser.ts` sérialise/parse déjà `voiceElevenLabsId`/`voicePersonalId`/`voiceSource` (vérifié lignes 733-736 et 799-801 de lib/parser.ts — Phase 260411-wq8).

Ne toucher à rien d'autre dans ces deux fichiers.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "useVault(Profiles)?\.ts" || echo "OK: useVault signatures typent les nouveaux champs voix"</automated>
  </verify>
  <done>
    - Les deux signatures `updateProfile` (hooks/useVault.ts et hooks/useVaultProfiles.ts) acceptent `voiceElevenLabsId?`, `voicePersonalId?`, `voiceSource?`.
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans ces deux fichiers (les erreurs pré-existantes dans useVault.ts sont ignorées — cf. CLAUDE.md § Testing).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2 : Créer components/stories/VoiceRecorder.tsx</name>
  <files>components/stories/VoiceRecorder.tsx</files>
  <action>
Créer un nouveau composant fonctionnel `VoiceRecorder` exportant par défaut `React.memo(VoiceRecorder)`.

**Props** :
```typescript
interface VoiceRecorderProps {
  profileId: string;    // non utilisé pour l'upload, conservé pour cohérence signature
  profileName: string;  // utilisé comme label ElevenLabs
  onVoiceReady: (voiceId: string, source: 'elevenlabs-cloned') => void;
  apiKey: string;
}
```

**État local** :
```typescript
const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
const [elapsed, setElapsed] = useState(0); // secondes 0→120
const recordingRef = useRef<Audio.Recording | null>(null);
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Comportement** :
1. Au montage : AUCUN side-effect audio (permission demandée seulement au start).
2. Au démontage : cleanup — arrêter recording/timer/autoStop si actifs, `recordingRef.current?.stopAndUnloadAsync().catch(()=>{})`.
3. `startRecording()` :
   - `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
   - `const perm = await Audio.requestPermissionsAsync()` — si `!perm.granted` → `Alert.alert('Permission refusée', 'Autorisez l\\'accès au micro dans Réglages.')` et return.
   - `await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })`
   - `const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)`
   - `recordingRef.current = recording`; `setStatus('recording')`; `setElapsed(0)`
   - `timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)`
   - `autoStopRef.current = setTimeout(() => stopRecording(), 120_000)`
   - Erreur : `Alert.alert('Erreur micro', String(e))` et `setStatus('idle')`.
4. `stopRecording()` :
   - `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
   - Clear timer + autoStop.
   - `await recordingRef.current?.stopAndUnloadAsync()`
   - `const uri = recordingRef.current?.getURI()` — si null/undefined → `Alert.alert('Erreur', 'Enregistrement introuvable')` et return.
   - `await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })` (restaurer mode lecture).
   - `setStatus('uploading')`
   - Try : `const voiceId = await uploadVoiceClone(uri, profileName, apiKey)` ; `setStatus('done')` ; `onVoiceReady(voiceId, 'elevenlabs-cloned')`.
   - Catch : `Alert.alert('Erreur upload', err.message || 'Impossible de créer la voix')` ; `setStatus('idle')`.
5. Bouton principal (`Pressable`) :
   - `onPress` : si `status === 'idle'` → startRecording() ; si `status === 'recording'` → stopRecording() ; sinon disabled.
   - Label : `'🎤 Commencer'` / `'⏹ Arrêter'` / (spinner) / `'✓ Voix créée !'`.

**Waveform Reanimated** (5 barres pulsantes) :
- Constante module-level : `const SPRING_WAVE = { damping: 8, stiffness: 200 }` et `const BAR_COLORS_FALLBACK = { min: 6, max: 28 }`.
- Sous-composant `RecordBar({ isActive, delay, color })` : `useSharedValue(6)`, `useEffect` — si `isActive` → `withRepeat(withSequence(withTiming(28,{duration:400+delay}), withTiming(6,{duration:400+delay})), -1, false)` ; sinon `cancelAnimation` + `withSpring(6, SPRING_WAVE)`.
- Rendre 5 barres avec `delay = i * 60`.
- Couleur : `colors.primary` quand recording, `colors.border` sinon.

**UI (JSX)** :
- Container : `{ padding: Spacing['4xl'], alignItems: 'center', gap: Spacing['2xl'] }`.
- Texte instruction (toujours visible) : `"Lisez à voix haute pendant 1 à 2 minutes pour créer votre voix personnalisée."` — `color: colors.textMuted`, `textAlign: 'center'`.
- Waveform row : 5 `RecordBar` animées.
- Timer format `m:ss` (ex `0:42`) — masqué en `idle`/`done`.
- Selon status :
  - `idle` : bouton 🎤 Commencer (bg `colors.primary`).
  - `recording` : timer + waveform actif + bouton ⏹ Arrêter (bg `colors.error` ou `primary`).
  - `uploading` : `<ActivityIndicator color={primary} />` + texte `"Création de votre voix…"`.
  - `done` : icône ✓ + texte `"Voix créée !"` (color `colors.primary`).

**Imports requis** :
```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withSpring, cancelAnimation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Audio } from 'expo-av';
import { uploadVoiceClone } from '../../lib/voice-clone';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
```

**Conventions** :
- Toutes couleurs via `useThemeColors()` inline — zéro hardcoded (#...).
- Toutes valeurs numériques via `Spacing.*` / `Radius.*` / `FontSize.*` / `FontWeight.*`.
- `console.warn` uniquement sous `if (__DEV__)`.
- Textes 100 % français.
- `StyleSheet.create({})` en bas pour les styles statiques ; inline avec `colors` pour le dynamique.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "VoiceRecorder\.tsx" || echo "OK: VoiceRecorder.tsx compile proprement"</automated>
  </verify>
  <done>
    - Le fichier `components/stories/VoiceRecorder.tsx` existe.
    - `npx tsc --noEmit` ne produit AUCUNE erreur dans ce fichier.
    - Le composant expose bien la signature `VoiceRecorderProps` définie ci-dessus.
    - Aucun hardcoded color, aucune valeur numérique littérale hors tokens.
    - Le bouton principal gère les 4 états (idle → recording → uploading → done) avec timer 0→120 et auto-stop 120s.
  </done>
</task>

<task type="auto">
  <name>Task 3 : Intégrer sélecteur voix parent + modal VoiceRecorder dans StoryPlayer</name>
  <files>components/stories/StoryPlayer.tsx</files>
  <action>
Modifier `components/stories/StoryPlayer.tsx` pour ajouter une section "Voix du narrateur" AVANT le bloc waveform/play/speed, sans casser la logique existante.

**1. Imports additionnels** (après les imports existants) :
```typescript
import { Modal } from 'react-native';
import { useVault } from '../../hooks/useVault';
import VoiceRecorder from './VoiceRecorder';
```

**2. Nouveaux états dans `StoryPlayer`** (après `const soundRef = useRef<any>(null);`) :
```typescript
const { profiles, updateProfile } = useVault();
const adultProfiles = React.useMemo(
  () => profiles.filter(p => p.role === 'adulte'),
  [profiles],
);
const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
const [recorderProfileId, setRecorderProfileId] = useState<string | null>(null);
```

**3. Dériver `effectiveVoiceConfig`** (juste après les states ci-dessus) :
```typescript
const effectiveVoiceConfig = React.useMemo<StoryVoiceConfig>(() => {
  if (!selectedParentId) return voiceConfig;
  const parent = adultProfiles.find(p => p.id === selectedParentId);
  if (!parent) return voiceConfig;
  if (parent.voiceElevenLabsId) {
    return { engine: 'elevenlabs', language: 'fr', elevenLabsVoiceId: parent.voiceElevenLabsId };
  }
  if (parent.voiceSource === 'ios-personal' && parent.voicePersonalId) {
    // expo-speech utilisera l'identifier iOS Personal Voice via le `voice` param dans Speech.speak
    // StoryPlayer n'a qu'un champ `language` dans StoryVoiceConfig → on reste sur expo-speech et
    // on laisse l'implémentation existante choisir. Le support iOS Personal Voice via identifier
    // explicite sera finalisé ultérieurement (hors scope quick task).
    return { engine: 'expo-speech', language: 'fr' };
  }
  return voiceConfig;
}, [selectedParentId, adultProfiles, voiceConfig]);
```

**4. Remplacer TOUTES les occurrences de `voiceConfig.engine` / `voiceConfig.language` / `voiceConfig.elevenLabsVoiceId` dans `startPlayback` et `stopPlayback` par `effectiveVoiceConfig.*`**. Même chose pour les dépendances de `useCallback` (`[effectiveVoiceConfig, histoire.texte, speed, elevenLabsKey]` au lieu de `[voiceConfig, ...]`).

**5. Ajouter JSX de la section "Voix du narrateur" JUSTE APRÈS `<Text style={[styles.title, ...]}>{histoire.titre}</Text>` et AVANT `<View style={styles.waveform}>`** :

```tsx
{adultProfiles.length > 0 && (
  <View style={styles.parentVoiceSection}>
    <Text style={[styles.parentVoiceLabel, { color: colors.textMuted }]}>
      Voix du narrateur
    </Text>
    <View style={styles.parentChipsRow}>
      {adultProfiles.map(p => {
        const isSelected = selectedParentId === p.id;
        const hasClone = !!p.voiceElevenLabsId;
        return (
          <View key={p.id} style={styles.parentChipWrap}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedParentId(isSelected ? null : p.id);
              }}
              style={[
                styles.parentChip,
                {
                  backgroundColor: isSelected ? primary : colors.card,
                  borderColor: isSelected ? primary : colors.border,
                },
              ]}
            >
              <Text style={[
                styles.parentChipText,
                { color: isSelected ? '#fff' : colors.text },
              ]}>
                Voix de {p.name}
              </Text>
            </Pressable>
            {!hasClone && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(ImpactFeedbackStyle.Light);
                  setRecorderProfileId(p.id);
                }}
                style={[styles.parentAddBtn, { borderColor: colors.border }]}
                accessibilityLabel={`Enregistrer la voix de ${p.name}`}
              >
                <Text style={[styles.parentAddBtnText, { color: primary }]}>+</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  </View>
)}

<Modal
  visible={recorderProfileId !== null}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setRecorderProfileId(null)}
>
  <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={styles.modalHeader}>
      <Text style={[styles.modalTitle, { color: colors.text }]}>
        Enregistrer votre voix
      </Text>
      <Pressable onPress={() => setRecorderProfileId(null)}>
        <Text style={[styles.modalClose, { color: primary }]}>Fermer</Text>
      </Pressable>
    </View>
    {recorderProfileId && (() => {
      const target = adultProfiles.find(p => p.id === recorderProfileId);
      if (!target) return null;
      return (
        <VoiceRecorder
          profileId={target.id}
          profileName={target.name}
          apiKey={elevenLabsKey}
          onVoiceReady={async (voiceId, source) => {
            try {
              await updateProfile(target.id, {
                voiceElevenLabsId: voiceId,
                voiceSource: source,
              });
              setSelectedParentId(target.id);
              setRecorderProfileId(null);
            } catch (e) {
              if (__DEV__) console.warn('updateProfile voice failed:', e);
              Alert.alert('Erreur', 'Impossible d\\'enregistrer la voix sur le profil.');
            }
          }}
        />
      );
    })()}
  </View>
</Modal>
```

**6. Ajouter les styles statiques dans `StyleSheet.create`** (fusion avec l'objet existant en bas de fichier) :
```typescript
parentVoiceSection: { width: '100%', paddingHorizontal: Spacing['4xl'], marginBottom: Spacing['3xl'], alignItems: 'center' },
parentVoiceLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.md },
parentChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
parentChipWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
parentChip: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, borderRadius: Radius.full, borderWidth: 1 },
parentChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
parentAddBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
parentAddBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing['4xl'], borderBottomWidth: 1, borderBottomColor: 'transparent' },
modalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
modalClose: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
```

**Contraintes critiques — NE PAS TOUCHER** :
- La logique `primeAudioSession`, `WaveBar`, `PEAKS`, les effets `useEffect` de montage/démontage.
- La signature `Props` de StoryPlayer (rester rétrocompatible — le parent continue à passer `voiceConfig`).
- Les contrôles vitesse (SPEEDS / changeSpeed) et le bouton "Terminer l'histoire".
- `generateSpeech` et `Audio.Sound.createAsync` doivent continuer à recevoir `effectiveVoiceConfig.elevenLabsVoiceId` (pas `voiceConfig.elevenLabsVoiceId` direct).

**Vérification de cohérence** : rechercher dans le fichier final qu'il ne reste PLUS de `voiceConfig.engine`, `voiceConfig.language` ou `voiceConfig.elevenLabsVoiceId` dans le corps du composant (seul `effectiveVoiceConfig.*` est utilisé côté logique de lecture). La prop `voiceConfig` reste utilisée UNIQUEMENT comme base initiale dans le `useMemo` de `effectiveVoiceConfig`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "StoryPlayer\.tsx|VoiceRecorder\.tsx" || echo "OK: StoryPlayer.tsx compile avec l'intégration VoiceRecorder"</automated>
  </verify>
  <done>
    - `StoryPlayer.tsx` importe `useVault`, `VoiceRecorder`, `Modal`.
    - Section "Voix du narrateur" rendue uniquement si `adultProfiles.length > 0`.
    - Chaque chip adulte est sélectionnable (toggle) et highlight en `primary` quand sélectionné.
    - Chaque adulte sans `voiceElevenLabsId` affiche un bouton `+` qui ouvre le Modal pageSheet `VoiceRecorder`.
    - Au callback `onVoiceReady`, le profil est mis à jour via `updateProfile(id, { voiceElevenLabsId, voiceSource: 'elevenlabs-cloned' })`, le modal se ferme, et le chip du parent est auto-sélectionné.
    - `effectiveVoiceConfig` override `voiceConfig` quand un parent est sélectionné ; `startPlayback`/`stopPlayback` utilisent `effectiveVoiceConfig.engine/language/elevenLabsVoiceId` (zéro référence résiduelle à `voiceConfig.engine` dans le corps logique).
    - `npx tsc --noEmit` ne produit AUCUNE nouvelle erreur dans `StoryPlayer.tsx`.
    - Les fonctionnalités existantes (waveform lecture, speed control, bouton Play/Pause, Terminer, primeAudioSession) sont strictement inchangées.
  </done>
</task>

</tasks>

<verification>
### Vérification automatisée
```bash
npx tsc --noEmit 2>&1 | grep -E "VoiceRecorder\.tsx|StoryPlayer\.tsx|useVault(Profiles)?\.ts" || echo "OK: aucune nouvelle erreur TS"
```
(Ignorer les erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — cf. CLAUDE.md § Testing.)

### Vérification manuelle (device)
1. Ouvrir l'écran Histoires → générer une histoire → entrer dans le player.
2. Vérifier la section "Voix du narrateur" avec chip(s) des adultes.
3. Taper `+` sur un adulte sans voix → modal s'ouvre, parler 1-2 min, taper Arrêter → "Voix créée !" → modal se ferme → chip auto-sélectionné.
4. Taper Play → vérifier que la lecture ElevenLabs utilise bien la voix clonée.
5. Désélectionner le chip → Play → vérifier retour au comportement global `voiceConfig` d'origine.
6. Vérifier que les contrôles vitesse et le bouton Terminer fonctionnent sans régression.
</verification>

<success_criteria>
- `npx tsc --noEmit` : aucune nouvelle erreur dans les 4 fichiers modifiés.
- `components/stories/VoiceRecorder.tsx` créé avec les 4 états (idle/recording/uploading/done), timer 0→120s, auto-stop 2min, waveform 5 barres Reanimated.
- `components/stories/StoryPlayer.tsx` affiche la section "Voix du narrateur" avec chips adultes + bouton `+` vers VoiceRecorder en modal pageSheet.
- Persistance : après enregistrement réussi, `updateProfile` écrit `voiceElevenLabsId` et `voiceSource` dans `famille.md` (vérifiable via `parseFamille` au reload).
- Override session-only : `selectedParentId` n'est JAMAIS persisté ; sa sélection n'affecte que la session de lecture courante.
- Aucune régression : lecture, vitesse, waveform, Terminer fonctionnent comme avant quand aucun parent n'est sélectionné.
- Zéro nouvelle dépendance npm (expo-av, expo-haptics, reanimated déjà présents).
</success_criteria>

<output>
After completion, create `.planning/quick/260411-wyx-voicerecorder-composant-s-lecteur-voix-p/260411-wyx-SUMMARY.md`
</output>
