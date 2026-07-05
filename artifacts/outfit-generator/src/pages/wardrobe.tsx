import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  useListClothing,
  getListClothingQueryKey,
  useSaveOutfit,
  useListOutfits,
  getListOutfitsQueryKey,
  ClothingItem,
} from "@workspace/api-client-react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SwipeRow, SwipeRowHandle } from "@/components/SwipeRow";
import { QuickAddSheet } from "@/components/clothing/QuickAddSheet";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";
import { MannequinView } from "@/components/MannequinView";
import { UpgradeSheet, UpgradeReason } from "@/components/paywall/UpgradeSheet";
import { PremiumSheet } from "@/components/paywall/PremiumSheet";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FREE_ITEM_LIMIT, FREE_OUTFIT_LIMIT } from "@/lib/entitlements";

// ── Row config ────────────────────────────────────────────────────────────────
type RowKey  = "tops" | "bottoms" | "shoes";
type Category = "tops" | "bottoms" | "shoes" | "accessories" | "outerwear" | "dresses";

const ROWS: { key: RowKey; label: string; addLabel: string }[] = [
  { key: "tops",    label: "Tops",    addLabel: "Add Top"    },
  { key: "bottoms", label: "Bottoms", addLabel: "Add Bottom" },
  { key: "shoes",   label: "Shoes",   addLabel: "Add Shoes"  },
];

// ── Palette ───────────────────────────────────────────────────────────────────
const INTERIOR = "linear-gradient(168deg,#fffdf5 0%,#fdf5e2 52%,#faeedd 100%)";
const DOOR_L   = "linear-gradient(108deg,#c08010 0%,#f5c820 38%,#e8cc14 62%,#be8010 100%)";
const DOOR_R   = "linear-gradient(252deg,#c08010 0%,#f5c820 38%,#e8cc14 62%,#be8010 100%)";
const GOLD_ROD = "linear-gradient(180deg,#f8e870 0%,#c09020 26%,#e8c840 52%,#b08010 78%,#f0d850 100%)";
const GOLD     = "#C49B2A";
const PINK     = "#e8a0bc";

// ── Responsive sizes ──────────────────────────────────────────────────────────
// AppLayout wraps children in: main.flex-1.overflow-y-auto.pb-[90px]
// The nav is absolute-bottom-0, so content area ≈ window.innerHeight - 90
const NAV_H = 90;

interface Sizes {
  topH:    number;
  botH:    number;
  rowH:    number;
  cardW:   number;
  cardH:   number;
  hangerH: number;
  doorW:   number;
}

