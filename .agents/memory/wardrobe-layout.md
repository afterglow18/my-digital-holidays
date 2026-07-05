---
name: Wardrobe layout strategy
description: Background image sizing, landmark fractions, ClosetRow contract, and hanger overlay technique for the My Digital Closet app.
---

## Background image

**Current file:** `artifacts/outfit-generator/public/closet-bg.png`
**Dimensions:** 1023×1537 px (aspect ratio 0.6657 — wider than tall relative to portrait phones)

**Rendering:** `object-fit: contain` inside a container of `min(calc(100dvh - 90px), calc(100vw * 1.5025))`.
- On portrait phones (e.g. 390×844): image fills width (390×586 px), container exactly matches → no letterbox.
- On wide screens: image fills height with small side letterbox.
- Container background `#F0C030` (door yellow) blends with the yellow doors.
- `useImageRect`: if `cR > iR` → fill height, side letterbox (`rT=0`); else → fill width, `rT=0` (image anchored to top).

## Landmark fractions (1023×1537 image)

All fractions are of the **image's own width/height**, applied via `pX/pY/pW/pH` helpers in `wardrobe.tsx`.

```
doorL: 0.127  (x≈130)
doorR: 0.865  (x≈885)

rows[0] TOPS:
  btnCY:     0.202   rod centre y≈310
  boxY:      0.217   ClosetRow top — just below rod (y≈333)
  boxBot:    0.558   ClosetRow bottom — before BOTTOMS rod (y≈857)
  hangerTop: 0.217   hanger overlay top = boxY
  hangerBot: 0.393   hanger overlay bottom — below centre hanger arms (y≈604)

rows[1] BOTTOMS:
  btnCY:     0.567   rod y≈871
  boxY:      0.576   below BOTTOMS rod (y≈885)
  boxBot:    0.773   before SHOES rod (y≈1188)
  hangerTop: 0.576
  hangerBot: 0.632   below BOTTOMS hanger arms (y≈971)

rows[2] SHOES:
  btnCY:     0.781   rod y≈1200
  boxY:      0.790   below SHOES rod (y≈1214) — no hanging hangers visible
  boxBot:    0.896   above SAVE bar (y≈1377)
  hangerTop: 0.790
  hangerBot: 0.800   minimal overlay — only rod shadow

barY:     0.898
barBot:   0.973
hangerCX: 0.140
saveBtnL: 0.228
saveBtnR: 0.772
manneCX:  0.860
```

**Pixel-scan notes:**
- Left-slot hanger (x≈200): arm base at y≈510 (gold arm ends abruptly)
- Centre hanger (x=511): pink, taller — arms reach y≈600
- SHOES rod: y≈1192–1207 at x=200, 511, 760; no hanging hangers below it
- Rod detection: scan for dark-gold pixels (R>150,G>70,B<80) at centre x=511

## ClosetRow contract

Cards are **3:4 portrait ratio**: `cardW = slotW`, `cardH = slotW * 4/3`.
- `objectFit: "cover"`, `objectPosition: "center"` — fills card, centres the clothing.
- Container is `overflow: hidden` — if `cardH > containerH`, bottom of card clips.
  - TOPS: 200px container, 128px card → fits with space below ✓
  - BOTTOMS: 115px container, 128px card → 13px clipped at bottom (negligible)
  - SHOES: 62px container, 128px card → top ~62px of card visible (acceptable for shoe photos)
- Selected card: 4.5px blush-pink border + outer glow. Non-selected: no border, transparent bg.
- `cardW = slotW = containerWidth / 3`. The 3-slot carousel fills the doorL→doorR interior.

## Hanger overlay technique (z=20)

Gold/pink hangers are baked into the background image. To keep them visually **above** clothing
photos, each row renders a second `<div>` at z=20 that re-draws the background-image crop:

```
backgroundImage:    url('/closet-bg.png')
backgroundSize:     `${ir.width}px ${ir.height}px`
backgroundPosition: `${-pW(ir, LM.doorL)}px ${-pH(ir, lm.hangerTop)}px`
backgroundRepeat:   no-repeat
pointerEvents:      none
```

**Why this works:** The div's CSS origin is at `(pX(ir, doorL), pY(ir, hangerTop))`.
Applying `backgroundPosition = (-pW(doorL), -pH(hangerTop))` shifts the background image
so its apparent origin lands exactly at `(ir.left, ir.top)` in the container — matching
the main `<img>` layer pixel-for-pixel.

**Future re-calibration:** scan at slot-centre x-positions (x≈180, 511, 810 for 1023px wide)
at relevant y ranges to find hanger arm bottoms. Centre hanger (pink) extends 80–90px below
the gold side hangers; always use the centre measurement for `hangerBot`.
