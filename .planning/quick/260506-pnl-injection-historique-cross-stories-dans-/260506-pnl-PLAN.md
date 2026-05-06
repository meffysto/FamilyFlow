---
phase: 260506-pnl-injection-historique
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/ai-service.ts
  - app/(tabs)/stories.tsx
autonomous: true
requirements:
  - P3-saturation-memory
  - P5-titres-dupliques
  - P7-quasi-clones
must_haves:
  truths:
    - "Le system prompt de generateBedtimeStory contient un bloc HISTOIRES RÉCENTES quand recentHistory est fourni avec au moins 1 titre"
    - "Le call site stories.tsx passe les 5 dernières histoires de l'enfant (titres + incipits anonymisés) et un memoryReuseCount calculé"
    - "Si stories est vide ou si l'enfant n'a aucune histoire passée, recentHistory est omis et le prompt reste inchangé (pas de bloc parasite)"
    - "Quand memoryReuseCount >= 3, le prompt instruit explicitement de NE PAS rejouer le memory courant comme pivot"
    - "npx tsc --noEmit passe sans nouvelle erreur"
  artifacts:
    - path: lib/ai-service.ts
      provides: "Champ recentHistory dans StoryGenerationConfig + recentHistorySection injectée dans systemPrompt"
      contains: "recentHistory"
    - path: app/(tabs)/stories.tsx
      provides: "Calcul childRecentStories + recentHistory anonymisé passé à generateBedtimeStory"
      contains: "recentHistory"
  key_links:
    - from: app/(tabs)/stories.tsx
      to: lib/ai-service.ts
      via: "config.recentHistory passé à generateBedtimeStory"
      pattern: "recentHistory:"
    - from: lib/ai-service.ts
      to: systemPrompt
      via: "interpolation ${recentHistorySection} après ${antiRedundancyRules}"
      pattern: "recentHistorySection"
---

<objective>
Injecter dans le system prompt de génération d'histoires du soir un bloc avec les 5 dernières histoires de l'enfant (titres + incipits anonymisés) et un compteur de réutilisation du memory courant. Cible 3 patterns de l'audit golden set 20 histoires :
- P3 saturation memory (15+ stories consécutives qui rejouent "premières-fois marche seul")
- P5 titres dupliqués ("Le premier pas dans la forêt" en 5 variantes)
- P7 quasi-clones (paragraphes 70% identiques entre stories du même jour)

Purpose: Donner à Claude la mémoire courte qu'il n'a pas naturellement, pour qu'il diversifie titres/incipits et alterne le pivot narratif.
Output: Type étendu côté ai-service.ts + populate côté stories.tsx, ~250 tokens additionnels par génération.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/quick/260506-stories-eval-baseline/ANALYSIS.md

<interfaces>
<!-- Extraits de lib/ai-service.ts (lignes 958-990) — StoryGenerationConfig actuel -->

```typescript
export interface StoryGenerationConfig {
  enfantAnon: string;
  enfantAge: string;
  universId: string;
  universTitre: string;
  detail?: string;
  language: 'fr' | 'en';
  length?: import('./types').StoryLength;
  context: StoryPersonalizationContext;
  spectacle?: boolean;
  availableSfxTags?: string[];
  multiVoice?: boolean;
  elevenLabsModel?: import('./types').ElevenLabsModel;
  trancheAge?: '3-5' | '6-8' | '9+';
  // ← AJOUTER recentHistory ICI (avant book)
  book?: { ... };
}
```

<!-- Point d'injection dans systemPrompt (lib/ai-service.ts ligne 1277) -->
<!-- Actuel : ${antiRedundancyRules}${performanceTagsRules}... -->
<!-- Cible :  ${antiRedundancyRules}${recentHistorySection}${performanceTagsRules}... -->

<!-- Call site stories.tsx (lignes 1809-1837) — anonMap déjà disponible ligne 1809 -->
<!-- BedtimeStory type (lib/types.ts) expose : id, enfantId, titre, texte, date, universId, ... -->
<!-- `stories` est dans le scope du composant (depuis useVault) ; vérifier le nom exact dans stories.tsx -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Étendre StoryGenerationConfig + injecter recentHistorySection dans le system prompt (lib/ai-service.ts)</name>
  <files>lib/ai-service.ts</files>
  <action>
