/**
 * stock-matcher.ts — Matching entre articles de ticket et produits en stock
 *
 * Utilise un matching flou (normalisation + inclusion) pour trouver les
 * correspondances entre les articles d'un ticket de caisse et les produits
 * suivis dans le stock familial.
 */

import type { StockItem } from './types';

export interface StockMatch {
  /** Article du ticket */
  receiptLabel: string;
  receiptAmount: number;
  /** Produit stock correspondant (null si nouveau) */
  stockItem: StockItem | null;
  /** Quantité à ajouter (par défaut: qteAchat du stock ou 1) */
  qtyToAdd: number;
  /** Sélectionné par l'utilisateur pour mise à jour */
  selected: boolean;
  /** Pour les nouveaux produits: emplacement suggéré */
  suggestedEmplacement?: string;
}

/**
 * Normalise un texte pour la comparaison (minuscules, sans accents, sans ponctuation)
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // supprime les accents
    .replace(/[^a-z0-9\s]/g, '')      // supprime la ponctuation
    .trim();
}

/**
 * Calcule un score de matching entre un label de ticket et un produit stock.
 * Retourne 0 si pas de match, un score positif sinon (plus c'est haut, meilleur le match).
 */
function matchScore(receiptLabel: string, stockItem: StockItem): number {
  const receipt = normalize(receiptLabel);
  const product = normalize(stockItem.produit);
  const detail = stockItem.detail ? normalize(stockItem.detail) : '';

  // Match exact du nom produit
  if (receipt === product) return 100;

  // Le nom du produit est contenu dans le label du ticket
  if (receipt.includes(product) && product.length >= 3) return 80;

  // Le label du ticket est contenu dans le nom du produit
  if (product.includes(receipt) && receipt.length >= 3) return 70;

  // Match sur les mots individuels du produit (tous les mots du produit sont dans le label)
  const productWords = product.split(/\s+/).filter(w => w.length >= 3);
  if (productWords.length > 0) {
    const matchedWords = productWords.filter(w => receipt.includes(w));
    if (matchedWords.length === productWords.length) return 60;
    if (matchedWords.length > 0 && matchedWords.length >= productWords.length * 0.5) return 40;
  }

  // Match avec le détail aussi
  if (detail && detail.length >= 2) {
    if (receipt.includes(detail) && receipt.includes(product.split(/\s+/)[0])) return 50;
  }

  return 0;
}

/**
 * Suggère un emplacement pour un article de ticket basé sur sa catégorie budget.
 * Les catégories budget sont comme "🛒 Courses", "👶 Bébé", etc.
 */
function suggestEmplacement(receiptCategory: string): string {
  const cat = normalize(receiptCategory);
  if (cat.includes('bebe') || cat.includes('couche') || cat.includes('hygiene')) return 'bebe';
  if (cat.includes('surgele') || cat.includes('congel')) return 'congelateur';
  // Par défaut : la plupart des courses vont dans les placards
  return 'placards';
}

/**
 * Matche les articles d'un ticket avec les produits en stock.
 *
 * @param receiptItems — articles du ticket (label, amount, category)
 * @param stock — produits en stock actuels
 * @returns — liste de matches (existants + nouveaux)
 */
export function matchReceiptToStock(
  receiptItems: Array<{ label: string; amount: number; category: string }>,
  stock: StockItem[],
): StockMatch[] {
  const matches: StockMatch[] = [];
  const usedStockIndices = new Set<number>();

  for (const item of receiptItems) {
    // Trouver le meilleur match dans le stock
    let bestMatch: StockItem | null = null;
    let bestScore = 0;
    let bestIndex = -1;

    for (let i = 0; i < stock.length; i++) {
      if (usedStockIndices.has(i)) continue; // déjà matché
      const score = matchScore(item.label, stock[i]);
      if (score > bestScore && score >= 40) { // seuil minimum de 40
        bestScore = score;
        bestMatch = stock[i];
        bestIndex = i;
        // Très bon match, pas besoin de chercher plus loin
        if (score >= 80) break;
      }
    }

    if (bestMatch && bestIndex >= 0) {
      usedStockIndices.add(bestIndex);

      matches.push({
        receiptLabel: item.label,
        receiptAmount: item.amount,
        stockItem: bestMatch,
        qtyToAdd: bestMatch.qteAchat ?? 1,
        selected: true, // pré-sélectionné
      });
    } else {
      // Nouveau produit — pas dans le stock
      matches.push({
        receiptLabel: item.label,
        receiptAmount: item.amount,
        stockItem: null,
        qtyToAdd: 1,
        selected: false, // pas pré-sélectionné (l'utilisateur décide)
        suggestedEmplacement: suggestEmplacement(item.category),
      });
    }
  }

  return matches;
}