function computeSizes(winH: number): Sizes {
  const avail = winH - NAV_H;
  // top section: shelf + chandelier + title
  const topH  = Math.min(158, Math.max(104, Math.round(avail * 0.196)));
  // bottom bar: save outfit strip
  const botH  = Math.min(82,  Math.max(58,  Math.round(avail * 0.097)));
  // two shelf dividers × 5 px
  const rowsH = avail - topH - botH - 10;
  const rowH  = rowsH / 3;
  // per-row overhead: gold rod 5px + label row 20px = 25px
  const itemH = rowH - 25;
  // hH and cardH are derived proportionally so hH + cardH == itemH always
  const hH    = Math.min(18, Math.max(8, Math.round(itemH * 0.155)));
  const cardH = Math.max(0, itemH - hH);   // no hard min — avoids overflow on short screens
  const cardW = Math.round(Math.max(40, cardH) * 0.80);
  const doorW = Math.min(62,  Math.max(44,  Math.round(avail * 0.073)));
  return { topH, botH, rowH, cardW, cardH, hangerH: hH, doorW };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClosetDoor({ side, doorW }: { side: "left" | "right"; doorW: number }) {
  const isL = side === "left";
  return (
    <div
      style={{
        position: "absolute", top: 0, bottom: 0,
        [isL ? "left" : "right"]: 0, width: doorW,
        background: isL ? DOOR_L : DOOR_R,
        boxShadow: isL
          ? "inset -6px 0 16px rgba(0,0,0,0.17), 2px 0 8px rgba(0,0,0,0.09)"
          : "inset  6px 0 16px rgba(0,0,0,0.17), -2px 0 8px rgba(0,0,0,0.09)",
        zIndex: 20, pointerEvents: "none", userSelect: "none",
      }}
    >
      <div style={{ position:"absolute", top:"5%",  left:7, right:7, height:"31%", border:"1.8px solid rgba(255,255,255,0.27)", borderRadius:5, boxShadow:"inset 0 2px 5px rgba(0,0,0,0.09)" }} />
      <div style={{ position:"absolute", top:"42%", left:7, right:7, height:"52%", border:"1.8px solid rgba(255,255,255,0.27)", borderRadius:5, boxShadow:"inset 0 2px 5px rgba(0,0,0,0.09)" }} />
      <div style={{ position:"absolute", top:"46%", [isL?"right":"left"]:8, width:11, height:11, borderRadius:"50%", background:"radial-gradient(circle at 32% 28%,#ffe880,#9a7010)", boxShadow:"0 1px 4px rgba(0,0,0,0.32), inset 0 1px 1px rgba(255,255,255,0.4)" }} />
      {[0.42, 0.60, 0.78].map(f => (
        <div key={f} style={{ position:"absolute", top:0, bottom:0, left:Math.round(doorW*f), width:1, background:"rgba(255,255,255,0.09)" }} />
      ))}
    </div>
  );
}

function Chandelier({ scale = 1 }: { scale?: number }) {
  const s = scale;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", pointerEvents:"none", userSelect:"none" }}>
      <div style={{ width:Math.round(22*s), height:Math.round(5*s), background:"rgba(196,155,42,0.52)", borderRadius:3 }} />
      <div style={{ width:Math.round(2*s),  height:Math.round(9*s), background:"rgba(196,155,42,0.42)" }} />
      <div style={{ width:Math.round(62*s), height:Math.round(13*s), background:"linear-gradient(to bottom,#ffe878,#d4a020,#ffe060)", borderRadius:"50%", boxShadow:`0 3px ${Math.round(14*s)}px rgba(212,160,32,0.42), 0 0 0 1px rgba(212,160,32,0.20)` }} />
      <div style={{ display:"flex", gap:Math.round(8*s), marginTop:1 }}>
        {([9,14,19,14,9] as number[]).map((h, i) => (
          <div key={i} style={{ width:Math.round(3*s), height:Math.round(h*s), background:"linear-gradient(to bottom,rgba(255,235,120,0.88),rgba(255,210,60,0.52))", borderRadius:`0 0 ${Math.round(3*s)}px ${Math.round(3*s)}px` }} />
        ))}
      </div>
      <div style={{ width:Math.round(115*s), height:Math.round(24*s), borderRadius:"50%", marginTop:3, background:"radial-gradient(ellipse at top,rgba(255,235,120,0.28) 0%,transparent 70%)" }} />
    </div>
  );
}