1. Dans `StoryGenerationConfig` (ligne ~958), ajouter APRÈS `trancheAge` et AVANT `book` un champ optionnel :
```typescript
  /** Mémoire courte cross-stories — 5 dernières histoires du même enfant (titres + incipits anonymisés) pour anti-doublons */
  recentHistory?: {
    titles: string[];           // titres anonymisés, ordre récent → ancien
    incipits: string[];         // ~80 premiers chars du texte de chaque histoire, anonymisés (même ordre)
    memoryReuseCount: number;   // sur les 5 dernières, combien réutilisent le memory courant comme pivot
  };
```

2. Juste APRÈS le bloc `antiRedundancyRules` (autour ligne 1120, avant `spectacleEnabled`), ajouter la construction de `recentHistorySection` :
```typescript
  // ─── Mémoire courte cross-stories (anti-doublons titres / incipits / memory) ───
  // Cible P3 saturation memory, P5 titres dupliqués, P7 quasi-clones (audit 260506).
  let recentHistorySection = '';
  if (story.recentHistory && story.recentHistory.titles.length > 0) {
    const rh = story.recentHistory;
    const lines = rh.titles.map((t, i) => {
      const incipit = rh.incipits[i] ?? '';
      return `  ${i + 1}. "${t}"${incipit ? ` — incipit : « ${incipit}${incipit.length >= 80 ? '…' : ''} »` : ''}`;
    }).join('\n');
    const memoryWarning = rh.memoryReuseCount >= 3
      ? `\n⚠️ ATTENTION : le souvenir-pivot fourni dans "Souvenirs récents" a DÉJÀ été utilisé comme moment-clé dans ${rh.memoryReuseCount} des 5 dernières histoires. Il est ÉPUISÉ — ne le rejoue PAS comme pivot émotionnel central. Évoque-le au plus en arrière-plan (1 ligne max) ou ignore-le complètement et invente un autre moment-clé.`
      : '';
    recentHistorySection = `

HISTOIRES RÉCENTES de cet enfant (de la plus récente à la plus ancienne) — RÈGLE ANTI-DOUBLON :
${lines}

CONTRAINTES STRICTES :
- Le titre que tu produis DOIT être substantiellement différent de chacun des titres ci-dessus (pas juste une variante de casse, de ponctuation ou un synonyme proche). Change le sujet, le lieu, l'objet ou l'angle narratif.
- Le PREMIER paragraphe de ton histoire DOIT ouvrir sur un cadre/lieu/personnage clairement différent des incipits ci-dessus. Évite de réutiliser le même décor d'ouverture (ex : si 3 incipits commencent dans une forêt, change de biome).
- Si une scène d'ouverture évidente revient (parents qui appellent, enfant qui sort de la maison, animal qui apparaît), choisis une AUTRE accroche.${memoryWarning}
`;
  }
```

3. Dans la template literal `systemPrompt` (ligne ~1277), insérer `${recentHistorySection}` immédiatement après `${antiRedundancyRules}` :

AVANT : `...${antiRedundancyRules}${performanceTagsRules}${charactersRules}...`
APRÈS : `...${antiRedundancyRules}${recentHistorySection}${performanceTagsRules}${charactersRules}...`

4. Si présent, étendre le `console.log('[ai-service] multi-voix:'...)` ou ajouter un nouveau log `__DEV__` pour tracer `recentHistory: { titlesCount, memoryReuseCount }` — utile pour debugger en dev.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "(ai-service|recentHistory)" | head -20</automated>
  </verify>
  <done>
- `recentHistory?` présent dans `StoryGenerationConfig` au bon emplacement (après trancheAge, avant book)
- `recentHistorySection` construite conditionnellement (vide si recentHistory absent ou titles.length === 0)
- `${recentHistorySection}` interpolée dans systemPrompt entre antiRedundancyRules et performanceTagsRules
- Avertissement memoryReuseCount >= 3 actif
- `npx tsc --noEmit` ne remonte aucune nouvelle erreur sur lib/ai-service.ts
  </done>
</task>

