/**
 * recipe-import.ts — Import recipes from URLs, text, community
 *
 * Stratégie URL:
 * 1. cook.md — envoie l'URL, poll le .cook (meilleure qualité, LLM)
 * 2. Fallback IA — fetch HTML, extraction texte, conversion via Claude API
 *
 * Stratégie texte:
 * - IA: Claude API convertit le texte brut en .cook
 * - Fallback local: heuristiques regex (sans clé API)
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import type { AIConfig } from './ai-service';

declare const __DEV__: boolean;

/** Result from cook.md or AI: raw .cook file content */
export interface CookImportResult {
  cookContent: string;
  title: string;
  category?: string;
  /** URL de l'image de couverture extraite de la page source */
  imageUrl?: string;
}

/** Result from local heuristic fallback: structured data needing conversion */
export interface ImportedRecipe {
  title: string;
  servings?: number;
  prepTime?: string;
  cookTime?: string;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  sourceUrl: string;
}

export type ImportResult =
  | { type: 'cook'; data: CookImportResult }
  | { type: 'parsed'; data: ImportedRecipe };

// ─── cook.md integration ──────────────────────────────────────────────────

const COOK_MD_TIMEOUT = 90_000;
const COOK_MD_POLL_INTERVAL = 3_000;

async function submitToCookMd(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://cook.md/${url}`);
    const resUrl = res.url || '';
    const urlMatch = resUrl.match(/cookifies\/([a-f0-9-]+)/i);
    if (urlMatch) return urlMatch[1];
    if (res.ok) {
      const body = await res.text();
      const bodyMatch = body.match(/cookifies\/([a-f0-9-]+)/i);
      if (bodyMatch) return bodyMatch[1];
    }
    return null;
  } catch (e) {
    if (__DEV__) console.log('[recipe-import] cook.md submit error:', e);
    return null;
  }
}

function parseCookMetadata(content: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return meta;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.substring(0, idx).trim().toLowerCase();
      const value = line.substring(idx + 1).trim();
      if (key && value) meta[key] = value;
    }
  }
  return meta;
}

async function pollCookMd(uuid: string): Promise<CookImportResult | null> {
  const downloadUrl = `https://cook.md/cookifies/${uuid}/download`;
  const start = Date.now();

  while (Date.now() - start < COOK_MD_TIMEOUT) {
    try {
      const res = await fetch(downloadUrl);
      if (__DEV__) console.log('[recipe-import] poll status:', res.status, 'elapsed:', Math.round((Date.now() - start) / 1000), 's');
      if (res.status === 404) {
        await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
        continue;
      }
      if (res.ok) {
        const body = await res.text();
        if (body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')) {
          await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
          continue;
        }
        if ((body.includes('---') || body.includes('>>')) && body.length > 50) {
          const meta = parseCookMetadata(body);
          return {
            cookContent: body,
            title: meta.title || 'Recette importée',
            category: meta.course || meta.cuisine || undefined,
          };
        }
      }
      await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
    } catch (e) {
      if (__DEV__) console.log('[recipe-import] poll error:', e);
      await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
    }
  }
  return null;
}

async function importViaCookMd(url: string, onStatus?: (msg: string) => void): Promise<CookImportResult | null> {
  onStatus?.('Envoi à cook.md…');
  const uuid = await submitToCookMd(url);
  if (!uuid) {
    if (__DEV__) console.log('[recipe-import] cook.md: no UUID from redirect');
    return null;
  }
  onStatus?.('Conversion en cours…');
  return pollCookMd(uuid);
}

// ─── AI-powered conversion ────────────────────────────────────────────────

const AI_API_URL = 'https://api.anthropic.com/v1/messages';
const AI_API_VERSION = '2023-06-01';

