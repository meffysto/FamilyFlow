---
phase: 15-pr-f-rences-alimentaires
plan: 07
type: execute
wave: 4
depends_on: [15-05]
files_modified:
  - lib/ai-service.ts
  - components/dietary/VoicePreviewModal.tsx
  - components/dietary/index.ts
  - app/dietary.tsx
autonomous: false
requirements: [PREF-13]

must_haves:
  truths:
    - "L'utilisateur peut taper un bouton micro dans le header de l'écran dietary.tsx"
    - "DictaphoneRecorder enregistre et transcrit, puis appelle extractDietaryConstraints"
    - "extractDietaryConstraints appelle callClaude et retourne un tableau DietaryExtraction[]"
    - "Une modale preview éditable s'affiche avec les extractions (checkbox + édition inline)"
    - "L'utilisateur confirme pour appliquer en bulk via updateFoodPreferences/upsertGuest"
    - "Si ai-service échoue, fallback vers modale ajout manuel pré-remplie (pas de toast retry)"
    - "Aucun auto-commit silencieux — l'utilisateur passe toujours par la confirmation"
  artifacts:
    - path: "lib/ai-service.ts"
      provides: "Nouvelle fonction extractDietaryConstraints"
      exports: ["extractDietaryConstraints"]
    - path: "components/dietary/VoicePreviewModal.tsx"
      provides: "Modale preview éditable des extractions IA"
      exports: ["VoicePreviewModal"]
  key_links:
    - from: "app/dietary.tsx header micro"
      to: "components/DictaphoneRecorder"
      via: "<DictaphoneRecorder onResult={handleVoiceTranscript} />"
      pattern: "DictaphoneRecorder"
    - from: "app/dietary.tsx handleVoiceTranscript"
      to: "lib/ai-service.ts extractDietaryConstraints"
      via: "appel async"
      pattern: "extractDietaryConstraints"
    - from: "VoicePreviewModal onConfirm"
      to: "useVault().dietary.updateFoodPreferences"
      via: "loop sur les extractions confirmées"
      pattern: "updateFoodPreferences"
---

<objective>
Livrer la saisie vocale des préférences alimentaires (PREF-13). L'utilisateur dicte, l'IA extrait, une modale preview permet de confirmer/éditer, puis les préférences sont appliquées en bulk.

Purpose: Feature confort majeure — permet de saisir rapidement plusieurs contraintes d'un coup. Sécurité élevée via confirmation obligatoire (aucune allergie ajoutée silencieusement).
Output: Nouvelle fonction ai-service + modale preview + câblage dans app/dietary.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@.planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md
@lib/dietary/types.ts
@lib/dietary/catalogs.ts
@lib/ai-service.ts
@components/DictaphoneRecorder.tsx
@app/dietary.tsx
@CLAUDE.md

<interfaces>
<!-- DietaryExtraction type from Plan 01 -->
From lib/dietary/types.ts:
```typescript
export interface DietaryExtraction {
  profileId: string | null;
  profileName: string;
  category: DietarySeverity; // 'allergie' | 'intolerance' | 'regime' | 'aversion'
  item: string;
  confidence: 'high' | 'medium' | 'low';
}
```

<!-- ai-service pattern -->
From lib/ai-service.ts : `callClaude(config, systemPrompt, messages)` existant. Pattern `summarizeTranscription` ligne ~677 utilise `claude-haiku-4-5-20251001`. Config AIServiceConfig passé depuis le caller.