<task type="auto">
  <name>Task 2: Populate recentHistory au call site stories.tsx (5 dernières histoires de l'enfant, anonymisées)</name>
  <files>app/(tabs)/stories.tsx</files>
  <action>
Dans `app/(tabs)/stories.tsx`, dans le callback `generate` (ligne ~1780), juste APRÈS la construction de `anonMap` (ligne 1809) et AVANT l'appel à `generateBedtimeStory` (ligne 1811) :

1. Vérifier que `stories` est bien accessible dans le scope (c'est l'array global des BedtimeStory venant de useVault — si le nom local diffère, l'utiliser ; sinon le récupérer via le hook approprié au début du composant). Si `stories` n'est pas déjà dans le scope du composant, l'ajouter à la déstructuration `useVault()` ou équivalent.

2. Ajouter ce bloc :
```typescript
      // Mémoire courte cross-stories (anti-doublons titres/incipits/memory) — cf P3/P5/P7 audit 260506
      const childRecentStories = stories
        .filter(s => s.enfantId === enfantId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);

      const stripMarkdownHeading = (txt: string): string => {
        // Retire un éventuel heading "# Titre\n\n" en tête, garde le corps
        return txt.replace(/^#+\s+.*\n+/, '').trim();
      };

      const currentMemoryTitle = childMemories[0]?.title?.trim() ?? '';
      const memoryReuseCount = currentMemoryTitle && childRecentStories.length > 0
        ? childRecentStories.filter(s =>
            s.texte && s.texte.toLowerCase().includes(currentMemoryTitle.toLowerCase())
          ).length
        : 0;

      const recentHistory = childRecentStories.length > 0 ? {
        titles: childRecentStories.map(s => anonymize(s.titre ?? '', anonMap)),
        incipits: childRecentStories.map(s => {
          const body = stripMarkdownHeading(s.texte ?? '');
          return anonymize(body.slice(0, 80), anonMap);
        }),
        memoryReuseCount,
      } : undefined;
```

3. Passer `recentHistory` au config de `generateBedtimeStory`. Insérer la ligne `recentHistory,` dans l'objet config — par exemple juste après `trancheAge,` (ligne ~1829) et avant `context: {`.

4. Vérifier les noms de champs réels du type `BedtimeStory` dans `lib/types.ts` (notamment `enfantId`, `titre`, `texte`, `date`) — adapter si différents (par ex `title`/`text`/`profileId`). Si le champ enfant utilise `enfant` (nom) plutôt que `enfantId`, filtrer sur `s.enfant === enfantName`.

Note FR conventions : commentaires FR, pas de hardcoded colors (n/a ici), pas de noms réels (utiliser `enfantName` qui transite déjà par anonMap).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "stories\.tsx" | head -20</automated>
  </verify>
  <done>
- `childRecentStories` calculé en filtrant + triant + slice(0, 5)
- `recentHistory` construit avec titres/incipits anonymisés via `anonymize(..., anonMap)`
- `memoryReuseCount` = nombre des 5 dernières contenant le titre du memory courant (case-insensitive)
- `recentHistory` passé à `generateBedtimeStory` (undefined si pas d'histoire passée)
- `npx tsc --noEmit` clean sur stories.tsx (modulo erreurs pré-existantes)
- Pas de régression : un enfant sans historique passe `recentHistory: undefined` et le prompt reste inchangé
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne remonte aucune NOUVELLE erreur (les erreurs préexistantes MemoryEditor/cooklang/useVault sont à ignorer)
- Lecture manuelle du systemPrompt assemblé en dev : quand `stories` non vide pour l'enfant courant, le bloc HISTOIRES RÉCENTES apparaît avec titres + incipits anonymisés
- Quand `stories` vide pour cet enfant : aucun bloc parasite, prompt identique à l'avant
- Quand memoryReuseCount >= 3 : avertissement explicite présent dans le bloc
</verification>

<success_criteria>
- Type `StoryGenerationConfig.recentHistory` exporté et utilisable depuis le call site
- systemPrompt enrichi conditionnellement (zéro impact quand `recentHistory` absent)
- Anonymisation cohérente : tous titres + incipits passent par `anonymize(..., anonMap)`
- Coût additionnel borné : 5 titres × ~10 tokens + 5 incipits × ~30 tokens + ~80 tokens de règles ≈ 250 tokens
- TypeScript clean
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260506-pnl-injection-historique-cross-stories-dans-/260506-pnl-SUMMARY.md` avec : fichiers modifiés, exemples de bloc HISTOIRES RÉCENTES généré (avant/après diff prompt), coût tokens mesuré si possible, todo de suivi (relancer un golden set 20 histoires pour confirmer baisse de P3/P5/P7).
</output>