const COOK_SYSTEM_PROMPT = `Tu es un convertisseur de recettes au format Cooklang (.cook).
Convertis le contenu fourni en fichier .cook valide.

Format attendu :
>> title: Nom de la recette
>> servings: 4
>> prep time: 15 min
>> cook time: 30 min

Étape 1 avec @ingrédient{quantité%unité} et ~ustensile{}.

Étape 2…

Règles :
- Syntaxe Cooklang : @ingredient{qty%unit}, ~equipment{}, #timer{duration%unit}
- Metadata avec >> key: value
- Une ligne vide entre chaque étape
- Unités en métrique (g, kg, ml, cl, L)
- Réponds UNIQUEMENT avec le fichier .cook, sans explication ni commentaire
- Si le contenu n'est clairement pas une recette, réponds exactement : NOT_A_RECIPE`;

/** Strip HTML to plain text for AI processing */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Call Claude API to convert content to .cook */
async function convertToCookWithAI(
  content: string,
  config: AIConfig,
  sourceType: 'html' | 'text',
): Promise<CookImportResult> {
  const truncated = content.length > 12000 ? content.substring(0, 12000) + '\n[…tronqué]' : content;

  const userMsg = sourceType === 'html'
    ? `Convertis cette page web de recette en .cook :\n\n${truncated}`
    : `Convertis ce texte de recette en .cook :\n\n${truncated}`;

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': AI_API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: COOK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Clé API invalide. Vérifiez dans les réglages.');
    if (response.status === 429) throw new Error('Trop de requêtes IA. Réessayez dans un moment.');
    throw new Error(`Erreur API IA (${response.status})`);
  }

  const data = await response.json();
  const cookContent = (data.content?.[0]?.text ?? '').trim();

  if (!cookContent || cookContent === 'NOT_A_RECIPE') {
    throw new Error('Le contenu ne semble pas être une recette.');
  }

  const titleMatch = cookContent.match(/^>> title:\s*(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Recette importée';

  return { cookContent, title };
}

// ─── Cook content cleanup ─────────────────────────────────────────────────

/**
 * Nettoie le contenu .cook importé :
 * - Supprime les tags de blog (lignes courtes type "Aout", "Aout 2018", "Pâtes")
 * - Supprime les descriptions/intro avant les vraies étapes
 * - Garde uniquement les metadata (>> / ---) et les étapes avec ingrédients
 */
export function cleanCookContent(raw: string): { content: string; imageUrl?: string } {
  // Séparer frontmatter YAML et corps
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let metaLines: string[] = [];
  let bodyText: string;
  let imageUrl: string | undefined;

  if (fmMatch) {
    // Convertir frontmatter YAML en >> metadata (whitelist)
    for (const line of fmMatch[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.substring(0, idx).trim().toLowerCase();
        const value = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!key || !value) continue;
        if (key === 'image') {
          // Garder l'URL pour le téléchargement, pas dans les metadata >>
          imageUrl = value;
          continue;
        }
        if (!isUsefulMetaKey(key)) continue;
        if (key === 'tags') {
          const cleaned = cleanTags(value);
          if (cleaned) metaLines.push(`>> tags: ${cleaned}`);
        } else {
          metaLines.push(`>> ${key}: ${value}`);
        }
      }
    }
    bodyText = fmMatch[2];
  } else {
    // Extraire les >> metadata du corps
    const lines = raw.split('\n');
    const body: string[] = [];
    for (const line of lines) {
      if (/^>>\s*.+:\s*.+/.test(line)) {
        const key = line.match(/^>>\s*(.+?):/)?.[1]?.trim().toLowerCase() || '';
        if (key === 'image') {
          imageUrl = line.match(/^>>\s*image:\s*(.+)/i)?.[1]?.trim();
          continue;
        }
        if (isUsefulMetaKey(key)) {
          if (key === 'tags') {
            const val = line.match(/^>>\s*tags:\s*(.+)/i)?.[1] || '';
            const cleaned = cleanTags(val);
            if (cleaned) body.push(`>> tags: ${cleaned}`);
          } else {
            metaLines.push(line);
          }
        }
      } else {
        body.push(line);
      }
    }
    bodyText = body.join('\n');
  }

  // Nettoyer le corps : garder les lignes qui sont des étapes de recette
  const bodyLines = bodyText.split('\n');
  const cleaned: string[] = [];
  let foundStep = false;

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (foundStep) cleaned.push('');
      continue;
    }
    // Ligne trop courte sans syntaxe cooklang = probablement un tag ou titre parasite
    if (!foundStep && trimmed.length < 40 && !trimmed.includes('@') && !trimmed.includes('#') && !trimmed.includes('~')) {
      continue;
    }
    // Lignes avec syntaxe cooklang = étape valide
    if (trimmed.includes('@') || trimmed.includes('#') || trimmed.includes('~') || trimmed.length >= 40) {
      foundStep = true;
      cleaned.push(line);
    } else if (foundStep) {
      cleaned.push(line);
    }
  }

  // Reconstruire
  const result = [...metaLines, '', ...cleaned].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { content: result + '\n', imageUrl };
}

