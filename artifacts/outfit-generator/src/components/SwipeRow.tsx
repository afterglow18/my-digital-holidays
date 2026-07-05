import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Plus } from "lucide-react";
import { ClothingItem } from "@workspace/api-client-react";
import { getImageUrl } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────
export const ITEM_W   = 112; // px — card width
export const ITEM_H   = 140; // px — card height
export const ITEM_GAP =  10; // px — gap between cards
export const HANGER_H =  26; // px — hanger decoration above card (closet mode)

// ── Public handle ─────────────────────────────────────────────────────────────
export interface SwipeRowHandle {
  scrollToIndex: (index: number, smooth?: boolean) => void;
  getLength: () => number;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SwipeRowProps {
  items: ClothingItem[];
  addLabel: string;
  onCenteredItem: (item: ClothingItem | null) => void;
  onAddClick: () => void;
  /** Called when the currently-centred card is tapped (opens Item Details) */
  onItemTap?: (item: ClothingItem) => void;
  /** Render in walk-in closet style: hangers, cream cards, gold dots */
  closetStyle?: boolean;
}

// ── Hanger SVG ────────────────────────────────────────────────────────────────
function HangerSVG({ width = 72, dim = false }: { width?: number; dim?: boolean }) {
  const h = HANGER_H;
  const hw = width;
  const stroke = dim ? "rgba(176,136,40,0.45)" : "#C49B2A";
  return (
    <svg width={hw} height={h} viewBox={`0 0 ${hw} ${h}`} fill="none" style={{ display: "block" }}>
      {/* hook */}
      <path
        d={`M${hw / 2} 3 Q${hw / 2} 1 ${hw / 2 + 3} 1 Q${hw / 2 + 8} 1 ${hw / 2 + 8} 6 Q${hw / 2 + 8} 11 ${hw / 2} 11`}
        stroke={stroke} strokeWidth="2.4" strokeLinecap="round" fill="none"
      />
      {/* neck stem */}
      <line x1={hw / 2} y1="11" x2={hw / 2} y2={h - 6} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      {/* left shoulder */}
      <path d={`M${hw / 2} ${h - 6} Q${hw * 0.22} ${h - 8} 4 ${h}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* right shoulder */}
      <path d={`M${hw / 2} ${h - 6} Q${hw * 0.78} ${h - 8} ${hw - 4} ${h}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* bottom bar */}
      <line x1="4" y1={h} x2={hw - 4} y2={h} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export const SwipeRow = forwardRef<SwipeRowHandle, SwipeRowProps>(
  ({ items, addLabel, onCenteredItem, onAddClick, onItemTap, closetStyle = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs     = useRef<(HTMLDivElement | null)[]>([]);
    const lastSnapIdx  = useRef(-1);
    const STEP = ITEM_W + ITEM_GAP;

    const [centredIdx, setCentredIdx] = useState(0);

    // ── Imperative API ────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      scrollToIndex: (index, smooth = true) => {
        containerRef.current?.scrollTo({
          left: index * STEP,
          behavior: smooth ? "smooth" : "instant",
        });
      },
      getLength: () => items.length,
    }));

    // ── Visual update — direct DOM for smooth scroll ──────────────────────────
    const updateVisuals = useCallback(() => {
      const el = containerRef.current;
      if (!el || items.length === 0) return;

      const raw     = el.scrollLeft / STEP;
      const snapIdx = Math.max(0, Math.min(items.length - 1, Math.round(raw)));

      itemRefs.current.forEach((node, i) => {
        if (!node) return;
        const dist    = Math.abs(i - raw);
        const clamped = Math.min(dist, 1);
        node.style.transform = `scale(${(1 - clamped * 0.12).toFixed(3)})`;
        node.style.opacity   = closetStyle
          ? (1 - clamped * 0.55).toFixed(3)
          : (1 - clamped * 0.60).toFixed(3);
      });

      if (snapIdx !== lastSnapIdx.current) {
        lastSnapIdx.current = snapIdx;
        setCentredIdx(snapIdx);
        onCenteredItem(items[snapIdx] ?? null);
      }
    }, [items, onCenteredItem, STEP, closetStyle]);

    useEffect(() => {
      updateVisuals();
      if (items.length > 0 && lastSnapIdx.current === -1) {
        onCenteredItem(items[0]);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length]);

    // ── Card click: centre-then-open ──────────────────────────────────────────
    const handleCardClick = useCallback(
      (item: ClothingItem, idx: number) => {
        if (idx === lastSnapIdx.current) {
          onItemTap?.(item);
        } else {
          containerRef.current?.scrollTo({ left: idx * STEP, behavior: "smooth" });
        }
      },
      [onItemTap, STEP]
    );

    // Heights
    const rowH = closetStyle ? ITEM_H + HANGER_H : ITEM_H;
    const containerH = rowH + (closetStyle ? 22 : 20); // +22 for dots in closet mode

    // ── Empty row ─────────────────────────────────────────────────────────────
    if (items.length === 0) {
      if (closetStyle) {
        return (
          <div className="flex flex-col items-center" style={{ height: containerH }}>
            <div style={{ opacity: 0.45 }}>
              <HangerSVG width={ITEM_W * 0.65} dim />
            </div>
            <button
              onClick={onAddClick}
              className="flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform"
              style={{
                width: ITEM_W,
                height: ITEM_H,
                borderRadius: "0 0 14px 14px",
                background: "rgba(255,252,245,0.75)",
                border: "1.5px dashed rgba(196,155,42,0.45)",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 32, height: 32,
                  borderRadius: "50%",
                  background: "rgba(196,155,42,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Plus className="w-4 h-4" style={{ color: "#C49B2A" }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C49B2A" }}>
                {addLabel}
              </span>
            </button>
          </div>
        );
      }

      return (
        <div className="flex justify-center items-center" style={{ height: ITEM_H + 20 }}>
          <button
            onClick={onAddClick}
            className="border-2 border-dashed border-black/35 rounded-2xl
                       flex flex-col items-center justify-center gap-2
                       bg-white/60 hover:border-black hover:bg-white transition-all active:scale-95"
            style={{ width: ITEM_W, height: ITEM_H }}
          >
            <div className="w-9 h-9 rounded-full border-2 border-black/35 flex items-center justify-center">
              <Plus className="w-5 h-5 text-black/45" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-black/45 text-center px-2 leading-tight">
              {addLabel}
            </span>
          </button>
        </div>
      );
    }

    // ── Scroll row ────────────────────────────────────────────────────────────
    return (
      <div>
        <div className="relative" style={{ height: rowH }}>
          {/* Centre viewfinder — only in standard mode */}
          {!closetStyle && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         pointer-events-none z-10 rounded-2xl"
              style={{
                width:     ITEM_W + 6,
                height:    ITEM_H + 6,
                boxShadow: "0 0 0 2.5px black, 0 4px 0 0 black",
              }}
            />
          )}

          {/* Scrollable strip */}
          <div
            ref={containerRef}
            onScroll={updateVisuals}
            className="flex items-end h-full overflow-x-auto no-scrollbar"
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex-none shrink-0" style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} />

            {items.map((item, i) => (
              <div
                key={item.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                onClick={() => handleCardClick(item, i)}
                className="flex-none flex flex-col relative cursor-pointer"
                style={{
                  width:           ITEM_W,
                  height:          closetStyle ? ITEM_H + HANGER_H : ITEM_H,
                  marginLeft:      i === 0 ? 0 : ITEM_GAP,
                  scrollSnapAlign: "center",
                  willChange:      "transform, opacity",
                  transform:       "scale(1)",
                  opacity:         i === 0 ? "1" : "0.45",
                  paddingTop:      closetStyle ? HANGER_H : 0,
                  alignSelf:       "flex-end",
                }}
              >
                {/* Hanger — closet mode only */}
                {closetStyle && (
                  <div
                    className="absolute left-0 right-0 flex justify-center pointer-events-none"
                    style={{ top: 0, height: HANGER_H }}
                  >
                    <HangerSVG width={ITEM_W * 0.65} />
                  </div>
                )}

                {/* Card */}
                <div
                  className="flex flex-col overflow-hidden"
                  style={
                    closetStyle
                      ? {
                          flex: 1,
                          borderRadius: "0 0 12px 12px",
                          background: "rgba(255,252,248,0.95)",
                          boxShadow: "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)",
                          border: "1px solid rgba(196,155,42,0.12)",
                        }
                      : {
                          flex: 1,
                          borderRadius: 16,
                          background: "white",
                          border: "2px solid black",
                        }
                  }
                >
                  {/* Photo */}
                  <div
                    className="flex-1 overflow-hidden relative"
                    style={{
                      backgroundImage: "repeating-conic-gradient(#ede8e0 0% 25%, #f9f4ee 0% 50%)",
                      backgroundSize:  "10px 10px",
                    }}
                  >
                    {item.imageObjectPath ? (
                      <img
                        src={getImageUrl(item.imageObjectPath)!}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary/20 flex items-center justify-center p-2">
                        <span className="text-black/20 text-2xl">
                          {addLabel.includes("Top") ? "👚" : addLabel.includes("Bottom") ? "👖" : "👟"}
                        </span>
                      </div>
                    )}

                    {/* Tap-for-details badge — centred card only */}
                    {i === centredIdx && (
                      <div
                        className="absolute bottom-1 right-1 flex items-center justify-center pointer-events-none"
                        style={{
                          width: 18, height: 18,
                          borderRadius: "50%",
                          background: closetStyle ? "rgba(196,155,42,0.75)" : "rgba(0,0,0,0.60)",
                        }}
                      >
                        <span className="text-white font-bold" style={{ fontSize: 8 }}>i</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex-none shrink-0" style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} />
          </div>
        </div>

        {/* Dot indicators — closet mode */}
        {closetStyle && items.length > 0 && (
          <div className="flex justify-center items-center gap-1.5 mt-2.5">
            {items.slice(0, 9).map((_, i) => (
              <div
                key={i}
                style={{
                  width:        i === centredIdx ? 7 : 5,
                  height:       i === centredIdx ? 7 : 5,
                  borderRadius: "50%",
                  background:   i === centredIdx ? "#C49B2A" : "rgba(196,155,42,0.28)",
                  transition:   "all 0.25s ease",
                  flexShrink:   0,
                }}
              />
            ))}
            {items.length > 9 && (
              <span style={{ fontSize: 8, color: "rgba(196,155,42,0.5)", fontWeight: 700 }}>
                +{items.length - 9}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

SwipeRow.displayName = "SwipeRow";
