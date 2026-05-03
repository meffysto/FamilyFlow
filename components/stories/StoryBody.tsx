/**
 * StoryBody — Rendu picture-book unifié du corps d'une histoire.
 *
 * Une seule source de vérité pour les écrans génération/replay/library :
 *  - Si `histoire.scenes` est présent → scroll de StoryPage avec illustrations
 *    bundlées matchées par {univers, archétype}
 *  - Sinon → fallback élégant : un seul StoryPage texte-seul (toujours dans
 *    le nouveau style cream + Patrick Hand, sans illustration)
 *
 * Volontairement minimal : ne gère ni l'audio, ni les contrôles. Le caller
 * compose <StoryBody> + <StoryPlayer> dans son écran.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { StoryPage } from './StoryPage';
import { getIllustration } from '../../lib/story-illustrations';
import { stripAllPerformanceTags } from '../../lib/elevenlabs';
import type { BedtimeStory } from '../../lib/types';

interface StoryBodyProps {
  histoire: BedtimeStory;
  /** Affiche le titre au-dessus de la 1ère page. Défaut true. */
  showTitle?: boolean;
}

export const StoryBody = React.memo(function StoryBody({ histoire, showTitle = true }: StoryBodyProps) {
  // On nettoie les tags de performance ([whispers] etc.) qui ne doivent pas
  // s'afficher visuellement, mais sont conservés dans le texte pour ElevenLabs.
  const cleanText = useMemo(() => stripAllPerformanceTags(histoire.texte), [histoire.texte]);

  const pages = useMemo(() => {
    if (!histoire.scenes || histoire.scenes.scenes.length === 0) {
      // Fallback : 1 seule page texte-seul, sans illustration.
      // Le style cream + Patrick Hand reste appliqué via StoryPage.
      return [{
        key: 'fallback',
        text: cleanText,
        highlights: [],
        image: null,
        isLast: true,
      }];
    }

    return histoire.scenes.scenes.map((scene, idx) => {
      // sceneText = substring du texte ORIGINAL (avec tags). On le re-strippe
      // pour l'affichage, ce qui change potentiellement les indices highlights.
      // Pour rester safe, on calcule sur le texte original puis on strippe à la fin
      // — les highlights resteront alignés tant que les tags ne tombent pas
      // au milieu d'un mot-clé (heuristiquement vrai vu la règle du prompt).
      const rawSceneText = histoire.texte.slice(scene.textStart, scene.textEnd);
      const text = stripAllPerformanceTags(rawSceneText);
      const image = getIllustration(histoire.univers, scene.archetype);
      return {
        key: `scene-${scene.panelIndex}`,
        text,
        highlights: scene.highlights,
        image,
        isLast: idx === histoire.scenes!.scenes.length - 1,
      };
    });
  }, [histoire.scenes, histoire.texte, histoire.univers, cleanText]);

  return (
    <View style={styles.container}>
      {showTitle && histoire.titre ? (
        <Text style={styles.title}>{histoire.titre}</Text>
      ) : null}
      {pages.map((page) => (
        <StoryPage
          key={page.key}
          text={page.text}
          highlights={page.highlights}
          image={page.image}
          isLast={page.isLast}
        />
      ))}
    </View>
  );
});

/** Couleur cream du parchemin — exposée pour que les écrans qui montent
 *  StoryBody puissent peindre TOUT le viewport en cream (pas de boîte). */
export const STORY_PAPER_COLOR = '#F5EFE0';

const styles = StyleSheet.create({
  container: {
    backgroundColor: STORY_PAPER_COLOR,
    paddingTop: 16,
    paddingBottom: 32,
  },
  title: {
    fontFamily: 'PatrickHand_400Regular',
    fontSize: 32,
    color: '#2C3E50',
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
  },
});
