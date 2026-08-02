/**
 * Local IndexedDB database for My Digital Holidays.
 *
 * Works in both the browser (Replit preview) and in the Capacitor iOS WebView —
 * IndexedDB is natively available in both environments and persists to the
 * app's sandboxed storage on-device.
 *
 * Schema v1:
 *   clothing_items  — wardrobe items with embedded image data URLs
 *   saved_outfits   — named outfit collections
 *   outfit_items    — junction: outfit ↔ clothing item
 *   settings        — key/value store for app preferences
 *
 * Schema v2 (additive migration — no data loss):
 *   clothing_items  — adds visionLabels, visionText, visionVersion for photo search
 */

import { openDB, type IDBPDatabase } from "idb";

export const DB_NAME    = "my-digital-suitcase";
export const DB_VERSION = 2;

// ── Stored types (IndexedDB records) ─────────────────────────────────────────

export interface StoredClothingItem {
  id?:                   number;        // auto-incremented
  name:                  string;
  category:              string;        // "outfits" | "beauty" | "toiletries" | "essentials"
  imageObjectPath:       string | null; // JPEG/PNG data URL
  isFavorite:            boolean;
  timesWorn:             number;
  isBackgroundRemoved?:  boolean;       // true once the Clean Up Photo flow has been saved
  color?:                string | null;
  brand?:                string | null;
  size?:                 string | null;
  season?:               string | null;
  occasion?:             string | null;
  purchasePrice?:        string | null;
  purchaseDate?:         string | null;
  notes?:                string | null;
  createdAt:             string;
  updatedAt:             string;
  // ── v2: photo search ──────────────────────────────────────────────────────
  // visionVersion: 0=unanalyzed, 1=iOS Vision ok, 4=web canvas ok, 5=web/no labels
  visionLabels?:         string[];      // color/object labels from photo analysis
  visionText?:           string[];      // text detected inside the photo
  visionVersion?:        number;        // analysis version for re-run decisions
}

export interface StoredOutfit {
  id?:       number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
}

export interface StoredOutfitItem {
  id?:             number;
  outfitId:        number;
  clothingItemId:  number;
}

export interface StoredSetting {
  key:   string;
  value: string;
}

// ── Public types (consumed by hooks and pages) ────────────────────────────────

export interface ClothingItem extends Required<StoredClothingItem> {
  id: number;
}

export interface SavedOutfit {
  id:        number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
  items:     ClothingItem[];
}

// ── Singleton DB connection ───────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── v1 schema (unchanged) ─────────────────────────────────────────────
      if (oldVersion < 1) {
        // clothing_items
        const store = db.createObjectStore("clothing_items", {
          keyPath:       "id",
          autoIncrement: true,
        });
        store.createIndex("by_category", "category");
        store.createIndex("by_favorite", "isFavorite");

        // saved_outfits
        db.createObjectStore("saved_outfits", {
          keyPath:       "id",
          autoIncrement: true,
        });

        // outfit_items
        const oi = db.createObjectStore("outfit_items", {
          keyPath:       "id",
          autoIncrement: true,
        });
        oi.createIndex("by_outfit", "outfitId");
        oi.createIndex("by_item",   "clothingItemId");

        // settings
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // ── v2 migration: purely additive ─────────────────────────────────────
      // visionLabels/visionText/visionVersion default to undefined on existing
      // records — the indexer treats undefined as visionVersion=0 (unanalyzed).
      // No structural changes needed; IndexedDB object stores are schema-less.
      if (oldVersion < 2) {
        // Ensure store exists for upgrades from existing v1 DBs
        if (!db.objectStoreNames.contains("clothing_items")) {
          const store = db.createObjectStore("clothing_items", {
            keyPath:       "id",
            autoIncrement: true,
          });
          store.createIndex("by_category", "category");
          store.createIndex("by_favorite", "isFavorite");
        }
        if (!db.objectStoreNames.contains("saved_outfits")) {
          db.createObjectStore("saved_outfits", {
            keyPath:       "id",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains("outfit_items")) {
          const oi = db.createObjectStore("outfit_items", {
            keyPath:       "id",
            autoIncrement: true,
          });
          oi.createIndex("by_outfit", "outfitId");
          oi.createIndex("by_item",   "clothingItemId");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      }
    },

    blocked() {
      console.warn("[DB] Upgrade blocked — close other tabs");
    },

    blocking() {
      _db?.close();
      _db = null;
    },
  });

  return _db;
}
