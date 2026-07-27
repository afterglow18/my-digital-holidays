/**
 * WelcomePage — static hero splash screen.
 *
 * Tapping "Start Packing ✨" fades the screen out then calls onEnter().
 * No suitcase animation.
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [exiting, setExiting] = useState(false);
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(finish, 550);
  };

  return (
    <motion.div
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.55, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        background: "#0E0804",
        overflow: "hidden",
      }}
    >
      {/* ── Hero image — fills the top portion of the screen ── */}
      <div style={{
        flex: 1,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        minHeight: 0,
      }}>
        <img
          src="/hero-holidays.png"
          alt="My Digital Holidays"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Bottom action area ── */}
      <div style={{
        flexShrink: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "20px 32px",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
        background: "linear-gradient(to bottom, transparent, #0E0804 28%)",
        marginTop: -60,
        position: "relative",
        zIndex: 2,
      }}>
        <motion.button
          onClick={handleOpen}
          animate={{ opacity: exiting ? 0 : 1, y: exiting ? 8 : 0 }}
          transition={{ duration: 0.2 }}
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
            pointerEvents: exiting ? "none" : "auto",
            width: "100%",
            maxWidth: 320,
          }}
        >
          Start Packing ✨
        </motion.button>

        {/* Legal links */}
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
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
        </div>
      </div>
    </motion.div>
  );
}
