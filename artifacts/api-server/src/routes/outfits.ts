import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, savedOutfitsTable, outfitItemsTable, clothingItemsTable } from "@workspace/db";
import {
  SaveOutfitBody,
  DeleteOutfitParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outfits", async (req, res): Promise<void> => {
  const outfits = await db
    .select()
    .from(savedOutfitsTable)
    .orderBy(savedOutfitsTable.createdAt);

  // For each outfit, fetch its items
  const outfitItems = await db.select().from(outfitItemsTable);
  const clothingItems = await db.select().from(clothingItemsTable);

  const result = outfits.map((outfit) => {
    const itemIds = outfitItems
      .filter((oi) => oi.outfitId === outfit.id)
      .map((oi) => oi.clothingItemId);

    const items = clothingItems.filter((ci) => itemIds.includes(ci.id));

    return {
      ...outfit,
      itemIds,
      items,
    };
  });

  res.json(result);
});

router.post("/outfits", async (req, res): Promise<void> => {
  const parsed = SaveOutfitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [outfit] = await db
    .insert(savedOutfitsTable)
    .values({
      name: parsed.data.name,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  // Insert outfit items
  if (parsed.data.itemIds.length > 0) {
    await db.insert(outfitItemsTable).values(
      parsed.data.itemIds.map((clothingItemId) => ({
        outfitId: outfit.id,
        clothingItemId,
      }))
    );
  }

  const savedItems = parsed.data.itemIds.length > 0
    ? await db
        .select()
        .from(clothingItemsTable)
        .where(inArray(clothingItemsTable.id, parsed.data.itemIds))
    : [];

  res.status(201).json({
    ...outfit,
    itemIds: parsed.data.itemIds,
    items: savedItems,
  });
});

router.delete("/outfits/:id", async (req, res): Promise<void> => {
  const params = DeleteOutfitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Remove associated items first
  await db
    .delete(outfitItemsTable)
    .where(eq(outfitItemsTable.outfitId, params.data.id));

  const [deleted] = await db
    .delete(savedOutfitsTable)
    .where(eq(savedOutfitsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Outfit not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
