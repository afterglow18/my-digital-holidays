/**
 * WelcomePage — cinematic lights-on splash screen.
 *
 * Phases:
 *   idle      — hero image hidden behind a near-black overlay; "Open Holidays" button visible
 *   lighting  — 3 rapid warm-light flickers, then dark overlay fades away revealing the scene
 *   lit       — full image holds for a beat (~300 ms)
 *   exiting   — fade to black → calls onEnter()
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "idle" | "lighting" | "lit" | "exiting";

// ── Timing (ms) ───────────────────────────────────────────────────────────────
const LIGHT_DURATION_MS = 1900; // dark overlay flicker + fade
const LIT_HOLD_MS       =  250; // pause at full brightness
const EXIT_FADE_MS      =  500; // fade-to-black duration
const TOTAL_MS          = LIGHT_DURATION_MS + LIT_HOLD_MS + EXIT_FADE_MS + 80;

// ── Keyframe arrays ───────────────────────────────────────────────────────────
// Dark overlay: starts opaque, flickers 3× in first ~35% then smooth fade to 0
const DARK_KF   = [0.97, 0.62, 0.97, 0.42, 0.97, 0.28, 0.10, 0];
const DARK_T    = [0,    0.07, 0.14, 0.21, 0.29, 0.50, 0.72, 1.0];

// Garland glow (top arc): warm golden, flickers with the dark overlay
const GARLAND_KF = [0, 0.90, 0.05, 0.95, 0.10, 0.70, 0.20, 0];
const GARLAND_T  = [0, 0.07, 0.14, 0.21, 0.29, 0.50, 0.72, 1.0];

// Candle glow (bottom-left): slightly delayed and warmer amber
const CANDLE_KF = [0, 0, 0.60, 0.05, 0.80, 0.15, 0.50, 0];
const CANDLE_T  = [0, 0.07, 0.14, 0.21, 0.29, 0.50, 0.72, 1.0];

// ── Framer transition for lighting phase ──────────────────────────────────────
const lightTrans = (kfTimes: number[]) => ({
  duration: LIGHT_DURATION_MS / 1000,
  times:    kfTimes,
  ease:     "linear" as const,
});

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("lighting");

    setTimeout(() => setPhase("lit"),     LIGHT_DURATION_MS);
    setTimeout(() => setPhase("exiting"), LIGHT_DURATION_MS + LIT_HOLD_MS);
    setTimeout(finish,                    TOTAL_MS);
  };

  const isLighting = phase === "lighting";
  const isIdle     = phase === "idle";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* ── Layer 1: Full-brightness hero image (always rendered) ── */}
      <img
        src="/hero-holidays.png"
        alt="My Digital Holidays"
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* ── Layer 2: Dark overlay — near-black → flickers → fades to 0 ── */}
      <motion.div
        animate={{
          opacity: isLighting ? DARK_KF : isIdle ? 0.97 : 0,
        }}
        transition={isLighting ? lightTrans(DARK_T) : { duration: 0.05 }}
        style={{
          position: "absolute", inset: 0,
          background: "#000",
          pointerEvents: "none",
        }}
      />

      {/* ── Layer 3a: Garland / string-light glow (top arc) ── */}
      <motion.div
        animate={{ opacity: isLighting ? GARLAND_KF : 0 }}
        transition={isLighting ? lightTrans(GARLAND_T) : { duration: 0.05 }}
        style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(ellipse 130% 55% at 50% 0%, " +
            "rgba(255,230,110,0.95) 0%, " +
            "rgba(255,170,50,0.65) 22%, " +
            "rgba(255,100,20,0.25) 52%, " +
            "transparent 78%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* ── Layer 3b: Candle / fireplace glow (bottom-left) ── */}
      <motion.div
        animate={{ opacity: isLighting ? CANDLE_KF : 0 }}
        transition={isLighting ? lightTrans(CANDLE_T) : { duration: 0.05 }}
        style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 7% 88%, " +
            "rgba(255,160,50,0.95) 0%, " +
            "rgba(255,100,20,0.55) 28%, " +
            "rgba(200,60,10,0.20) 58%, " +
            "transparent 80%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* ── Layer 4: Content — button + legal links ── */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          padding: "0 32px",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
          zIndex: 10,
        }}
      >
        <motion.button
          onClick={handleOpen}
          animate={{ opacity: isIdle ? 1 : 0, y: isIdle ? 0 : 8 }}
          transition={{ duration: 0.18 }}
          style={{
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800, fontSize: 16,
            letterSpacing: "0.03em",
            color: "#3A2210",
            background: "linear-gradient(to bottom, #E8D4B0, #B8894E)",
            border: "1.5px solid #B8894E",
            borderRadius: 100,
            padding: "14px 48px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(120,80,40,0.45), 2px 2px 0 rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
            pointerEvents: isIdle ? "auto" : "none",
            width: "100%",
            maxWidth: 320,
          }}
        >
          Open Holidays ✨
        </motion.button>

        <motion.div
          animate={{ opacity: isIdle ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ display: "flex", gap: 16, marginTop: 14 }}
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

      {/* ── Layer 5: Exit fade — black overlay that fades in during "exiting" ── */}
      <motion.div
        animate={{ opacity: phase === "exiting" ? 1 : 0 }}
        transition={{ duration: EXIT_FADE_MS / 1000, ease: "easeIn" }}
        style={{
          position: "absolute", inset: 0,
          background: "#0E0804",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />
    </div>
  );
}
