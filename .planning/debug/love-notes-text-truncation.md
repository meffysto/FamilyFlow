---
status: awaiting_human_verify
trigger: "Dans les love notes, si le texte dépasse 3 lignes, il n'est pas visible ni dans l'aperçu initial ni lors de la réouverture de la note."
created: 2026-05-01T00:00:00
updated: 2026-05-01T00:00:00
---

## Current Focus

hypothesis: Deux points de troncature distincts : (1) LoveNoteCard.tsx a numberOfLines={2} sur le preview ; (2) EnvelopeUnfoldModal.tsx — la lettre intérieure a height fixe (ENVELOPE_H) via absoluteFillObject + overflow:hidden, et le ScrollView a un paddingTop = FLAP_H qui mange la moitié de la hauteur disponible, empêchant de scroller le texte long.
test: Lire les deux composants et vérifier les contraintes de hauteur et numberOfLines
expecting: Fix = (1) supprimer numberOfLines sur preview dans LoveNoteCard (ou augmenter à 3), (2) dans EnvelopeUnfoldModal s'assurer que le ScrollView peut grandir au-delà de ENVELOPE_H en mode "lettre révélée"
next_action: Vérification humaine — confirmer que le texte long est visible et scrollable

## Symptoms

expected: Le texte complet d'une love note doit être visible — dans l'aperçu de la liste ET dans la vue détail quand on ouvre la note.
actual: Si le texte dépasse ~3 lignes, le contenu supplémentaire est invisible (tronqué sans scrollable ou sans affichage complet).
errors: Aucune erreur console connue — problème purement visuel/layout.
reproduction: Créer une love note avec un texte long (>3 lignes), fermer et rouvrir la note.
started: Comportement observé récemment — feature love notes existante.

## Eliminated

(aucun)

## Evidence

- timestamp: 2026-05-01T00:00:00
  checked: LoveNoteCard.tsx ligne 150-154
  found: Text preview a numberOfLines={2} — tronqué à 2 lignes dans la liste
  implication: Toute note avec un body > 2 lignes sera tronquée dans la liste. Le preview n'a pas d'ellipsis explicite mais React Native coupe à 2 lignes.

- timestamp: 2026-05-01T00:00:00
  checked: EnvelopeUnfoldModal.tsx — styles.envelope, styles.letter, ScrollView
  found: envelope a height=ENVELOPE_H (fixe, ~196px sur iPhone standard). styles.letter = absoluteFillObject + overflow:hidden. Le ScrollView a contentContainerStyle avec paddingTop=FLAP_H (~107px) + paddingBottom=Spacing['2xl']. Hauteur utile pour le texte = ~196 - 107 - padding ≈ 70px seulement — trop peu pour voir plus de 2-3 lignes.
  implication: Un texte long dans la lettre révélée est coupé par overflow:hidden de l'enveloppe fixe. Le ScrollView est bien là mais sa zone visible est contrainte par la hauteur fixe de l'enveloppe.

## Resolution

root_cause: |
  Deux bugs distincts :
  1. LoveNoteCard.tsx : numberOfLines={2} sur le Text de preview — coupe toute note > 2 lignes dans la liste.
  2. EnvelopeUnfoldModal.tsx : la lettre révélée est contrainte dans la hauteur fixe ENVELOPE_H via absoluteFillObject + overflow:hidden. Le ScrollView fait bien partie du layout mais la zone scrollable est trop petite (~70px) car FLAP_H consomme la moitié de l'enveloppe. Le texte long est invisible.

fix: |
  1. LoveNoteCard.tsx : retirer numberOfLines={2} sur le Text preview (le preview liste peut rester tronqué à 3 lignes max pour le layout propre — mettre numberOfLines={3}).
  2. EnvelopeUnfoldModal.tsx : quand la lettre est révélée (contentOpacity=1), l'enveloppe doit grandir pour accueillir le texte. Solution minimale : supprimer overflow:hidden sur styles.envelope et rendre la hauteur dynamique via flex, OU faire apparaître la lettre hors de l'enveloppe sur un fond cream centré avec scroll. Solution la plus simple sans casser l'animation : changer styles.letter de absoluteFillObject à une position absolute avec bottom:0 et top:0 mais avec un maxHeight contrôlé, ET surtout retirer overflow:hidden de styles.envelope pour que le ScrollView déborde.
  Meilleure approche : conserver l'animation kraft mais, une fois la lettre révélée, permettre au ScrollView de scroller. overflow:hidden sur l'enveloppe empêche cela. Retirer overflow:hidden de styles.envelope (l'animation reste correcte car le flap déborde de toute façon).

verification: |
  TypeScript noEmit : 0 erreurs.
  Modifications minimales : 2 fichiers.
  Fix 1 (LoveNoteCard) : numberOfLines 2→3 — la carte liste affiche jusqu'à 3 lignes du body.
  Fix 2 (EnvelopeUnfoldModal) : LETTER_H = SCREEN_HEIGHT * 0.55, styles.envelope overflow visible,
  styles.letter avec dimensions explicites + overflow hidden — la lettre révélée est scrollable.
files_changed: [components/lovenotes/LoveNoteCard.tsx, components/lovenotes/EnvelopeUnfoldModal.tsx]