/** Clés de metadata utiles — tout le reste est ignoré */
function isUsefulMetaKey(key: string): boolean {
  const keep = ['title', 'servings', 'portions', 'prep time', 'preptime', 'cook time', 'cooktime', 'cuisson', 'tags', 'image'];
  return keep.includes(key);
}

/** Nettoyer les tags : garder uniquement les tags culinaires, pas les dates/mois de blog */
function cleanTags(tagsStr: string): string {
  const RE_MONTH_DATE = /^(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?$/i;
  const RE_YEAR = /^\d{4}$/;
  const RE_PREF = /^recettes?\s+préférées?\s*\d*$/i;
  const cleaned = tagsStr.split(',')
    .map(t => t.trim())
    .filter(t => t && !RE_MONTH_DATE.test(t) && !RE_YEAR.test(t) && !RE_PREF.test(t));
  return cleaned.join(', ');
}

// ─── Image extraction from HTML ───────────────────────────────────────────

/** Extraire l'URL de l'image principale depuis le HTML (og:image, JSON-LD, twitter:image) */
function extractImageUrl(html: string, baseUrl: string): string | undefined {
  // 1. Open Graph og:image (2 ordres possibles des attributs)
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], baseUrl);

  // 2. Schema.org JSON-LD image
  const ldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      const img = ld.image || ld.thumbnailUrl;
      if (typeof img === 'string') return resolveUrl(img, baseUrl);
      if (Array.isArray(img) && img.length > 0) {
        const first = typeof img[0] === 'string' ? img[0] : img[0]?.url;
        if (first) return resolveUrl(first, baseUrl);
      }
      if (img?.url) return resolveUrl(img.url, baseUrl);
    } catch { /* JSON-LD malformé */ }
  }

  // 3. twitter:image
  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (twitterMatch?.[1]) return resolveUrl(twitterMatch[1], baseUrl);

  return undefined;
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try { return new URL(url, baseUrl).toString(); } catch { return url; }
}

