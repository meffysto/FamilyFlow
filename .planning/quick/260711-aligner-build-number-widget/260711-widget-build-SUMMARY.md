---
phase: quick-260711-widget-build
type: quick
status: done
---

# Summary

## Changements

- `MaJourneeWidget` utilise maintenant `CURRENT_PROJECT_VERSION = 30` en Debug et Release.
- `MaJourneeWidget` utilise maintenant `MARKETING_VERSION = 1.2.5` en Debug et Release.
- Le plugin Expo `with-widget` applique maintenant ces valeurs directement aux build configurations du target widget.

## Verification

- Build Release iPhoneOS OK.
- Le warning `CFBundleVersion` parent/widget n'apparait plus dans `ValidateEmbeddedBinary`.
