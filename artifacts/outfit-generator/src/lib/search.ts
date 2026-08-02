/**
 * search — ranked full-text search across wardrobe items and lookbook groups.
 *
 * Scoring (higher = more relevant):
 *   name / brand           10
 *   category / color       5
 *   size / season /
 *   occasion / price / date  3
 *   notes                  3
 *   visionText             2
 *   visionLabels           1
 *
 * Group scoring:
 *   group name             10
 *   group notes             5
 *   item inside matches     2  (bonus, not listed separately)
 *
 * Results are deduped by id. Items appear in section 1, groups in section 2.
 */

import type { ClothingItem, SavedOutfit } from "./db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function tokenMatches(haystack: string, needle: string): boolean {
  return haystack.includes(needle);
}

function scoreString(
  value: string | null | undefined,
  needle: string,
  weight: number,
): number {
  const h = normalize(value);
  if (!h || !tokenMatches(h, needle)) return 0;
  // Boost for word-boundary matches (starts with or is the whole word)
  const bonus = h.startsWith(needle) || h === needle ? weight * 0.5 : 0;
  return weight + bonus;
}

function scoreList(
  values: string[] | null | undefined,
  needle: string,
  weight: number,
): number {
  if (!values?.length) return 0;
  const joined = values.map(normalize).join(" ");
  return tokenMatches(joined, needle) ? weight : 0;
}

// ── Item scoring ──────────────────────────────────────────────────────────────

export function scoreItem(item: ClothingItem, needle: string): number {
  let score = 0;
  score += scoreString(item.name,          needle, 10);
  score += scoreString(item.brand,         needle, 10);
  score += scoreString(item.color,         needle,  5);
  score += scoreString(item.category,      needle,  5);
  score += scoreString(item.size,          needle,  3);
  score += scoreString(item.season,        needle,  3);
  score += scoreString(item.occasion,      needle,  3);
  score += scoreString(item.purchasePrice, needle,  3);
  score += scoreString(item.purchaseDate,  needle,  3);
  score += scoreString(item.notes,         needle,  3);
  score += scoreList(item.visionText,      needle,  2);
  score += scoreList(item.visionLabels,    needle,  1);
  return score;
}

// ── Group scoring ─────────────────────────────────────────────────────────────

export function scoreGroup(
  outfit: SavedOutfit,
  needle: string,
  itemScores: Map<number, number>,
): number {
  let score = 0;
  score += scoreString(outfit.name,  needle, 10);
  score += scoreString(outfit.notes, needle,  5);

  // Bonus if any contained item matches
  for (const item of outfit.items) {
    const s = itemScores.get(item.id) ?? scoreItem(item, needle);
    if (s > 0) { score += 2; break; } // single bonus
  }
  return score;
}

// ── Public search function ────────────────────────────────────────────────────

export interface SearchResults {
  items:  ClothingItem[];
  groups: SavedOutfit[];
}

export function search(
  query: string,
  allItems: ClothingItem[],
  allGroups: SavedOutfit[],
): SearchResults {
  const needle = query.toLowerCase().trim();
  if (!needle) return { items: [], groups: [] };

  // Score every item once and cache
  const itemScores = new Map<number, number>();
  for (const item of allItems) {
    const s = scoreItem(item, needle);
    if (s > 0) itemScores.set(item.id, s);
  }

  const matchedItems = [...itemScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allItems.find((i) => i.id === id)!)
    .filter(Boolean);

  const groupScores = new Map<number, number>();
  for (const group of allGroups) {
    const s = scoreGroup(group, needle, itemScores);
    if (s > 0) groupScores.set(group.id, s);
  }

  const matchedGroups = [...groupScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allGroups.find((g) => g.id === id)!)
    .filter(Boolean);

  return { items: matchedItems, groups: matchedGroups };
}
