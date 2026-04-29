/**
 * visitor-sprites.ts — Mapping portraits PNJ Auberge (Phase 47)
 *
 * Mirror du pattern building-sprites.ts : assets chargés au top-level pour
 * garantir la résolution Metro. Les clés DOIVENT matcher exactement les `id`
 * du VISITOR_CATALOG (lib/mascot/visitor-catalog.ts).
 */

// Assets chargés au top-level pour garantir la résolution Metro
const HUGO = require('../../assets/visitors/boulanger.png');
const LUCETTE = require('../../assets/visitors/lucette.png');
const VOYAGEUSE = require('../../assets/visitors/voyageuse.png');
const YANN = require('../../assets/visitors/apiculteur.png');
const MARCHAND = require('../../assets/visitors/marchand.png');
const COMTESSE = require('../../assets/visitors/comtesse.png');

/**
 * Mapping visitorId (du VISITOR_CATALOG) → asset PNG.
 * Les consommateurs (AubergeSheet, DashboardAuberge) doivent fallback emoji
 * si la clé n'est pas trouvée (rétrocompat futurs PNJ).
 */
export const VISITOR_SPRITES: Record<string, any> = {
  hugo_boulanger:    HUGO,
  meme_lucette:      LUCETTE,
  voyageuse:         VOYAGEUSE,
  yann_apiculteur:   YANN,
  marchand_ambulant: MARCHAND,
  comtesse:          COMTESSE,
};