function TopShelf({ height, doorW }: { height: number; doorW: number }) {
  const shelfH   = Math.max(8, Math.round(height * 0.15));
  const bagAreaH = height - shelfH;
  const s        = bagAreaH / 78;

  const bags = [
    { w:Math.round(34*s), h:Math.round(46*s), br:"8px 8px 5px 5px", bg:"linear-gradient(135deg,#e8a0b4,#d07898)", handle:"#d07898", quilted:true  },
    { w:Math.round(40*s), h:Math.round(33*s), br:"4px",              bg:"linear-gradient(135deg,#d8b850,#bea038)", handle:"#b09030", plaid:true    },
    { w:Math.round(46*s), h:Math.round(42*s), br:"50% 50% 44% 44%", bg:"radial-gradient(circle at 40% 40%,#f8c0d0,#e898b4)", handle:null          },
    { w:Math.round(32*s), h:Math.round(44*s), br:"5px 5px 7px 7px", bg:"linear-gradient(135deg,#e8d4a4,#d8c080)", handle:"#c0a860", quilted:true  },
  ] as const;

  return (
    <div style={{ height, flexShrink:0, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", bottom:shelfH+1, left:doorW, right:doorW, display:"flex", alignItems:"flex-end", justifyContent:"center", gap:Math.round(8*s), paddingBottom:1 }}>
        {bags.map((b, i) => (
          <div key={i} style={{ position:"relative", width:b.w, height:b.h, flexShrink:0 }}>
            {"handle" in b && b.handle && (
              <div style={{ position:"absolute", top:-Math.round(6*s), left:"24%", right:"24%", height:Math.round(7*s), border:`1.8px solid ${b.handle}`, borderBottom:"none", borderRadius:`${Math.round(4*s)}px ${Math.round(4*s)}px 0 0` }} />
            )}
            <div style={{ width:"100%", height:"100%", background:b.bg, borderRadius:b.br, boxShadow:"2px 3px 8px rgba(0,0,0,0.12)", overflow:"hidden", position:"relative" }}>
              {"quilted" in b && b.quilted && (
                <div style={{ position:"absolute", inset:Math.round(3*s), backgroundImage:"repeating-linear-gradient(45deg,rgba(255,255,255,0.17) 0,rgba(255,255,255,0.17) 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,rgba(255,255,255,0.17) 0,rgba(255,255,255,0.17) 1px,transparent 0,transparent 50%)", backgroundSize:`${Math.round(10*s)}px ${Math.round(10*s)}px`, borderRadius:"inherit" }} />
              )}
              {"plaid" in b && b.plaid && (
                <div style={{ position:"absolute", inset:0, backgroundImage:`repeating-linear-gradient(0deg,rgba(200,100,90,0.22) 0,rgba(200,100,90,0.22) 2px,transparent 0,transparent ${Math.round(11*s)}px),repeating-linear-gradient(90deg,rgba(200,100,90,0.22) 0,rgba(200,100,90,0.22) 2px,transparent 0,transparent ${Math.round(11*s)}px)`, borderRadius:"inherit" }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position:"absolute", bottom:0, left:doorW, right:doorW, height:shelfH, background:"linear-gradient(to bottom,#f2e2b2,#e4c888)", boxShadow:"0 4px 10px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.48) inset", border:"1px solid rgba(180,140,50,0.17)", borderRadius:"0 0 3px 3px" }} />
    </div>
  );
}

function GoldRod({ doorW }: { doorW: number }) {
  return (
    <div style={{ paddingLeft:doorW+6, paddingRight:doorW+6, flexShrink:0 }}>
      <div style={{ width:"100%", height:5, background:GOLD_ROD, borderRadius:3, boxShadow:"0 3px 7px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.38) inset" }} />
    </div>
  );
}

function RowShelf({ doorW }: { doorW: number }) {
  return (
    <div style={{ paddingLeft:doorW, paddingRight:doorW, flexShrink:0, height:5 }}>
      <div style={{ height:"100%", background:"linear-gradient(to bottom,#ead498,#f4e6ba)", boxShadow:"0 3px 7px rgba(0,0,0,0.09), 0 1px 0 rgba(255,255,255,0.52) inset", border:"1px solid rgba(180,140,50,0.15)", borderRadius:"0 0 4px 4px" }} />
    </div>
  );
}

function HangerIcon({ size = 22 }: { size?: number }) {
  const w = size, h = size * 0.85;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={`M${w/2} ${h*0.12} Q${w/2} ${h*0.04} ${w/2+2.5} ${h*0.04} Q${w/2+6} ${h*0.04} ${w/2+6} ${h*0.28} Q${w/2+6} ${h*0.48} ${w/2} ${h*0.48}`} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <line x1={w/2} y1={h*0.48} x2={w/2} y2={h*0.76} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
      <path d={`M${w/2} ${h*0.76} Q${w*0.2} ${h*0.84} 3 ${h}`} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d={`M${w/2} ${h*0.76} Q${w*0.8} ${h*0.84} ${w-3} ${h}`} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <line x1="3" y1={h} x2={w-3} y2={h} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MannequinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.12)} viewBox="0 0 22 24" fill="none">
      <circle cx="11" cy="3" r="2.2" stroke={GOLD} strokeWidth="1.7" />
      <path d="M7 7 Q5 11 6 16 L16 16 Q17 11 15 7 Q13 5.5 11 5.5 Q9 5.5 7 7Z" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <line x1="7.5" y1="13" x2="14.5" y2="13" stroke={GOLD} strokeWidth="1.4" />
      <path d="M6 16 Q4.5 21 11 22 Q17.5 21 16 16" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <line x1="11" y1="22" x2="11" y2="24" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8"  y1="24" x2="14" y2="24" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PinkRug({ doorW }: { doorW: number }) {
  return (
    <div style={{ display:"flex", justifyContent:"center", paddingLeft:doorW, paddingRight:doorW, flexShrink:0, paddingBottom:2 }}>
      <div style={{ width:"66%", height:12, borderRadius:"50%", background:"radial-gradient(ellipse,#f0a8c4 0%,#e090b0 55%,transparent 100%)", filter:"blur(1.5px)", opacity:0.72 }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WardrobePage() {
  const rowRefs = {
    tops:    useRef<SwipeRowHandle>(null),
    bottoms: useRef<SwipeRowHandle>(null),
    shoes:   useRef<SwipeRowHandle>(null),
  };

  const [centred,       setCentred]       = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [addCategory,   setAddCategory]   = useState<Category | null>(null);
  const [detailsItem,   setDetailsItem]   = useState<ClothingItem | null>(null);
  const [showMannequin, setShowMannequin] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [showPremium,   setShowPremium]   = useState(false);
  const [isSaveOpen,    setIsSaveOpen]    = useState(false);
  const [saveName,      setSaveName]      = useState("");

  const [sizes, setSizes] = useState<Sizes>(() =>
    computeSizes(typeof window !== "undefined" ? window.innerHeight : 844)
  );
  useEffect(() => {
    const run = () => setSizes(computeSizes(window.innerHeight));
    run();
    window.addEventListener("resize", run);
    return () => window.removeEventListener("resize", run);
  }, []);

  const { data: tops    = [] } = useListClothing({ category: "tops"    }, { query: { queryKey: getListClothingQueryKey({ category: "tops"    }) } });
  const { data: bottoms = [] } = useListClothing({ category: "bottoms" }, { query: { queryKey: getListClothingQueryKey({ category: "bottoms" }) } });
  const { data: shoes   = [] } = useListClothing({ category: "shoes"   }, { query: { queryKey: getListClothingQueryKey({ category: "shoes"   }) } });
  const { data: outfits = [] } = useListOutfits();

  const rowData: Record<RowKey, ClothingItem[]> = { tops, bottoms, shoes };
  const totalItems = tops.length + bottoms.length + shoes.length;

  const saveOutfit  = useSaveOutfit();
  const queryClient = useQueryClient();
  const { tier, caps, canAddItem, canSaveOutfit } = useEntitlements();

  const handleCentred = useCallback(
    (key: RowKey) => (item: ClothingItem | null) =>
      setCentred((prev) => ({ ...prev, [key]: item ?? undefined })),
    []
  );
  const handleItemTap       = useCallback((item: ClothingItem) => setDetailsItem(item), []);
  const handleAddClick      = useCallback((cat: Category) => {
    if (canAddItem(totalItems)) setAddCategory(cat); else setUpgradeReason("items");
  }, [canAddItem, totalItems]);
  const handleSaveClick     = useCallback(() => {
    if (canSaveOutfit(outfits.length)) setIsSaveOpen(true); else setUpgradeReason("outfits");
  }, [canSaveOutfit, outfits.length]);
  const handleMannequinClick = useCallback(() => {
    if (caps.mannequin) setShowMannequin(true); else setShowPremium(true);
  }, [caps.mannequin]);
  const handleShuffle = useCallback(() => {
    ROWS.forEach(({ key }, rowIndex) => {
      const data = rowData[key];
      if (data.length < 2) return;
      const ref = rowRefs[key].current;
      if (!ref) return;
      const idx = Math.floor(Math.random() * data.length);
      setTimeout(() => {
        ref.scrollToIndex(data.length - 1, false);
        setTimeout(() => ref.scrollToIndex(idx, true), 60);
      }, rowIndex * 80);
    });
  }, [rowData]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    if (!canSaveOutfit(outfits.length)) { setIsSaveOpen(false); setSaveName(""); setUpgradeReason("outfits"); return; }
    const itemIds = (Object.values(centred) as ClothingItem[]).map(i => i.id);
    saveOutfit.mutate(
      { data: { name: saveName.trim(), itemIds } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }); setIsSaveOpen(false); setSaveName(""); } }
    );
  };

  const canSave     = ROWS.every(({ key }) => !!centred[key]);
  const isFree      = tier === "free";
  const outfitsLeft = isFree ? Math.max(0, FREE_OUTFIT_LIMIT - outfits.length) : null;
  const itemsLeft   = isFree ? Math.max(0, FREE_ITEM_LIMIT  - totalItems)      : null;

  const { topH, botH, rowH, cardW, cardH, hangerH, doorW } = sizes;

  return (
    <div
      style={{
        position: "relative",
        height: `calc(100dvh - ${NAV_H}px)`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: INTERIOR,
      }}
    >
      {/* Warm ceiling glow */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:200, zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse at 50% 0%,rgba(255,238,130,0.27) 0%,transparent 68%)" }} />

      {/* Doors */}
      <ClosetDoor side="left"  doorW={doorW} />
      <ClosetDoor side="right" doorW={doorW} />

      {/* ── Top section ── */}
      <div style={{ flexShrink:0, height:topH, position:"relative", zIndex:10, display:"flex", flexDirection:"column" }}>
        <TopShelf height={Math.round(topH * 0.47)} doorW={doorW} />
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
          <Chandelier scale={Math.min(1, topH / 172)} />
          <h1 style={{ fontFamily:"Syne, sans-serif", fontWeight:800, textTransform:"uppercase", fontSize:Math.min(17,Math.max(12,Math.round(topH*0.108))), color:"#3a2400", letterSpacing:"0.07em", lineHeight:1, margin:"2px 0 0" }}>
            My Digital Closet
          </h1>
          <p style={{ fontSize:Math.min(9,Math.max(7,Math.round(topH*0.058))), fontWeight:600, color:PINK, letterSpacing:"0.10em", margin:0 }}>
            Inspired by digital closets of the '90s
          </p>
          {isFree && totalItems > 0 && (
            <button
              onClick={() => setUpgradeReason("items")}
              style={{ marginTop:2, fontSize:8, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 10px", borderRadius:20, background:itemsLeft===0?"#3a2400":"rgba(196,155,42,0.13)", color:itemsLeft===0?"white":"#9a7010", border:`1.5px solid ${itemsLeft===0?"#3a2400":"rgba(196,155,42,0.36)"}` }}
            >
              {totalItems}/{FREE_ITEM_LIMIT} items
            </button>
          )}
        </div>
      </div>

      {/* ── Three rows ── */}
      <div style={{ display:"flex", flexDirection:"column", position:"relative", zIndex:10, flex:1, minHeight:0 }}>
        {ROWS.map(({ key, label, addLabel }, rowIdx) => {
          const items = rowData[key];
          return (
            <React.Fragment key={key}>
              <div
                data-testid={`row-${key}`}
                style={{ height:rowH, display:"flex", flexDirection:"column", position:"relative" }}
              >
                <GoldRod doorW={doorW} />

                {/* Label + add */}
                <div style={{ flexShrink:0, height:20, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <div style={{ background:"white", borderRadius:20, padding:"2px 14px", boxShadow:"0 2px 8px rgba(0,0,0,0.09)", display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontFamily:"Syne, sans-serif", fontWeight:700, fontSize:10, letterSpacing:"0.17em", textTransform:"uppercase", color:"#3a2400" }}>
                      {label}
                    </span>
                    {items.length > 0 && <span style={{ fontSize:8, color:"#bbb", fontWeight:600 }}>{items.length}</span>}
                  </div>
                  <button
                    onClick={() => handleAddClick(key as Category)}
                    style={{ fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:PINK, background:"none", border:"none", padding:0, cursor:"pointer" }}
                  >
                    + Add
                  </button>
                </div>

                {/* Carousel */}
                <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center", minHeight:0 }}>
                  {items.length > 0 && (
                    <>
                      <div style={{ position:"absolute", left:doorW+2, top:"50%", transform:"translateY(-50%)", zIndex:5, fontSize:18, color:PINK, fontWeight:300, lineHeight:1, pointerEvents:"none", userSelect:"none", opacity:0.70 }}>‹</div>
                      <div style={{ position:"absolute", right:doorW+2, top:"50%", transform:"translateY(-50%)", zIndex:5, fontSize:18, color:PINK, fontWeight:300, lineHeight:1, pointerEvents:"none", userSelect:"none", opacity:0.70 }}>›</div>
                    </>
                  )}
                  <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center" }}>
                    <SwipeRow
                      ref={rowRefs[key]}
                      items={items}
                      addLabel={addLabel}
                      onCenteredItem={handleCentred(key)}
                      onAddClick={() => handleAddClick(key as Category)}
                      onItemTap={handleItemTap}
                      closetStyle
                      closetItemW={cardW}
                      closetItemH={cardH}
                      closetHangerH={hangerH}
                    />
                  </div>
                </div>
              </div>

              {rowIdx < ROWS.length - 1 && <RowShelf doorW={doorW} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Bottom bar ── */}
      <div
        style={{
          flexShrink:0, height:botH, zIndex:15,
          display:"flex", flexDirection:"column",
          background:"rgba(255,250,238,0.97)",
          borderTop:"1px solid rgba(196,155,42,0.18)",
          boxShadow:"0 -3px 14px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ flex:1, display:"flex", alignItems:"center", paddingLeft:doorW+8, paddingRight:doorW+8, gap:8, minHeight:0 }}>

          {/* Shuffle / hanger icon */}
          <button
            onClick={handleShuffle}
            data-testid="button-shuffle"
            title="Shuffle outfit"
            style={{ flexShrink:0, width:36, height:36, borderRadius:"50%", background:"rgba(196,155,42,0.10)", border:"1.2px solid rgba(196,155,42,0.28)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
          >
            <HangerIcon size={19} />
          </button>

          {/* Save Outfit */}
          <AnimatePresence mode="wait">
            {isSaveOpen ? (
              <motion.div key="input" initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }} style={{ flex:1, display:"flex", gap:6 }}>
                <input
                  autoFocus type="text"
                  placeholder="Name this outfit…"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  data-testid="input-outfit-name"
                  style={{ flex:1, height:34, borderRadius:20, padding:"0 14px", fontSize:12, fontWeight:600, color:"#3a2400", background:"rgba(255,252,245,0.95)", border:"1.5px solid rgba(196,155,42,0.36)", boxShadow:"0 2px 6px rgba(0,0,0,0.05)", outline:"none" }}
                />
                <button onClick={() => { setIsSaveOpen(false); setSaveName(""); }}
                  style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background:"rgba(196,155,42,0.10)", border:"1.2px solid rgba(196,155,42,0.26)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <X style={{ width:14, height:14, color:GOLD }} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || saveOutfit.isPending}
                  data-testid="button-save-outfit-confirm"
                  style={{ padding:"0 16px", height:34, borderRadius:20, flexShrink:0, background:"linear-gradient(to bottom,#f5d840,#c89018)", color:"#3a2400", fontWeight:700, fontSize:12, border:"none", boxShadow:"0 3px 10px rgba(200,168,24,0.32)", opacity:(!saveName.trim()||saveOutfit.isPending)?0.42:1, letterSpacing:"0.05em", cursor:"pointer" }}
                >
                  {saveOutfit.isPending ? "…" : "Save"}
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="save"
                initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:4 }}
                onClick={canSave ? handleSaveClick : undefined}
                data-testid="button-save-outfit"
                style={{
                  flex:1, height:36, borderRadius:20,
                  background: canSave ? "linear-gradient(to bottom,#f8e050,#c89018)" : "rgba(234,224,198,0.80)",
                  color:   canSave ? "#3a2400" : "rgba(100,78,30,0.36)",
                  fontWeight:700, fontSize:12, letterSpacing:"0.09em",
                  textTransform:"uppercase", border:"none",
                  boxShadow: canSave ? "0 4px 14px rgba(200,168,24,0.36)" : "none",
                  cursor: canSave ? "pointer" : "default",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                }}
              >
                Save Outfit
                <span style={{ opacity:0.52 }}>♡</span>
                {isFree && outfitsLeft !== null && canSave && <span style={{ fontSize:9, opacity:0.52 }}>({outfitsLeft} left)</span>}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Mannequin */}
          <button
            onClick={handleMannequinClick}
            disabled={!canSave}
            data-testid="button-view-mannequin"
            title="View on mannequin"
            style={{ flexShrink:0, width:36, height:36, borderRadius:"50%", background:"rgba(196,155,42,0.10)", border:"1.2px solid rgba(196,155,42,0.28)", display:"flex", alignItems:"center", justifyContent:"center", opacity:canSave?1:0.30, cursor:canSave?"pointer":"default" }}
          >
            <MannequinIcon size={19} />
          </button>
        </div>

        <PinkRug doorW={doorW} />
      </div>

      {/* ── Overlays ── */}
      <AnimatePresence>
        {showMannequin && <MannequinView top={centred.tops} bottom={centred.bottoms} shoes={centred.shoes} onClose={() => setShowMannequin(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {upgradeReason && <UpgradeSheet reason={upgradeReason} onClose={() => setUpgradeReason(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showPremium && <PremiumSheet onClose={() => setShowPremium(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {addCategory && (
          <QuickAddSheet
            key={addCategory} open={!!addCategory}
            onOpenChange={open => !open && setAddCategory(null)}
            category={addCategory}
            existingCount={rowData[addCategory as RowKey]?.length ?? 0}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detailsItem && <ItemDetailsSheet key={detailsItem.id} item={detailsItem} onClose={() => setDetailsItem(null)} />}
      </AnimatePresence>
    </div>
  );
}
