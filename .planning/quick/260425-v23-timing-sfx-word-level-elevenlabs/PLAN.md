# V2.3 — Timing SFX au mot près via ElevenLabs `/with-timestamps`

## Goal
Aligner chaque SFX du Mode Spectacle au moment exact où le mot-déclencheur est prononcé dans l'audio TTS, plutôt qu'au prorata du nombre de caractères de narration cumulés (V2.2 actuel).

Résultat attendu : la porte qui grince exactement quand le héros pousse la porte (et plus 2s après).

## État actuel (V2.2)
- Le script JSON Claude produit une suite de `beats` : `narration | dialogue | sfx`.
- `lib/story-script.ts` calcule un ratio de déclenchement par SFX = `cumulChars / totalChars` (proportionnel au texte cumulé jusqu'au beat SFX).
- `StoryPlayer.onWaveformProgress` déclenche le SFX dès que `current/duration >= ratio`.
- Précision : ±2-4s sur une histoire de 90s (variations rythme voix, pauses, accentuation).

## Cible (V2.3)
- ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps` retourne `alignment.characters[]` + `alignment.character_start_times_seconds[]` + `alignment.character_end_times_seconds[]`.
- On dispose donc d'une cartographie caractère → timestamp absolu en secondes.
- Plan d'attaque : trouver le caractère du beat narration/dialogue qui PRÉCÈDE chaque SFX dans la concaténation finale, lire son timestamp de fin, planifier le SFX à `t + 0.05s`.

## Architecture proposée

### 1. lib/elevenlabs.ts
- Ajouter `generateSpeechWithTimestamps()` qui appelle `/with-timestamps` (au lieu de `/text-to-speech`).
- Retour : `{ audioUri, alignment: { chars: string[], starts: number[], ends: number[] } }`.
- Garder `generateSpeech()` legacy pour rétrocompat (mode non-spectacle).
- Persister l'alignment à côté du MP3 dans le vault : `<storyId>.alignment.json`.

### 2. lib/story-script.ts
- Nouvelle fn `computeSfxScheduleFromAlignment(script, alignment): { tag, atSec }[]`.
- Algorithme :
  1. Parcourir les beats dans l'ordre.
  2. Pour chaque beat narration/dialogue, accumuler son `text` dans une string `concatenated`.
  3. Pour chaque beat SFX, le déclencheur est la fin du beat narration/dialogue précédent → on connaît la longueur `concatenated.length` à ce moment → on lit `alignment.ends[concatenated.length - 1]` (avec offset si la voix prend une pause après ponctuation).
  4. Renvoyer une liste `{ tag, atSec }` triée par temps.
- Tolérance : si la concaténation des beats ne matche pas exactement le texte ElevenLabs (caractères normalisés, espaces), faire un alignement approximatif (Levenshtein local sur fenêtre glissante).

### 3. components/stories/StoryPlayer.tsx
- Si l'histoire a un `alignment.json` disponible → utiliser `computeSfxScheduleFromAlignment` au lieu du calcul ratio.
- Garder le fallback ratio pour les histoires V2.2 sans alignment.
- Le déclenchement passe d'un check ratio à un check `currentSec >= atSec`.
- Skip arrière (V2.2 quick win) reste compatible : on compare `atSec`.

### 4. lib/types.ts
- Ajouter `BedtimeStory.alignment?: { chars: string[]; starts: number[]; ends: number[] }` (chargé depuis sidecar comme `script`).
- Sidecar déjà géré par `useVaultStories` — étendre pour charger `<id>.alignment.json` aussi.

### 5. Migration
- Histoires existantes V2.2 : pas de regen forcée. Le player détecte l'absence d'alignment et reste en mode ratio.
- Nouvelles histoires en mode Spectacle V2.3 : générées avec `/with-timestamps` automatiquement.
- Coût ElevenLabs : `/with-timestamps` est facturé identique à `/text-to-speech` (vérifier doc — sinon basculer doux/spectacle pour ne pas régresser sur ambiance-only).

## Tâches

1. **Spike API ElevenLabs** : appel manuel `/with-timestamps` sur un texte court, vérifier format de retour, vérifier billing identique. (30min)
2. **lib/elevenlabs.ts** : implémenter `generateSpeechWithTimestamps`, persister alignment sidecar + cache local. (1h)
3. **lib/story-script.ts** : implémenter `computeSfxScheduleFromAlignment` avec test unitaire (alignement + SFX → planning). (1h30)
4. **hooks/useVaultStories.ts** : charger `<id>.alignment.json` si présent (try/catch silencieux comme pour script). (15min)
5. **lib/parser.ts** : pas de changement frontmatter — alignment vit dans son sidecar.
6. **components/stories/StoryPlayer.tsx** : router vers le nouveau planning si alignment présent, garder fallback. (45min)
7. **lib/types.ts** : ajouter champ optionnel + export du shape alignment. (10min)
8. **Test bout-en-bout** : générer une histoire spectacle V2.3, écouter, vérifier précision <0.3s. (30min)

**Estimation totale : 4h.**

## Risques

- **Mismatch caractères** : ElevenLabs renvoie un alignment basé sur le texte tel qu'envoyé à l'API, mais Claude produit des beats dont la concaténation peut différer (caractères de ponctuation finaux, espaces). Mitigation : alignement local (search forward de la sous-chaîne du beat narration dans `chars` à partir de la position courante, tolérance ±5 chars).
- **Billing** : si `/with-timestamps` est plus cher → mode dégradé pour les utilisateurs sans abonnement. Probablement OK (même endpoint historiquement).
- **Audio re-généré nécessaire** : on ne peut pas obtenir l'alignment sur un MP3 déjà généré sans timestamps. Premier run V2.3 sur une histoire = nouvelle génération ElevenLabs (un crédit). Acceptable.

## Hors scope V2.3 (V2.4+)
- Multi-voix (narrateur + personnages distincts) — nécessite split du texte par locuteur, plusieurs appels TTS, mixing côté app. Reporter.
- Slider volume in-player live — actuellement géré au niveau `voiceConfig` par histoire. Si demande utilisateur, ajouter mini contrôle dans le player après V2.3.
- Preview ambiance long-press dans sélecteur d'univers — UX feature séparée, peut shipper en parallèle.

## Quick wins V2.2.1 (livrés en amont, voir commit associé)
- 3 modes audio (Off / Doux / Spectacle) avec migration `voiceConfig.spectacle` → `audioMode`.
- Slider volume ambiance (chips +/− 10%) dans la config voiceConfig.
- Indicateur visuel SFX (halo qui pulse à chaque trigger).
- Re-déclenchement SFX si skip arrière > 5%.
- Overlay sombre progressif sur les 30 dernières secondes (endormissement).
- Yawn auto-injecté en avant-dernier beat dans le prompt Claude Spectacle.
