---
status: resolved
trigger: "FAM-36 — La modification du parcours de courses ne fonctionne pas"
created: 2026-06-08
updated: 2026-06-08
---

# Debug Session: FAM-36 — Modification du parcours de courses pas sauvegardée

## Symptoms (from Linear FAM-36 + clarification reporter)

DATA_START
Capture jointe : écran Pré-départ ("tu fais les courses pour Principale"),
parcours affiché 1 Viandes / 2 Autres / 3 Bébé, CTA "Modifier mon parcours".

Comportement observé (confirmé par l'utilisateur) :
- Le bouton "Modifier mon parcours" OUVRE bien ParcoursEditorModal.
- Le réordonnancement des rayons (flèches ↑/↓) FONCTIONNE visuellement dans l'éditeur.
- MAIS après "Enregistrer" : l'ordre n'est PAS sauvegardé — soit il revient à
  l'ancien ordre, soit le mode magasin / le Pré-départ continue d'ignorer le
  nouvel ordre.
DATA_END

## Hypothèses initiales (orchestrateur)

- ~~Modal pageSheet imbriqué dans Modal fullScreen ne se présente pas (iOS)~~ → ÉLIMINÉ (le modal s'ouvre bien, confirmé utilisateur).
- L'écriture du parcours dans le frontmatter échoue silencieusement sur l'appareil (iCloud / chemin) — `warnUnexpected` avale l'erreur.
- Mismatch de chaînes de section : les strings de `parcours` sauvegardées ne matchent pas exactement `rawSections` (= courseSections) au moment de l'affichage → le tri par parcours n'a aucun effet visible (`ShoppingModeView`/`PreDepartView` filtrent `parcours.filter(s => present.has(s))`).
- Round-trip YAML : sérialisation/parsing du tableau `parcours` altère une chaîne (emoji, quoting, espace) → re-parse différent de l'écrit.

## Evidence

- timestamp: 2026-06-08T00:00:00Z
  file: app/(tabs)/meals.tsx:3407-3419, 3467-3479
  finding: >
    ParcoursEditorModal est rendu DEUX fois, lié au même état showParcoursEditor,
    imbriqué dans le Modal Pré-départ (fullScreen) et le Modal Mode-magasin (fullScreen).
    RN Modal retourne null quand visible !== true (vérifié), donc pas de double-présentation
    fantôme. onSave → setListParcours(activeListId, newOrder) puis setShowParcoursEditor(false).

- timestamp: 2026-06-08T00:00:01Z
  file: hooks/useVaultCourses.ts:744-763 (setListParcours)
  finding: >
    Lit le fichier, parseCourseList, construit newMeta avec parcours (ou parcours:undefined
    si vide), serializeCourseList, writeFile, loadListes. Erreurs avalées par warnUnexpected
    (catch silencieux). Logiquement correct.

- timestamp: 2026-06-08T00:00:02Z
  file: lib/parser.ts:582-592 (parse) / 631-643 (serialize meta) / 684 (serializeCourseList)
  finding: >
    serializeCourseList utilise serializeCourseListMeta(meta) qui inclut bien le bloc parcours
    (quoting si char spécial dans [:"'#&*?|<>=!%@`]). parseCourseList relit data.parcours
    (filtre strings non vides). Round-trip correct sur chaînes simples (Viandes/Autres/Bébé).

- timestamp: 2026-06-08T00:00:03Z
  file: hooks/useVaultCourses.ts:322-449 (toggle/remove/move/update)
  finding: >
    Les autres writes opèrent par splice de lignes brutes et préservent le frontmatter
    (donc parcours). MAIS ces writes utilisent item.lineIndex capturé dans courses state —
    qui devient périmé dès que setListParcours réécrit le fichier via serializeCourseList.

- timestamp: 2026-06-08T00:00:04Z
  file: lib/vault-cache.ts:74,112
  finding: >
    Le cache stocke `courses: CourseItem[]` mais PAS `listes: CourseList[]`. Les listes
    (et donc parcours) sont chargées fraîches à chaque mount via loadListes. Donc le cache
    n'est PAS responsable d'un retour à l'ancien ordre au relaunch.

- timestamp: 2026-06-08T00:00:05Z
  file: components/ShoppingModeView.tsx:101-108, components/PreDepartView.tsx:109-116
  finding: >
    Réordonnancement : `parcours.filter(s => present.has(s))` où present = Set(rawSections).
    Si une chaîne de parcours ne matche pas exactement une chaîne de rawSections, elle est
    silencieusement écartée → l'ordre appris n'a aucun effet visible. Point chaud à instrumenter.

- timestamp: 2026-06-08T01:00:00Z
  file: hooks/useVaultCourses.ts:744-763 (setListParcours) + 322-449 (toggle/remove/move)
  finding: >
    ROOT CAUSE : setListParcours appelle serializeCourseList() qui reconstruit intégralement
    le fichier (frontmatter + body). Quand parcours est ajouté pour la première fois,
    le frontmatter grossit de N+1 lignes (N = nombre de sections), décalant tous les
    lineIndex des items. Mais courses state n'est PAS resynchronisé après ce write —
    seulement listes via loadListes(). Le premier toggleCourseItem/removeCourseItem/moveCourseItem
    suivant utilise les vieux lineIndex, splicing les mauvaises lignes du nouveau fichier.
    Cela corrompt le frontmatter (écrase les lignes parcours) ou mélange les items.
    loadListes() déclenché par ce write corrompu relit un fichier cassé → parcours disparu.
    Le symptôme "revient à l'ancien ordre" est en réalité une corruption du fichier par
    un write consécutif avec des indices périmés.

## Eliminated

- hypothesis: Modal pageSheet imbriqué dans Modal fullScreen ne se présente pas (iOS).
  reason: L'utilisateur confirme que l'éditeur s'ouvre et que le réordonnancement fonctionne.

- hypothesis: Cache (vault-cache) réhydrate un parcours périmé au relaunch.
  reason: vault-cache ne stocke pas `listes`/CourseList — parcours toujours chargé frais du vault.

- hypothesis: Mismatch de chaînes de section (parcours vs rawSections).
  reason: ParcoursEditorModal reçoit sections=courseSections et sauvegarde des strings de
  cette même liste. Pas de divergence de strings.

- hypothesis: Round-trip YAML altère les chaînes.
  reason: serializeCourseListMeta + parseCourseList round-trippent correctement les strings
  simples (Viandes/Autres/Bébé) — quoting conditionnel correct.

## Resolution

root_cause: >
  setListParcours (hooks/useVaultCourses.ts:744) appelle serializeCourseList() qui
  reconstruit intégralement le fichier depuis les items parsés. Cela décale tous les
  lineIndex quand le frontmatter grossit (ex: ajout bloc parcours: 3-5 lignes). Le state
  courses n'est pas resynchronisé après ce write. Le prochain toggle/remove/move utilise
  des lineIndex périmés, splicing les mauvaises lignes — corrompant le frontmatter et
  effaçant le parcours qui venait d'être sauvegardé.

fix: >
  Après vm.writeFile() dans setListParcours, re-parser le contenu écrit (newContent est
  déjà en mémoire, pas de relecture disque) et appeler setCourses(freshItems) si la liste
  éditée est la liste active (activeListIdRef.current). 7 lignes ajoutées.
  Fichier modifié : hooks/useVaultCourses.ts (lignes 757-767 post-fix).
  tsc --noEmit : OK.
