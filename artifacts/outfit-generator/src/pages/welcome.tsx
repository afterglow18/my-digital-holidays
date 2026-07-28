/**
 * WelcomePage — cinematic lights-on splash screen.
 *
 * Phases:
 *   idle      — near-black room; light switch in OFF position
 *   switching — rocker flips to ON, brief pause before lights fire
 *   lighting  — 3 rapid warm-light flickers, dark overlay fades away
 *   lit       — full image holds for a beat (~300 ms)
 *   exiting   — fade to black → calls onEnter()
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "idle" | "switching" | "lighting" | "lit" | "exiting";

// ── Timing (ms) ───────────────────────────────────────────────────────────────
const SWITCH_FLIP_MS    =  160; // rocker animation → then lights fire
const LIGHT_DURATION_MS = 1900;
const LIT_HOLD_MS       =  250;
const EXIT_FADE_MS      =  500;
const TOTAL_MS = SWITCH_FLIP_MS + LIGHT_DURATION_MS + LIT_HOLD_MS + EXIT_FADE_MS + 80;

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

// ── LightSwitch component ─────────────────────────────────────────────────────
function LightSwitch({ onFlip, disabled }: { onFlip: () => void; disabled: boolean }) {
  const [flipped, setFlipped] = useState(false);

  const handleTap = () => {
    if (disabled || flipped) return;
    setFlipped(true);
    onFlip();
  };

  return (
    // Outer plate
    <div
      onClick={handleTap}
      role="button"
      aria-label="Turn on the lights"
      style={{
        width: 74,
        height: 122,
        borderRadius: 10,
        background: "linear-gradient(160deg, #2e2b27 0%, #1a1814 100%)",
        border: "1.5px solid #3d3830",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.75), " +
          "inset 0 1px 0 rgba(255,255,255,0.06), " +
          "inset 0 -1px 0 rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        cursor: flipped ? "default" : "pointer",
        position: "relative",
        userSelect: "none",
      }}
    >
      {/* Top screw */}
      <Screw />

      {/* Rocker — perspective wrapper needed for rotateX */}
      <div style={{ perspective: 220, perspectiveOrigin: "center center" }}>
        <motion.div
          initial={{ rotateX: -22 }}
          animate={{ rotateX: flipped ? 22 : -22 }}
          transition={{ duration: 0.13, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            width: 52,
            height: 80,
            borderRadius: 6,
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
          {/* ON / OFF label on rocker */}
          <span style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: flipped ? "rgba(60,30,5,0.7)" : "rgba(255,255,255,0.18)",
          }}>
            ENTER
          </span>
        </motion.div>
      </div>

      {/* Indicator LED */}
      <motion.div
        animate={{
          background: flipped ? "#ffcc55" : "#2a2520",
          boxShadow: flipped
            ? "0 0 6px 2px rgba(255,200,60,0.8)"
            : "none",
        }}
        transition={{ duration: 0.08 }}
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />

      {/* Bottom screw */}
      <Screw />
    </div>
  );
}

function Screw() {
  return (
    <div style={{
      width: 10, height: 10,
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 35%, #555, #222)",
      border: "1px solid #111",
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Phillips slot horizontal */}
      <div style={{
        position: "absolute", top: "45%", left: "15%",
        width: "70%", height: "10%",
        background: "rgba(0,0,0,0.55)",
        borderRadius: 1,
      }} />
      {/* Phillips slot vertical */}
      <div style={{
        position: "absolute", left: "45%", top: "15%",
        height: "70%", width: "10%",
        background: "rgba(0,0,0,0.55)",
        borderRadius: 1,
      }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleFlip = () => {
    if (phase !== "idle") return;
    setPhase("switching");

    // Let the rocker animation land, then fire lights
    setTimeout(() => {
      setPhase("lighting");
      setTimeout(() => setPhase("lit"),     LIGHT_DURATION_MS);
      setTimeout(() => setPhase("exiting"), LIGHT_DURATION_MS + LIT_HOLD_MS);
      setTimeout(finish,                    LIGHT_DURATION_MS + LIT_HOLD_MS + EXIT_FADE_MS + 80);
    }, SWITCH_FLIP_MS);
  };

  const isLighting = phase === "lighting";
  const isIdle     = phase === "idle";
  const showUI     = phase === "idle" || phase === "switching";

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
        animate={{ opacity: isLighting ? DARK_KF : showUI ? 0.97 : 0 }}
        transition={isLighting ? lightTrans(DARK_T) : { duration: 0.05 }}
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

      {/* ── Layer 4: Content ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        pointerEvents: "none",
      }}>
        {/* Welcome text */}
        <motion.div
          animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : -6 }}
          transition={{ duration: 0.22 }}
          style={{
            textAlign: "center",
            padding: "calc(14% + env(safe-area-inset-top)) 32px 0",
            pointerEvents: "none",
          }}
        >
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 400, fontSize: 13,
            letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(255,235,190,0.55)", marginBottom: 8,
          }}>
            Welcome to
          </div>
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 800, fontSize: 32,
            letterSpacing: "0.04em", lineHeight: 1.15,
            color: "rgba(255,235,190,0.90)",
            textShadow: "0 2px 24px rgba(255,180,80,0.25)",
          }}>
            My Digital<br />Holidays
          </div>
        </motion.div>

        {/* Bottom: switch + hint + legal */}
        <div style={{
          width: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 0,
          padding: "0 32px",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
        }}>
          <motion.div
            animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 10 }}
            transition={{ duration: 0.2 }}
            style={{ pointerEvents: showUI ? "auto" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
          >
            <LightSwitch onFlip={handleFlip} disabled={!isIdle} />

            {/* Tap to open — pulses while idle */}
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