<!-- DictaphoneRecorder -->
From components/DictaphoneRecorder.tsx : props `{ context: { title, subtitle }, onResult: (text: string) => void, onClose: () => void }`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1: extractDietaryConstraints dans ai-service.ts</name>
  <files>lib/ai-service.ts</files>
  <read_first>
    - lib/ai-service.ts (pattern `summarizeTranscription` ligne ~677, structure `callClaude`, type `AIServiceConfig`)
    - lib/dietary/types.ts (DietaryExtraction)
    - lib/dietary/catalogs.ts (IDs canoniques pour le prompt)
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md (Pattern 6)
  </read_first>
  <action>
    Ajouter dans `lib/ai-service.ts` une nouvelle fonction exportée :

    ```typescript
    import type { DietaryExtraction, DietarySeverity } from './dietary/types';
    import { EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES } from './dietary/catalogs';

    export interface ExtractDietaryContext {
      profiles: { id: string; name: string }[];
      guests: { id: string; name: string }[];
    }

    /**
     * PREF-13 : Interprète une transcription vocale libre pour extraire des préférences
     * alimentaires structurées. Utilise claude-haiku (rapide + moins coûteux).
     *
     * Retourne un tableau d'extractions. En cas d'erreur ou JSON invalide, throw
     * pour que le caller puisse fallback vers la modale manuelle (D-15).
     */
    export async function extractDietaryConstraints(
      config: AIServiceConfig,
      transcript: string,
      ctx: ExtractDietaryContext,
    ): Promise<DietaryExtraction[]> {
      if (!transcript.trim()) return [];

      const profilesList = ctx.profiles.map(p => `- ${p.name} (id: ${p.id}, type: famille)`).join('\n');
      const guestsList = ctx.guests.map(g => `- ${g.name} (id: ${g.id}, type: invité)`).join('\n');
      const allergenIds = EU_ALLERGENS.map(a => a.id).join(', ');
      const intoleranceIds = COMMON_INTOLERANCES.map(i => i.id).join(', ');
      const regimeIds = COMMON_REGIMES.map(r => r.id).join(', ');

      const systemPrompt = `Tu es un assistant qui extrait des préférences alimentaires depuis une transcription vocale en français.
Convives disponibles :
${profilesList}
${guestsList}

Catalogues d'IDs canoniques à préférer :
- Allergies : ${allergenIds}
- Intolérances : ${intoleranceIds}
- Régimes : ${regimeIds}
- Aversions : texte libre (pas de catalogue)

Réponds UNIQUEMENT avec un JSON valide de la forme :
{"extractions": [{"profileId": "lucas", "profileName": "Lucas", "category": "allergie", "item": "arachides", "confidence": "high"}]}

Règles :
- category est exactement "allergie" | "intolerance" | "regime" | "aversion"
- Si l'item correspond à un ID canonique, utilise cet ID. Sinon, utilise le texte libre en minuscules.
- profileId null si le nom du convive n'est pas reconnaissable dans la liste.
- confidence "high" si item+profil clairs, "medium" si une ambiguïté, "low" si très incertain.
- Une transcription peut produire plusieurs extractions.`;

      const haikuConfig = { ...config, model: 'claude-haiku-4-5-20251001' };
      const response = await callClaude(haikuConfig, systemPrompt, [{ role: 'user', content: transcript }]);

      // Parse le JSON (tolérant aux code fences)
      const cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.extractions || !Array.isArray(parsed.extractions)) {
        throw new Error('extractDietaryConstraints: format JSON invalide');
      }
      // Validation des champs et coerce category
      const validCategories: DietarySeverity[] = ['allergie', 'intolerance', 'regime', 'aversion'];
      return parsed.extractions.filter((e: any) =>
        typeof e.item === 'string' &&
        validCategories.includes(e.category) &&
        typeof e.profileName === 'string'
      );
    }
    ```

    - Placer la fonction à la fin du fichier, avant le dernier export
    - NE PAS modifier les fonctions existantes
    - Commentaires en français
    - Gérer les erreurs : laisser throw remonter pour que le caller fallback
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function extractDietaryConstraints" lib/ai-service.ts`
    - `grep -q "DietaryExtraction" lib/ai-service.ts`
    - `grep -q "claude-haiku-4-5-20251001" lib/ai-service.ts` (cohérence modèle)
    - `grep -q "EU_ALLERGENS" lib/ai-service.ts`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Fonction d'extraction IA disponible, tsc passe</done>
</task>

