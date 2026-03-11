/**
 * ScreenGuide.tsx — Orchestrateur de coach marks par écran
 *
 * Vérifie si l'écran a été vu, mesure les cibles, affiche la séquence.
 * Usage :
 *   <ScreenGuide
 *     screenId="dashboard"
 *     targets={[
 *       { ref: headerRef, ...HELP_CONTENT.dashboard[0] },
 *       { ref: fabRef, ...HELP_CONTENT.dashboard[1] },
 *     ]}
 *   />
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useHelp } from '../../contexts/HelpContext';
import { CoachMark, type TargetRect } from './CoachMark';
import { CoachMarkOverlay } from './CoachMarkOverlay';

interface ScreenGuideTarget {
  /** Ref vers l'élément cible */
  ref: React.RefObject<View>;
  /** Titre du coach mark (optionnel) */
  title?: string;
  /** Corps du coach mark */
  body: string;
  /** Position de la bulle */
  position: 'above' | 'below';
}

interface ScreenGuideProps {
  screenId: string;
  targets: ScreenGuideTarget[];
  /** Délai avant affichage du premier coach mark (défaut: 600ms) */
  delay?: number;
}

function measureTarget(ref: React.RefObject<View>): Promise<TargetRect | null> {
  return new Promise((resolve) => {
    if (!ref.current) {
      resolve(null);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

export const ScreenGuide = React.memo(function ScreenGuide({
  screenId,
  targets,
  delay = 600,
}: ScreenGuideProps) {
  const { hasSeenScreen, markScreenSeen, isLoaded } = useHelp();
  const [currentStep, setCurrentStep] = useState(-1); // -1 = pas encore démarré
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const hasStarted = useRef(false);
  const seen = hasSeenScreen(screenId);

  // Quand resetScreen() est appelé (guide), réautoriser le démarrage
  useEffect(() => {
    if (!seen) {
      hasStarted.current = false;
    }
  }, [seen]);

  // Vérifier et démarrer la séquence
  useEffect(() => {
    if (!isLoaded || hasStarted.current) return;
    if (seen) return;
    if (targets.length === 0) return;

    hasStarted.current = true;

    const timer = setTimeout(async () => {
      // Mesurer la première cible
      const rect = await measureTarget(targets[0].ref);
      if (rect) {
        setTargetRect(rect);
        setCurrentStep(0);
      } else {
        // Cible non montée → marquer comme vu et abandonner
        markScreenSeen(screenId);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoaded, seen, screenId, targets, delay]);

  const handleNext = useCallback(async () => {
    const nextStep = currentStep + 1;
    if (nextStep >= targets.length) {
      // Séquence terminée
      setCurrentStep(-1);
      setTargetRect(null);
      markScreenSeen(screenId);
      return;
    }

    // Mesurer la cible suivante
    const rect = await measureTarget(targets[nextStep].ref);
    if (rect) {
      setTargetRect(rect);
      setCurrentStep(nextStep);
    } else {
      // Cible non disponible → terminer
      setCurrentStep(-1);
      setTargetRect(null);
      markScreenSeen(screenId);
    }
  }, [currentStep, targets, screenId, markScreenSeen]);

  const handleDismiss = useCallback(() => {
    setCurrentStep(-1);
    setTargetRect(null);
    markScreenSeen(screenId);
  }, [screenId, markScreenSeen]);

  // Rien à afficher
  if (currentStep < 0 || !targetRect) return null;

  const current = targets[currentStep];
  if (!current) return null;

  const isLast = currentStep === targets.length - 1;

  return (
    <>
      <CoachMarkOverlay
        targetRect={targetRect}
        onPress={handleDismiss}
      />
      <CoachMark
        targetRect={targetRect}
        title={current.title}
        body={current.body}
        position={current.position}
        step={{ current: currentStep + 1, total: targets.length }}
        onNext={isLast ? undefined : handleNext}
        onDismiss={isLast ? handleDismiss : handleDismiss}
        buttonLabel={isLast ? 'Compris !' : 'Suivant'}
      />
    </>
  );
});
