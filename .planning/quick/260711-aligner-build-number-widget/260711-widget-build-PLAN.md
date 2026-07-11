---
phase: quick-260711-widget-build
type: quick
status: done
---

# Plan

## Objectif

Aligner le build number de `MaJourneeWidget` avec celui de l'app parente pour supprimer le warning Xcode `CFBundleVersion`.

## Scope

- Lire les versions app/widget dans les plists et le projet Xcode.
- Mettre a jour les build settings du target widget.
- Verifier par build Release iPhoneOS.
