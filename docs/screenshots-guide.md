# Guide Screenshots App Store — Family Vault

## Tailles requises

Apple exige des screenshots pour ces tailles d'écran :
- **6.7"** (iPhone 16 Pro Max / 15 Pro Max) — 1290 x 2796 px — **OBLIGATOIRE**
- **6.5"** (iPhone 14 Plus / 13 Pro Max) — 1284 x 2778 px — optionnel si 6.7" fourni
- **5.5"** (iPhone 8 Plus) — 1242 x 2208 px — optionnel si 6.7" fourni

**Ton iPhone 16 Pro** fait du 6.3" (1206 x 2622) — il faut utiliser le simulateur 6.7" OU upscaler les captures.

## Écrans à capturer (5-6 screenshots recommandés)

1. **Dashboard** — l'écran d'accueil avec les sections visibles (repas, tâches, RDV)
2. **Journal bébé** — une journée avec des entrées (biberon, couche, sommeil)
3. **Repas de la semaine** — planning avec des repas remplis
4. **Tâches** — liste de tâches avec la météo enfant
5. **Réglages sécurité** — écran Face ID / PIN (rassure sur la vie privée)
6. **Widget** — capture d'écran du widget sur l'écran d'accueil iOS

## Comment capturer

### Option A : Depuis ton iPhone
1. Ouvre l'app
2. Capture : bouton latéral + volume haut
3. Les captures font 1206x2622 (iPhone 16 Pro)
4. Upload sur App Store Connect — Apple accepte et redimensionne

### Option B : Simulateur (taille exacte)
```bash
# Booter le simulateur 6.7"
xcrun simctl boot "iPhone 17 Pro Max"
open -a Simulator

# Installer l'app
npx expo run:ios --device "iPhone 17 Pro Max"

# Capturer
xcrun simctl io "iPhone 17 Pro Max" screenshot screenshot-1.png
```

## Règles
- **PAS de données personnelles réelles** — utiliser des prénoms génériques (Lucas, Emma, Dupont)
- Texte lisible, pas trop chargé
- Mode clair de préférence (plus lisible dans le store)