<task type="auto">
  <name>Tâche 2: VoicePreviewModal + câblage dans app/dietary.tsx</name>
  <files>components/dietary/VoicePreviewModal.tsx, components/dietary/index.ts, app/dietary.tsx</files>
  <read_first>
    - components/DictaphoneRecorder.tsx (API props)
    - .planning/phases/15-pr-f-rences-alimentaires/15-UI-SPEC.md (section "Modal preview vocale" lignes 154-157)
    - .planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md (D-13, D-14, D-15)
    - lib/dietary/types.ts
    - app/dietary.tsx (créé en Plan 05)
    - components/ui/ModalHeader.tsx
  </read_first>
  <action>
    1. Créer `components/dietary/VoicePreviewModal.tsx` :

    ```typescript
    export interface VoicePreviewModalProps {
      visible: boolean;
      extractions: DietaryExtraction[];
      profiles: { id: string; name: string }[];
      guests: { id: string; name: string }[];
      onClose: () => void;
      onConfirm: (confirmedExtractions: DietaryExtraction[]) => void;
    }
    ```

    Comportement :
    - `Modal presentationStyle="pageSheet"`, drag-to-dismiss
    - ModalHeader titre "Vérifier les préférences détectées", sous-titre "Décochez ou modifiez avant de confirmer."
    - Pour chaque extraction, un row avec :
      - Checkbox cochée par défaut (state local `selected: Record<number, boolean>`)
      - Picker profil (profil famille OU invité) — simple liste de Chips ou un petit picker natif
      - Picker catégorie (allergie / intolerance / regime / aversion)
      - TextInput pour l'item
    - Footer sticky : `<Button label="Tout décocher">` (secondary) + `<Button label={`Confirmer (${count})`}>` (primary) où count = nb extractions cochées
    - `onConfirm` appelé avec les extractions filtrées (celles cochées + éditées)
    - useThemeColors, pas de hex, React.memo, commentaires FR
    - Haptics.selectionAsync au toggle checkbox

    2. Dans `app/dietary.tsx`, remplacer le stub `{/* PREF-13 voice input — Plan 07 */}` par :

    ```typescript
    const [recorderVisible, setRecorderVisible] = useState(false);
    const [extractions, setExtractions] = useState<DietaryExtraction[] | null>(null);
    const [fallbackManualText, setFallbackManualText] = useState<string | null>(null);

    const handleVoiceTranscript = useCallback(async (text: string) => {
      setRecorderVisible(false);
      if (!text.trim()) return; // pitfall 5 : ignore les transcriptions vides
      try {
        const aiConfig = /* récupérer depuis useAI() ou un autre context existant — vérifier le pattern */;
        const results = await extractDietaryConstraints(aiConfig, text, {
          profiles: profiles.map(p => ({ id: p.id, name: p.name })),
          guests: dietary.guests.map(g => ({ id: g.id, name: g.name })),
        });
        if (results.length === 0) {
          // D-15 : fallback manuel avec texte brut
          setFallbackManualText(text);
          return;
        }
        setExtractions(results);
      } catch (e) {
        if (__DEV__) console.warn('extractDietaryConstraints failed', e);
        // D-15 : fallback gracieux — ouvrir modal manuel pré-rempli, pas de toast
        setFallbackManualText(text);
      }
    }, [profiles, dietary.guests]);

    const handleConfirmVoiceExtractions = useCallback(async (confirmed: DietaryExtraction[]) => {
      for (const ex of confirmed) {
        if (!ex.profileId) continue;
        // Détermine si c'est un profil famille ou un invité
        const isFamily = profiles.some(p => p.id === ex.profileId);
        const categoryKey = ex.category === 'allergie' ? 'allergies'
          : ex.category === 'intolerance' ? 'intolerances'
          : ex.category === 'regime' ? 'regimes'
          : 'aversions';
        if (isFamily) {
          const existing = /* lire les items actuels du profil via profiles[] */;
          await dietary.updateFoodPreferences(ex.profileId, categoryKey, [...existing, ex.item]);
        } else {
          const guest = dietary.guests.find(g => g.id === ex.profileId);
          if (guest) {
            const field = `food${categoryKey[0].toUpperCase()}${categoryKey.slice(1)}` as const;
            await dietary.upsertGuest({ ...guest, [field]: [...(guest as any)[field], ex.item] });
          }
        }
      }
      setExtractions(null);
    }, [profiles, dietary]);
    ```

    Dans le header de l'écran, ajouter le bouton micro (un IconButton/Pressable avec emoji 🎤 ou composant existant) qui `onPress={() => setRecorderVisible(true)}`. Zone de tap minimum 44px.

    Rendre conditionnellement :
    - `{recorderVisible && <DictaphoneRecorder context={{ title: "Préférences alimentaires", subtitle: "Dictez les préférences…" }} onResult={handleVoiceTranscript} onClose={() => setRecorderVisible(false)} />}`
    - `<VoicePreviewModal visible={extractions !== null} extractions={extractions ?? []} profiles={profiles} guests={dietary.guests} onClose={() => setExtractions(null)} onConfirm={handleConfirmVoiceExtractions} />`
    - Pour `fallbackManualText`, ouvrir la modale manuelle existante (ou un Alert.alert simple si aucune modale manuelle distincte n'existe — dans ce cas, afficher un Alert "Reconnaissance vocale incomplète" avec option d'ajouter manuellement). Préférer réutiliser le flow d'ajout existant en focus sur la première DietaryAutocomplete.

    3. Barrel : exporter `VoicePreviewModal`.

    Contraintes : useThemeColors, pas de hex, commentaires FR, useCallback, React.memo sur VoicePreviewModal.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `components/dietary/VoicePreviewModal.tsx` existe
    - `grep -q "Vérifier les préférences détectées" components/dietary/VoicePreviewModal.tsx`
    - `grep -q "Décochez ou modifiez avant de confirmer" components/dietary/VoicePreviewModal.tsx`
    - `grep -q "Confirmer" components/dietary/VoicePreviewModal.tsx`
    - `grep -q 'presentationStyle="pageSheet"' components/dietary/VoicePreviewModal.tsx`
    - `grep -q "DictaphoneRecorder" app/dietary.tsx`
    - `grep -q "extractDietaryConstraints" app/dietary.tsx`
    - `grep -q "VoicePreviewModal" app/dietary.tsx`
    - `grep -q "if (!text.trim())" app/dietary.tsx` (pitfall 5 : ignore vide)
    - `! grep -qE "#[0-9A-Fa-f]{3,}" components/dietary/VoicePreviewModal.tsx`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>Saisie vocale fonctionnelle de bout en bout, fallback manuel, aucun auto-commit silencieux</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Tâche 3: Checkpoint saisie vocale end-to-end</name>
  <files>(checkpoint — verification manuelle)</files>
  <action>Checkpoint utilisateur : voir &lt;what-built&gt; et &lt;how-to-verify&gt; ci-dessous pour les étapes de vérification visuelle.</action>
  <verify>Vérification manuelle selon &lt;how-to-verify&gt;</verify>
  <done>L'utilisateur a tapé "approuvé" dans &lt;resume-signal&gt;</done>
  <what-built>
    - Bouton micro dans le header de l'écran Préférences alimentaires
    - Dictée → extraction IA → modale preview éditable → confirmation en bulk
    - Fallback gracieux si l'IA échoue
  </what-built>
  <how-to-verify>
    1. Lancer `npx expo run:ios --device`
    2. Ouvrir "Préférences alimentaires" → taper le bouton micro dans le header
    3. Dicter : "Lucas est allergique aux arachides et aux noisettes, Emma est intolérante au lactose"
    4. Relâcher → DictaphoneRecorder ferme → modal "Vérifier les préférences détectées" s'ouvre
    5. Vérifier que 3 extractions apparaissent cochées par défaut :
       - Lucas / allergie / arachides
       - Lucas / allergie / noisettes (ou fruits_a_coque)
       - Emma / intolérance / lactose
    6. Décocher la 2e extraction → taper "Confirmer (2)"
    7. Vérifier que les profils Lucas et Emma ont maintenant les préférences ajoutées
    8. Test fallback : dicter un texte inintelligible ("blablabla") → vérifier qu'aucun crash ne survient et qu'un fallback gracieux s'affiche (modal manuel ou Alert)
    9. Vérifier dans le code : `grep -q "if (!text.trim())" app/dietary.tsx` (pas de crash sur dictée vide)
    10. Vérifier qu'aucune préférence n'a été ajoutée en arrière-plan sans confirmation explicite
  </how-to-verify>
  <resume-signal>Tapez "approuvé" après avoir confirmé que la saisie vocale fonctionne avec confirmation obligatoire</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe
- Aucun auto-commit silencieux (toute extraction passe par la modale preview)
- Transcription vide ignorée (pitfall 5)
- Fallback gracieux en cas d'échec IA (D-15)
</verification>

<success_criteria>
L'utilisateur peut dicter une phrase multi-préférences et valider l'ensemble en une seule interaction. PREF-13 livré avec sécurité maximale (confirmation obligatoire).
</success_criteria>

<output>
`.planning/phases/15-pr-f-rences-alimentaires/15-07-SUMMARY.md`
</output>
