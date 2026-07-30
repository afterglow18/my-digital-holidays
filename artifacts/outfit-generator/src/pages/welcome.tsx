/**
 * WelcomePage — cinematic lights-on splash screen.
 *
 * Phases:
 *   hero      — full-screen hero image, 2.5 s auto-advance (Phase 1)
 *   idle      — near-black room; light switch in OFF position (Phase 2)
 *   switching — rocker flips to ON, brief pause before lights fire
 *   lighting  — 3 rapid warm-light flickers, dark overlay fades away
 *   lit       — full image holds for a beat (~300 ms)
 *   exiting   — fade to black → calls onEnter() (Phase 3)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "hero" | "idle" | "switching" | "lighting" | "lit" | "exiting";

// ── Timing (ms) ───────────────────────────────────────────────────────────────
const HERO_HOLD_MS      = 2500; // Phase 1 auto-advance
const HERO_FADE_MS      =  700; // hero→idle cross-fade
const SWITCH_FLIP_MS    =  160; // rocker animation → then lights fire
const LIGHT_DURATION_MS = 1900;
const LIT_HOLD_MS       =  250;
const EXIT_FADE_MS      =  500;

// ── Keyframe arrays ───────────────────────────────────────────────────────────
const DARK_KF    = [0.97, 0.62, 0.97, 0.42, 0.97, 0.28, 0.10, 0];
const DARK_T     = [0,    0.07, 0.14, 0.21, 0.29, 0.50, 0.72, 1.0];
const GARLAND_KF = [0, 0.90, 0.05, 0.95, 0.10, 0.70, 0.20, 0];
const GARLAND_T  = [0, 0.07, 0.14, 0.21, 0.29, 0.50, 0.72, 1.0];
const CANDLE_KF  = [0, 0, 0.60, 0.05, 0.80, 0.15, 0.50, 0];
const CANDLE_T   = [0, 0.07, 0.14, 0.21, 0.29, 0.50, 0.72, 1.0];

const lightTrans = (kfTimes: number[]) => ({
  duration: LIGHT_DURATION_MS / 1000,
  times:    kfTimes,
  ease:     "linear" as const,
});

// ── Shared branding block ─────────────────────────────────────────────────────
function Branding({ light = false }: { light?: boolean }) {
  return (
    <div style={{ textAlign: "center", pointerEvents: "none" }}>
      <div style={{
        fontFamily: "var(--font-display, serif)",
        fontWeight: 400, fontSize: 12,
        letterSpacing: "0.30em", textTransform: "uppercase",
        color: light ? "rgba(255,235,190,0.70)" : "rgba(255,235,190,0.55)",
        marginBottom: 6,
      }}>
        Welcome to
      </div>
      <div style={{
        fontFamily: "'Dancing Script', cursive",
        fontWeight: 700,
        fontSize: 52,
        lineHeight: 1.05,
        color: "#8B1A1A",
        textShadow: light
          ? "0 0 24px rgba(255,160,60,0.50), 0 2px 10px rgba(0,0,0,0.70)"
          : "0 0 32px rgba(255,180,80,0.40), 0 2px 12px rgba(0,0,0,0.60)",
      }}>
        My Digital Holidays
      </div>
    </div>
  );
}

// ── LightSwitch component ─────────────────────────────────────────────────────
function LightSwitch({ onFlip, disabled }: { onFlip: () => void; disabled: boolean }) {
  const [flipped, setFlipped] = useState(false);

  const handleTap = () => {
    if (disabled || flipped) return;
    setFlipped(true);
    onFlip();
  };

  return (
    <div
      onClick={handleTap}
      role="button"
      aria-label="Turn on the lights"
      style={{
        width: 74, height: 122, borderRadius: 10,
        background: "linear-gradient(160deg, #2e2b27 0%, #1a1814 100%)",
        border: "1.5px solid #3d3830",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.75), " +
          "inset 0 1px 0 rgba(255,255,255,0.06), " +
          "inset 0 -1px 0 rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: "10px 0",
        cursor: flipped ? "default" : "pointer",
        position: "relative", userSelect: "none",
      }}
    >
      <Screw />
      <div style={{ perspective: 220, perspectiveOrigin: "center center" }}>
        <motion.div
          initial={{ rotateX: -22 }}
          animate={{ rotateX: flipped ? 22 : -22 }}
          transition={{ duration: 0.13, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            width: 52, height: 80, borderRadius: 6,
            transformStyle: "preserve-3d",
            background: flipped
              ? "linear-gradient(170deg, #E8D4B0 0%, #c9a066 55%, #9e6d35 100%)"
              : "linear-gradient(170deg, #4a4540 0%, #2e2b27 55%, #1e1c18 100%)",
            boxShadow: flipped
              ? "0 2px 16px rgba(220,160,60,0.55), inset 0 1px 0 rgba(255,255,255,0.18)"
              : "0 2px 8px rgba(0,0,0,0.6),        inset 0 1px 0 rgba(255,255,255,0.06)",
            transition: "background 0.1s, box-shadow 0.1s",
            display: "flex",
            alignItems: flipped ? "flex-start" : "flex-end",
            justifyContent: "center",
            paddingTop: flipped ? 8 : 0,
            paddingBottom: flipped ? 0 : 8,
          }}
        >
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.18em",
            color: flipped ? "rgba(60,30,5,0.7)" : "rgba(255,255,255,0.18)",
          }}>
            ENTER
          </span>
        </motion.div>
      </div>
      <motion.div
        animate={{
          background: flipped ? "#ffcc55" : "#2a2520",
          boxShadow: flipped ? "0 0 6px 2px rgba(255,200,60,0.8)" : "none",
        }}
        transition={{ duration: 0.08 }}
        style={{ width: 7, height: 7, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }}
      />
      <Screw />
    </div>
  );
}

function Screw() {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: "50%",
      background: "radial-gradient(circle at 35% 35%, #555, #222)",
      border: "1px solid #111",
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "45%", left: "15%", width: "70%", height: "10%", background: "rgba(0,0,0,0.55)", borderRadius: 1 }} />
      <div style={{ position: "absolute", left: "45%", top: "15%", height: "70%", width: "10%", background: "rgba(0,0,0,0.55)", borderRadius: 1 }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("hero");
  const calledRef = useRef(false);

  // Phase 1 → Phase 2: auto-advance after HERO_HOLD_MS
  useEffect(() => {
    if (phase !== "hero") return;
    const t = setTimeout(() => setPhase("idle"), HERO_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleFlip = () => {
    if (phase !== "idle") return;
    setPhase("switching");
    setTimeout(() => {
      setPhase("lighting");
      setTimeout(() => setPhase("lit"),     LIGHT_DURATION_MS);
      setTimeout(() => setPhase("exiting"), LIGHT_DURATION_MS + LIT_HOLD_MS);
      setTimeout(finish,                    LIGHT_DURATION_MS + LIT_HOLD_MS + EXIT_FADE_MS + 80);
    }, SWITCH_FLIP_MS);
  };

  const isHero     = phase === "hero";
  const isLighting = phase === "lighting";
  const isIdle     = phase === "idle";
  const showUI     = phase === "idle" || phase === "switching";

  // Dark overlay opacity: 0 during hero, 0.97 during idle/switching, animation during lighting, 0 when lit/exiting
  const darkOpacity = isLighting ? DARK_KF : (isHero ? 0 : showUI ? 0.97 : 0);
  const darkTransition = isLighting
    ? lightTrans(DARK_T)
    : { duration: isHero ? 0.1 : isIdle ? HERO_FADE_MS / 1000 : 0.05 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", overflow: "hidden" }}>

      {/* ── Layer 1: Full-brightness hero image ── */}
      <img
        src="/hero-holidays.png"
        alt="My Digital Holidays"
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "top center",
          userSelect: "none", pointerEvents: "none",
        }}
      />

      {/* ── Layer 2: Dark overlay ── */}
      <motion.div
        animate={{ opacity: darkOpacity }}
        transition={darkTransition}
        style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none" }}
      />

      {/* ── Layer 3a: Garland glow ── */}
      <motion.div
        animate={{ opacity: isLighting ? GARLAND_KF : 0 }}
        transition={isLighting ? lightTrans(GARLAND_T) : { duration: 0.05 }}
        style={{
          position: "absolute", inset: 0, mixBlendMode: "screen", pointerEvents: "none",
          background:
            "radial-gradient(ellipse 130% 55% at 50% 0%, " +
            "rgba(255,230,110,0.95) 0%, rgba(255,170,50,0.65) 22%, " +
            "rgba(255,100,20,0.25) 52%, transparent 78%)",
        }}
      />

      {/* ── Layer 3b: Candle glow ── */}
      <motion.div
        animate={{ opacity: isLighting ? CANDLE_KF : 0 }}
        transition={isLighting ? lightTrans(CANDLE_T) : { duration: 0.05 }}
        style={{
          position: "absolute", inset: 0, mixBlendMode: "screen", pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 50% at 7% 88%, " +
            "rgba(255,160,50,0.95) 0%, rgba(255,100,20,0.55) 28%, " +
            "rgba(200,60,10,0.20) 58%, transparent 80%)",
        }}
      />

      {/* ── Layer 4a: Hero phase — bottom gradient + branding (Phase 1) ── */}
      <motion.div
        animate={{ opacity: isHero ? 1 : 0 }}
        transition={{ duration: HERO_FADE_MS / 1000 }}
        style={{
          position: "absolute", inset: 0, zIndex: 11,
          pointerEvents: "none",
        }}
      >
        {/* Readability gradient over lower portion */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "55%",
          background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.40) 50%, transparent 100%)",
          pointerEvents: "none",
        }} />
        {/* Branding near bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "0 32px",
          paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
        }}>
          <Branding light />
        </div>
      </motion.div>

      {/* ── Layer 4b: Idle/interactive content (Phase 2 & 3) ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-end",
        pointerEvents: "none",
      }}>
        <div style={{
          width: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 0,
          padding: "0 32px",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
        }}>
          {/* Branding */}
          <motion.div
            animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 6 }}
            transition={{ duration: 0.28 }}
            style={{ marginBottom: 24, pointerEvents: "none" }}
          >
            <Branding />
          </motion.div>

          {/* Switch + hint */}
          <motion.div
            animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 10 }}
            transition={{ duration: 0.2 }}
            style={{
              pointerEvents: showUI ? "auto" : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            }}
          >
            <LightSwitch onFlip={handleFlip} disabled={!isIdle} />

            <motion.p
              animate={isIdle ? { opacity: [0.4, 0.8, 0.4] } : { opacity: 0 }}
              transition={isIdle
                ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.15 }
              }
              style={{
                margin: 0,
                fontSize: 11, fontWeight: 500,
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: "rgba(255,225,170,0.75)",
                pointerEvents: "none",
              }}
            >
              Tap to open
            </motion.p>
          </motion.div>

          {/* Legal links */}
          <motion.div
            animate={{ opacity: isIdle ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: "flex", gap: 16, marginTop: 16, pointerEvents: isIdle ? "auto" : "none" }}
          >
            <a
              href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
            >Privacy Policy</a>
            <a
              href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
            >Support</a>
          </motion.div>
        </div>
      </div>

      {/* ── Layer 5: Exit fade ── */}
      <motion.div
        animate={{ opacity: phase === "exiting" ? 1 : 0 }}
        transition={{ duration: EXIT_FADE_MS / 1000, ease: "easeIn" }}
        style={{
          position: "absolute", inset: 0, zIndex: 20,
          background: "#0E0804", pointerEvents: "none",
        }}
      />
    </div>
  );
}
