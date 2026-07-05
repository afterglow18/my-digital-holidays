---
name: Wardrobe image layout strategy
description: How the closet background image is sized and overlays are positioned on the wardrobe page
---

## Current image

`/closet-bg.png` — 853×1844 PNG (user-supplied, 3 baked-in placeholder cards per row).

## Sizing strategy

`object-fit: CONTAIN` inside `calc(100dvh − 90px)` container.

Image ratio 853/1844 ≈ 0.4626.
Container ratio on iPhone 390×754 ≈ 0.517 → container wider → image fills HEIGHT.

| Device | rW (px) | rL each side |
|---|---|---|
| iPhone SE  375×577 | 267 | 54 px |
| iPhone 390 ×754   | 349 | 21 px |
| iPhone Max 430×842| 390 | 20 px |

Container background `#F0C030` — side letterbox blends with yellow door colour.

## Overlay philosophy

The PNG already has all visual UI baked in. HTML provides:
- **Transparent tap zones** over every baked-in button
- **ClosetRow** (no background) rendered over the **rectangular dotted box area only**
- **Empty slots**: image's dashed placeholder cards show through (ClosetRow is transparent)
- **Image hangers**: baked-in gold hanger graphics sit ABOVE the ClosetRow container and are always visible — ClosetRow renders NO HTML hanger

## ClosetRow component

`src/components/ClosetRow.tsx` — fixed 3-slot carousel, no hanger rendering.

Behaviour:
- Divides its container into 3 equal slots (left / center / right), `overflow:hidden`
- Card fills the **FULL slot width** (`cardW = slotW`, `padX = 0`) for pixel-perfect horizontal alignment with the dotted boxes
- Card fills the **full container height** (= the rectangular dotted box, below the image's hanger)
- `borderRadius: "10px"` all corners — matches the placeholder box shape
- Selected item: 4.5px blush-pink border + outer glow; unselected: 1.5px warm-gold hairline
- Border/shadow always transition (0.24s ease) so the highlight glides to the new card on swipe
- `hasDragged` ref prevents synthetic click triggering after a drag
- Tracks last-notified item **ID** (not index) for accurate parent `centred` map
- No `hangerH` prop — hanger concept was removed entirely

**Why cardW = slotW (not * 0.88):** Using 88% width left ~5px side gaps that exposed the image's dotted border — didn't match the annotation requirement of zero side gap. Full slotW eliminates the gap without affecting swipe/snap logic (which is slot-based).

## Landmark fractions (853×1844 PNG, pixel-scanned via ImageMagick)

```
doorL:   0.110   // inner left edge of closet
doorR:   0.890   // inner right edge of closet

rows[0] TOPS:    { btnCY: 0.278, boxY: 0.313, boxBot: 0.471 }
rows[1] BOTTOMS: { btnCY: 0.480, boxY: 0.515, boxBot: 0.670 }
rows[2] SHOES:   { btnCY: 0.685, boxY: 0.715, boxBot: 0.857 }

// boxY  = TOP of the dotted placeholder rectangle = where cream starts in the image.
//         Image cream-start scans: TOPS y=578 f=0.313, BOTTOMS y=950 f=0.515, SHOES y=1318 f=0.715.
//         CARD BACKGROUND IS TRANSPARENT — hanger shows through in the un-photo'd area.
//         Cards fill the FULL dotted box (including hanger area). Hanger is only visible
//         in EMPTY slots where no card is rendered.
//         NO internal padding on the card — objectFit:contain fills the full box.
//         Do NOT try to clear the hanger by raising boxY; that breaks box alignment.
// boxBot = fraction where cream interior ends (pixel-scanned).

barY:     0.863
barBot:   0.928
hangerCX: 0.140
saveBtnL: 0.228
saveBtnR: 0.772
manneCX:  0.860
```

## ClosetRow container positioning (wardrobe.tsx)

```
top:    pY(ir, lm.boxY)                          // = ir.top + ir.height * boxY
height: pH(ir, lm.boxBot - lm.boxY)
left:   pX(ir, LM.doorL)
right:  ir.left + pW(ir, 1 - LM.doorR)
overflow: hidden
// NO background — transparent, image placeholder cards show through empty slots
// Image's gold hanger graphics are ABOVE this container (boxY is below the hanger)
```

**Why boxY not carY:** Original `carY` landed inside the hanger graphic area; adding a hangerH offset inside ClosetRow compounded the misalignment. The fix was to measure `boxY` = exact bottom of the hanger graphic, position ClosetRow there, and remove hangerH entirely.

**How to re-calibrate if the image changes:** Run ImageMagick dense vertical scans at 5 sample x-positions spanning doorL→doorR (e.g. x=160,220,280,370,430). Find the y range where ≥4/5 sample points return r>240, g>215, b>195. The transition INTO that range = boxY; the transition OUT = boxBot. Convert y→fraction by dividing by image height (1844).

**Why ClosetRow over SwipeRow:** SwipeRow overflows the closet bounds; ClosetRow is pinned to the 3-slot box with overflow:hidden.