/** Extraire l'image depuis une URL de page web (fetch séparé) */
export async function fetchRecipeImageUrl(pageUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) return undefined;
    const html = await res.text();
    return extractImageUrl(html, pageUrl);
  } catch {
    return undefined;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Import a recipe from a URL.
 * 1. cook.md (best quality — LLM-powered cooklang conversion)
 * 2. Fallback IA: fetch HTML → Claude API → .cook
 */
export async function importRecipeFromUrl(
  url: string,
  onStatus?: (msg: string) => void,
  aiConfig?: AIConfig | null,
): Promise<ImportResult> {
  // 1. Try cook.md
  onStatus?.('Envoi à cook.md…');
  const cookResult = await importViaCookMd(url, onStatus);
  if (cookResult) {
    if (__DEV__) console.log('[recipe-import] cook.md success:', cookResult.title);
    // Extraire l'image depuis la page source (fetch séparé car cook.md ne retourne pas d'image)
    try {
      cookResult.imageUrl = await fetchRecipeImageUrl(url);
      if (__DEV__ && cookResult.imageUrl) console.log('[recipe-import] image found:', cookResult.imageUrl);
    } catch { /* pas grave si on n'arrive pas à récupérer l'image */ }
    return { type: 'cook', data: cookResult };
  }

  // 2. Fallback: fetch HTML + AI conversion
  if (aiConfig) {
    onStatus?.('Conversion IA en cours…');
    try {
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        const imageUrl = extractImageUrl(html, url);
        const plainText = htmlToPlainText(html);
        if (__DEV__) console.log('[recipe-import] HTML→text length:', plainText.length);
        const result = await convertToCookWithAI(plainText, aiConfig, 'html');
        result.imageUrl = imageUrl;
        return { type: 'cook', data: result };
      }
    } catch (e) {
      if (__DEV__) console.log('[recipe-import] AI fallback error:', e);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(
    aiConfig
      ? 'Impossible d\'extraire la recette depuis cette URL.'
      : 'cook.md n\'a pas pu convertir cette recette. Configurez l\'IA (réglages) pour activer la conversion automatique.',
  );
}

/**
 * Convert raw text to .cook via Claude API.
 * Requires AI config.
 */
export async function convertTextWithAI(
  rawText: string,
  aiConfig: AIConfig,
): Promise<ImportResult> {
  const result = await convertToCookWithAI(rawText, aiConfig, 'text');
  return { type: 'cook', data: result };
}

// ─── Community recipes (cooklang.org) ─────────────────────────────────────

export interface CommunityRecipe {
  id: number;
  title: string;
  tags: string[];
  url: string;
}

const COOKLANG_BASE = 'https://recipes.cooklang.org';

export async function searchCommunityRecipes(query: string): Promise<CommunityRecipe[]> {
  const url = `${COOKLANG_BASE}/?q=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const html = await res.text();
  return parseCommunitySearchResults(html);
}

function parseCommunitySearchResults(html: string): CommunityRecipe[] {
  const results: CommunityRecipe[] = [];
  const seen = new Set<number>();
  const parts = html.split(/<a\s+href="\/recipes\//i);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const idMatch = part.match(/^(\d+)"/);
    if (!idMatch) continue;
    const id = parseInt(idMatch[1], 10);
    if (seen.has(id)) continue;
    seen.add(id);

    const h3Match = part.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    const title = h3Match ? h3Match[1].trim() : '';
    if (!title) continue;

    const tags: string[] = [];
    const tagRegex = /rounded-full"[^>]*>([^<]+)</g;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(part)) !== null) {
      const tag = tagMatch[1].trim();
      if (tag && tag.length < 40) tags.push(tag);
    }

    results.push({ id, title, tags, url: `${COOKLANG_BASE}/recipes/${id}` });
  }
  return results;
}

/**
 * Fetch with retry on 429 (rate limit).
 * 3 tentatives avec backoff exponentiel.
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status !== 429) return res;
      // 429 — attendre avant de réessayer
      const delay = (attempt + 1) * 2000; // 2s, 4s, 6s
      if (__DEV__) console.log(`[recipe-import] 429, retry in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
  }
  throw lastError || new Error('Trop de requêtes (429). Réessayez dans quelques minutes.');
}

export async function downloadCommunityRecipe(id: number): Promise<string> {
  const url = `${COOKLANG_BASE}/api/recipes/${id}/download`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Erreur téléchargement (${res.status})`);
  const content = await res.text();
  if (!content || content.length < 10) throw new Error('Fichier .cook vide');
  if (content.trimStart().startsWith('<!DOCTYPE') || content.trimStart().startsWith('<html')) {
    throw new Error('Le serveur a retourné une page HTML au lieu du fichier .cook');
  }
  return content;
}

const TRANSLATE_SYSTEM_PROMPT = `Tu traduis des recettes au format Cooklang (.cook) de l'anglais vers le français.

Règles :
- Traduis le texte (titres, étapes, noms d'ingrédients, metadata) en français naturel
- Conserve EXACTEMENT la syntaxe Cooklang : @ingredient{qty%unit}, ~equipment{}, #timer{duration%unit}, >> key: value
- Ne change PAS les quantités ni les unités
- Garde les lignes vides entre étapes
- Réponds UNIQUEMENT avec le fichier .cook traduit, sans explication`;

/**
 * Traduit un fichier .cook anglais en français via Haiku (très bon marché).
 * Retourne le contenu original si pas de config IA ou en cas d'erreur.
 */
export async function translateCookToFrench(
  cookContent: string,
  aiConfig?: AIConfig | null,
): Promise<string> {
  if (!aiConfig) return cookContent;

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiConfig.apiKey,
        'anthropic-version': AI_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: TRANSLATE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: cookContent }],
      }),
    });

    if (!response.ok) return cookContent;

    const data = await response.json();
    const translated = data?.content?.[0]?.text?.trim();
    return translated && translated.length > 10 ? translated : cookContent;
  } catch {
    return cookContent;
  }
}

// ─── Photo → recette (Vision) ─────────────────────────────────────────────

/**
 * Import une recette depuis une photo (screenshot Instagram, livre, etc.)
 * Pipeline : picker → optimise → base64 → Claude Vision → .cook
 */
export async function importRecipeFromPhoto(
  aiConfig: AIConfig,
  onStatus?: (msg: string) => void,
): Promise<ImportResult | null> {
  // 1. Picker image
  onStatus?.('Sélection de la photo…');
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission d\'accès aux photos refusée.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 5,
  });

  if (result.canceled || !result.assets?.length) return null;
  const assets = result.assets;

  const optimizedUris: string[] = [];
  try {
    // 2. Optimiser chaque image (HEIC→JPEG + resize)
    onStatus?.(`Optimisation de ${assets.length} image${assets.length > 1 ? 's' : ''}…`);
    const maxWidth = 1568;
    const base64Images: string[] = [];

    for (const asset of assets) {
      const actions: ImageManipulator.Action[] = [];
      if ((asset.width ?? 0) > maxWidth) {
        actions.push({ resize: { width: maxWidth } });
      }
      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      optimizedUris.push(manipulated.uri);

      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      base64Images.push(base64);
    }

    if (__DEV__) console.log('[recipe-import] Photos base64 prêts:', base64Images.length, 'images, total:', Math.round(base64Images.reduce((s, b) => s + b.length, 0) / 1024), 'KB');

    // 3. Construire les content blocks pour Claude Vision
    onStatus?.('Extraction de la recette…');
    const imageBlocks = base64Images.map(b64 => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: b64 },
    }));

    const textPrompt = base64Images.length > 1
      ? `Ces ${base64Images.length} photos montrent différentes parties d'une même recette (ingrédients, étapes, etc.). Combine toutes les informations en un seul fichier .cook complet.`
      : 'Extrais la recette de cette image et convertis-la en fichier .cook.';

    const content = [...imageBlocks, { type: 'text' as const, text: textPrompt }];

    // 4. Envoyer à Claude Vision
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiConfig.apiKey,
        'anthropic-version': AI_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: COOK_SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Clé API invalide. Vérifiez dans les réglages.');
      if (response.status === 429) throw new Error('Trop de requêtes IA. Réessayez dans un moment.');
      throw new Error(`Erreur API IA (${response.status})`);
    }

    const data = await response.json();
    const cookContent = (data.content?.[0]?.text ?? '').trim();

    if (!cookContent || cookContent === 'NOT_A_RECIPE') {
      throw new Error(base64Images.length > 1
        ? 'Les images ne semblent pas contenir une recette.'
        : 'L\'image ne semble pas contenir une recette.');
    }

    const titleMatch = cookContent.match(/^>> title:\s*(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Recette importée';

    return { type: 'cook', data: { cookContent, title } };
  } finally {
    // Nettoyer TOUS les fichiers temporaires
    for (const uri of optimizedUris) {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
}

// ─── Text-to-recipe local fallback (sans IA) ─────────────────────────────

/**
 * Parse raw text into a recipe using heuristics.
 * Fallback quand l'IA n'est pas configurée.
 */
export function parseTextToRecipe(rawText: string): ImportResult {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Le texte est vide.');

  let titleIndex = 0;
  const firstThree = lines.slice(0, 3);
  const shortest = firstThree.reduce((best, line, i) =>
    line.length < firstThree[best].length ? i : best, 0);
  if (firstThree[shortest].length < 60) titleIndex = shortest;
  const title = lines[titleIndex]
    .replace(/^#+\s*/, '')
    .replace(/^recette\s*:\s*/i, '')
    .trim();

  const remaining = lines.filter((_, i) => i !== titleIndex);

  const RE_INGREDIENT = /^[-•*·]\s+.+|^\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|dl|l|cs|cc|c\.\s*à\s*[sc]\.?|càs|càc|tbsp|tsp|tasse|pincée|sachet|tranche|gousse|botte|paquet|boîte|feuille|brin)\s+/i;
  const RE_NUMBERED_STEP = /^(?:\d+[\.\)]\s*|étape\s+\d+\s*[:\-]\s*)/i;
  const RE_SECTION_HEADER = /^(?:ingrédients?|étapes?|préparation|instructions?|pour\s+\d+|matériel)\s*:?\s*$/i;
  const RE_SERVINGS = /(?:pour\s+)?(\d+)\s*(?:personnes?|portions?|parts?|pers\.?)/i;
  const RE_PREP_TIME = /(?:préparation|prep)\s*:?\s*(\d+\s*(?:min|minutes?|h|heures?))/i;
  const RE_COOK_TIME = /(?:cuisson|cook)\s*:?\s*(\d+\s*(?:min|minutes?|h|heures?))/i;

  const ingredients: string[] = [];
  const steps: string[] = [];
  let servings: number | undefined;
  let prepTime = '';
  let cookTime = '';

  for (const line of remaining) {
    const sm = line.match(RE_SERVINGS);
    if (sm && !servings) servings = parseInt(sm[1], 10);
    const pm = line.match(RE_PREP_TIME);
    if (pm && !prepTime) prepTime = pm[1];
    const cm = line.match(RE_COOK_TIME);
    if (cm && !cookTime) cookTime = cm[1];
  }

  let mode: 'auto' | 'ingredients' | 'steps' = 'auto';

  for (const line of remaining) {
    if (RE_SECTION_HEADER.test(line)) {
      if (/ingrédients?/i.test(line)) mode = 'ingredients';
      else if (/étapes?|préparation|instructions?/i.test(line)) mode = 'steps';
      continue;
    }

    if (RE_SERVINGS.test(line) && !RE_INGREDIENT.test(line) && line.length < 40) continue;
    if (RE_PREP_TIME.test(line) && line.length < 40) continue;
    if (RE_COOK_TIME.test(line) && line.length < 40) continue;

    if (mode === 'ingredients') {
      const cleaned = line.replace(/^[-•*·]\s+/, '').trim();
      if (cleaned) ingredients.push(cleaned);
    } else if (mode === 'steps') {
      const cleaned = line.replace(RE_NUMBERED_STEP, '').trim();
      if (cleaned) steps.push(cleaned);
    } else {
      if (RE_INGREDIENT.test(line)) {
        ingredients.push(line.replace(/^[-•*·]\s+/, '').trim());
      } else if (RE_NUMBERED_STEP.test(line)) {
        const cleaned = line.replace(RE_NUMBERED_STEP, '').trim();
        if (cleaned) steps.push(cleaned);
      } else if (line.length > 80) {
        steps.push(line);
      } else if (line.length < 50 && /\d/.test(line)) {
        ingredients.push(line.replace(/^[-•*·]\s+/, '').trim());
      } else {
        if (ingredients.length > 0) {
          steps.push(line);
        } else {
          ingredients.push(line.replace(/^[-•*·]\s+/, '').trim());
        }
      }
    }
  }

  if (steps.length === 0 && ingredients.length > 2) {
    const longOnes = ingredients.filter(l => l.length > 60);
    if (longOnes.length > 0) {
      const kept: string[] = [];
      for (const ing of ingredients) {
        if (ing.length > 60) steps.push(ing);
        else kept.push(ing);
      }
      ingredients.length = 0;
      ingredients.push(...kept);
    }
  }

  if (ingredients.length === 0 && steps.length === 0) {
    throw new Error('Impossible de détecter les ingrédients ou les étapes dans ce texte.');
  }

  return {
    type: 'parsed',
    data: { title, servings, prepTime, cookTime, ingredients, steps, sourceUrl: '' },
  };
}
