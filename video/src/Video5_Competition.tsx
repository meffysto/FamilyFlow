import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
  AbsoluteFill,
  Sequence,
  Img,
  Audio,
  staticFile,
} from "remotion";
import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily: FONT } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

// ── Colors — Bold, competitive, sporty ──
const C = {
  white: "#FFFFFF",
  purple: "#7C3AED",
  purpleDark: "#5B21B6",
  purpleLight: "#EDE9FE",
  gold: "#FFD700",
  goldDark: "#B8860B",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  red: "#EF4444",
  redLight: "#FEE2E2",
  green: "#10B981",
  blue: "#3B82F6",
  dark: "#111827",
  darker: "#030712",
  muted: "#6B7280",
  card: "#FFFFFF",
  border: "#E5E7EB",
  gray: "#F3F4F6",
};

// ── Helpers ──
function spr(
  frame: number,
  fps: number,
  cfg: Record<string, number> = { damping: 200 },
  delay = 0,
) {
  return spring({ frame: frame - delay, fps, config: cfg as any });
}

function tw(text: string, frame: number, startFrame = 0, speed = 1.5) {
  const chars = Math.floor(Math.max(0, frame - startFrame) * speed);
  return text.slice(0, chars);
}

// ── SceneFade ──
function SceneFade({
  children,
  fadeIn = 5,
  fadeOut = 5,
}: {
  children: React.ReactNode;
  fadeIn?: number;
  fadeOut?: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const safeIn = Math.min(fadeIn, durationInFrames - 2);
  const safeEnd = Math.max(durationInFrames - fadeOut, safeIn + 1);
  const safeDur = Math.max(safeEnd + 1, durationInFrames);
  const opacity = interpolate(
    frame,
    [0, safeIn, safeEnd, safeDur],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

// ── App Icon ──
function AppIcon({ size = 120, scale = 1 }: { size?: number; scale?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        overflow: "hidden",
        transform: `scale(${scale})`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
      }}
    >
      <Img
        src={staticFile("icon.png")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

// ── iPhone Mockup ──
function IPhone({
  children,
  style = {},
  screenBg = C.gray,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  screenBg?: string;
}) {
  return (
    <div
      style={{
        width: 380,
        height: 780,
        background: "#1A1A1A",
        borderRadius: 40,
        padding: 8,
        boxShadow: "0 0 0 2px #2A2A2A, 0 24px 64px rgba(0,0,0,0.45)",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -3,
          top: 84,
          width: 3,
          height: 50,
          background: "#2A2A2A",
          borderRadius: "0 3px 3px 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: 75,
          width: 3,
          height: 23,
          background: "#2A2A2A",
          borderRadius: "3px 0 0 3px",
          boxShadow: "0 33px 0 #2A2A2A, 0 60px 0 #2A2A2A",
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          background: screenBg,
          borderRadius: 34,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 24,
            background: "#000",
            borderRadius: 14,
            zIndex: 10,
          }}
        />
        {children}
      </div>
    </div>
  );
}

// ── Status Bar (dark variant) ──
function StatusBar({ light = false }: { light?: boolean }) {
  const col = light ? C.white : C.dark;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 18px 0",
        height: 44,
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: col }}>9:41</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {[1, 0.7, 0.4].map((o, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 10 + i * 2,
                background: col,
                opacity: o,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
        <div
          style={{
            width: 20,
            height: 10,
            border: `1.5px solid ${col}`,
            borderRadius: 2,
            padding: 1.5,
          }}
        >
          <div
            style={{
              width: "75%",
              height: "100%",
              background: col,
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Card ──
function Card({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        fontFamily: FONT,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── XPBar ──
function XPBar({ fill, color }: { fill: number; color: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: 5,
        background: C.border,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${fill}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE SLOGAN: Opening French tagline (0-75)
// ══════════════════════════════════════════════════════════
function SceneSlogan() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Text = "Le second cerveau";
  const line1Typed = tw(line1Text, frame, 8, 1.8);

  // Cursor blink
  const cursorVisible = Math.floor(frame / 8) % 2 === 0;
  const showCursor = frame < 55;

  // Line 2 fade in with spring
  const line2Spring = spr(frame, fps, { damping: 14, stiffness: 180 }, 32);
  const line2Op = interpolate(line2Spring, [0, 1], [0, 1]);
  const line2Y = interpolate(line2Spring, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        background: C.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {/* Line 1: typewriter */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 800,
          color: C.dark,
          letterSpacing: -1.5,
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {line1Typed}
        {showCursor && (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: 48,
              background: C.purple,
              marginLeft: 2,
              opacity: cursorVisible ? 1 : 0,
              borderRadius: 2,
            }}
          />
        )}
      </div>

      {/* Line 2: spring fade-in */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 38,
          fontWeight: 600,
          color: C.purple,
          letterSpacing: -0.5,
          textAlign: "center",
          opacity: line2Op,
          transform: `translateY(${line2Y}px)`,
        }}
      >
        que votre famille m&eacute;rite
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE 1: Dramatic Opening (shifted to start at 70)
// ══════════════════════════════════════════════════════════
function Scene1_Opening() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background pulse
  const pulse = interpolate(
    frame,
    [0, 20, 40, 60, 80],
    [0, 0.06, 0, 0.04, 0],
    { extrapolateRight: "clamp" },
  );

  // "QUI SERA" slams in
  const line1Scale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 300 },
  });
  const line1S = interpolate(line1Scale, [0, 1], [3, 1]);
  const line1Op = interpolate(line1Scale, [0, 1], [0, 1]);

  // "LE CHAMPION ?" delayed
  const line2Scale = spring({
    frame: frame - 12,
    fps,
    config: { damping: 8, stiffness: 280 },
  });
  const line2S = interpolate(line2Scale, [0, 1], [3, 1]);
  const line2Op = interpolate(line2Scale, [0, 1], [0, 1]);

  // Gold line expands
  const lineW = interpolate(frame, [25, 55], [0, 400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Sparkles
  const sparkles = [
    { x: 200, y: 600, delay: 30 },
    { x: 820, y: 650, delay: 38 },
    { x: 350, y: 750, delay: 44 },
    { x: 680, y: 580, delay: 50 },
    { x: 500, y: 800, delay: 56 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `rgb(${3 + pulse * 255}, ${7 + pulse * 255}, ${18 + pulse * 255})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {/* Sparkles */}
      {sparkles.map((s, i) => {
        const sparkOp = interpolate(
          frame,
          [s.delay, s.delay + 5, s.delay + 10, s.delay + 18],
          [0, 1, 0.6, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const sparkScale = interpolate(
          frame,
          [s.delay, s.delay + 8],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.gold,
              opacity: sparkOp,
              transform: `scale(${sparkScale})`,
              boxShadow: `0 0 12px ${C.gold}`,
            }}
          />
        );
      })}

      {/* QUI SERA */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 72,
          fontWeight: 800,
          color: C.white,
          letterSpacing: -2,
          opacity: line1Op,
          transform: `scale(${line1S})`,
          textAlign: "center",
        }}
      >
        QUI SERA
      </div>

      {/* LE CHAMPION ? */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 78,
          fontWeight: 800,
          color: C.gold,
          letterSpacing: -2,
          opacity: line2Op,
          transform: `scale(${line2S})`,
          textAlign: "center",
          textShadow: `0 0 40px rgba(255, 215, 0, 0.4)`,
        }}
      >
        LE CHAMPION ?
      </div>

      {/* Gold line */}
      <div
        style={{
          width: lineW,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
          marginTop: 12,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE 2: The Leaderboard Reveal
// ══════════════════════════════════════════════════════════
function Scene2_Leaderboard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slides up
  const phoneY = interpolate(
    spr(frame, fps, { damping: 12, stiffness: 200 }),
    [0, 1],
    [400, 0],
  );

  const entries = [
    {
      rank: "\uD83E\uDD47",
      name: "Lucas",
      color: C.blue,
      pts: "1 247 pts",
      streak: "\uD83D\uDD25 12 jours",
      highlight: C.gold,
      xp: 92,
      delay: 30,
    },
    {
      rank: "\uD83E\uDD48",
      name: "Emma",
      color: "#EC4899",
      pts: "1 189 pts",
      streak: "\uD83D\uDD25 8 jours",
      highlight: C.silver,
      xp: 85,
      delay: 60,
    },
    {
      rank: "\uD83E\uDD49",
      name: "Maman",
      color: C.green,
      pts: "983 pts",
      streak: "\uD83D\uDD25 3 jours",
      highlight: C.bronze,
      xp: 68,
      delay: 90,
    },
    {
      rank: "4.",
      name: "Papa",
      color: "#F97316",
      pts: "876 pts",
      streak: "",
      highlight: "transparent",
      xp: 55,
      delay: 120,
    },
  ];

  // Gap text
  const gapOp = interpolate(frame, [140, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: C.darker,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ transform: `translateY(${phoneY}px)` }}>
        <IPhone screenBg="#0F0A1E">
          <StatusBar light />
          <div
            style={{
              padding: "8px 16px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Header */}
            <div
              style={{
                background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
                borderRadius: 14,
                padding: "14px 16px",
                marginTop: 6,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 17,
                  fontWeight: 800,
                  color: C.white,
                  letterSpacing: -0.3,
                }}
              >
                Classement Familial \uD83C\uDFC6
              </div>
            </div>

            {/* Entries */}
            {entries.map((e, i) => {
              const entrySpring = spr(
                frame,
                fps,
                { damping: 10, stiffness: 300 },
                e.delay,
              );
              const entryX = interpolate(entrySpring, [0, 1], [500, 0]);
              const entryOp = interpolate(entrySpring, [0, 1], [0, 1]);
              const xpFill = interpolate(entrySpring, [0, 1], [0, e.xp]);

              return (
                <div
                  key={i}
                  style={{
                    opacity: entryOp,
                    transform: `translateX(${entryX}px)`,
                  }}
                >
                  <div
                    style={{
                      background:
                        e.highlight !== "transparent"
                          ? `rgba(${e.highlight === C.gold ? "255,215,0" : e.highlight === C.silver ? "192,192,192" : "205,127,50"},0.1)`
                          : "rgba(255,255,255,0.04)",
                      border:
                        e.highlight !== "transparent"
                          ? `1px solid ${e.highlight}33`
                          : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {/* Rank */}
                      <span style={{ fontSize: 22, minWidth: 30 }}>
                        {e.rank}
                      </span>
                      {/* Avatar */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: e.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: C.white,
                          fontFamily: FONT,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {e.name[0]}
                      </div>
                      {/* Name + pts */}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: FONT,
                            fontSize: 14,
                            fontWeight: 700,
                            color: C.white,
                          }}
                        >
                          {e.name}
                        </div>
                        <div
                          style={{
                            fontFamily: FONT,
                            fontSize: 11,
                            fontWeight: 600,
                            color: C.muted,
                          }}
                        >
                          {e.pts}
                        </div>
                      </div>
                      {/* Streak */}
                      {e.streak && (
                        <div
                          style={{
                            fontFamily: FONT,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#F59E0B",
                            background: "rgba(245,158,11,0.15)",
                            padding: "3px 8px",
                            borderRadius: 8,
                          }}
                        >
                          {e.streak}
                        </div>
                      )}
                    </div>
                    <XPBar fill={xpFill} color={e.color} />
                  </div>
                </div>
              );
            })}

            {/* Gap indicator */}
            <div
              style={{
                opacity: gapOp,
                textAlign: "center",
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
                color: "#F59E0B",
                background: "rgba(245,158,11,0.1)",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              {"\u2195"} {"\u00C9"}cart : 58 pts
            </div>
          </div>
        </IPhone>
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE 3: The Chase — Emma Scores!
// ══════════════════════════════════════════════════════════
function Scene3_Chase() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // LIVE badge pulse
  const livePulse =
    0.6 + 0.4 * Math.sin(frame * 0.3);

  // Task completion appears
  const taskOp = interpolate(frame, [30, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taskY = interpolate(
    spr(frame, fps, { damping: 12, stiffness: 250 }, 30),
    [0, 1],
    [30, 0],
  );

  // Points fly animation
  const pts1Op = interpolate(frame, [55, 60, 75, 85], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pts1Y = interpolate(frame, [55, 85], [0, -50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pts2Op = interpolate(frame, [65, 70, 85, 95], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pts2Y = interpolate(frame, [65, 95], [0, -50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Score animation
  const scoreValue = interpolate(frame, [70, 100], [1189, 1209], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Emma row flash
  const rowFlash = interpolate(
    frame,
    [80, 90, 100, 110],
    [0, 0.3, 0, 0.15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Gap updates
  const gapValue = interpolate(frame, [90, 110], [58, 38], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Streak update
  const streakUpdate = spr(frame, fps, { damping: 10, stiffness: 300 }, 120);
  const streakScale = interpolate(streakUpdate, [0, 1], [1.5, 1]);
  const streakOp = interpolate(frame, [115, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: C.darker,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IPhone screenBg="#0F0A1E">
        <StatusBar light />
        <div
          style={{
            padding: "8px 16px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Header with LIVE badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 17,
                fontWeight: 800,
                color: C.white,
              }}
            >
              Classement Familial {"\uD83C\uDFC6"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(239,68,68,0.15)",
                padding: "4px 10px",
                borderRadius: 8,
                border: `1px solid ${C.red}44`,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: C.red,
                  opacity: livePulse,
                  boxShadow: `0 0 8px ${C.red}`,
                }}
              />
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.red,
                  letterSpacing: 1,
                }}
              >
                EN DIRECT
              </span>
            </div>
          </div>

          {/* Lucas row (static leader) */}
          <div
            style={{
              background: "rgba(255,215,0,0.08)",
              border: `1px solid ${C.gold}33`,
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>{"\uD83E\uDD47"}</span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: C.blue,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.white,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              L
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.white,
                }}
              >
                Lucas
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.muted,
                }}
              >
                1 247 pts
              </div>
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: "#F59E0B",
                background: "rgba(245,158,11,0.15)",
                padding: "3px 8px",
                borderRadius: 8,
              }}
            >
              {"\uD83D\uDD25"} 12 jours
            </div>
          </div>

          {/* Emma row (highlighted, animated) */}
          <div
            style={{
              position: "relative",
              background: `rgba(192,192,192,${0.08 + rowFlash})`,
              border: `1px solid ${C.silver}55`,
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow:
                rowFlash > 0 ? `0 0 20px rgba(236,72,153,${rowFlash})` : "none",
            }}
          >
            <span style={{ fontSize: 22 }}>{"\uD83E\uDD48"}</span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#EC4899",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.white,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              E
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.white,
                }}
              >
                Emma
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#EC4899",
                }}
              >
                {Math.round(scoreValue).toLocaleString("fr-FR")} pts
              </div>
            </div>

            {/* Streak badge update */}
            <div
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: "#F59E0B",
                background: "rgba(245,158,11,0.15)",
                padding: "3px 8px",
                borderRadius: 8,
                opacity: frame < 115 ? 1 : streakOp,
                transform: frame >= 115 ? `scale(${streakScale})` : "none",
              }}
            >
              {frame < 120 ? "\uD83D\uDD25 8 jours" : "\uD83D\uDD25 9 jours !"}
            </div>

            {/* Flying points */}
            <div
              style={{
                position: "absolute",
                right: 80,
                top: -10,
                opacity: pts1Op,
                transform: `translateY(${pts1Y}px)`,
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 800,
                color: C.green,
              }}
            >
              +10
            </div>
            <div
              style={{
                position: "absolute",
                right: 40,
                top: -5,
                opacity: pts2Op,
                transform: `translateY(${pts2Y}px)`,
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 700,
                color: C.gold,
              }}
            >
              +10 {"\u2728"}
            </div>
          </div>

          {/* Task completion notification */}
          <div
            style={{
              opacity: taskOp,
              transform: `translateY(${taskY}px)`,
              background: "rgba(16,185,129,0.1)",
              border: `1px solid ${C.green}44`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{"\u2705"}</span>
            <div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                Emma a termin{"\u00E9"} :
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.white,
                }}
              >
                Ranger le salon {"\u2714"}
              </div>
            </div>
          </div>

          {/* Gap indicator — updating */}
          <div
            style={{
              textAlign: "center",
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 700,
              color: "#F59E0B",
              background: "rgba(245,158,11,0.1)",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            {"\u2195"} {"\u00C9"}cart : {Math.round(gapValue)} pts
            {frame > 100 && (
              <span style={{ color: C.green, marginLeft: 6, fontSize: 11 }}>
                {"\u2193"} en baisse !
              </span>
            )}
          </div>
        </div>
      </IPhone>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE 4: Badge Unlocking Cascade
// ══════════════════════════════════════════════════════════
function Scene4_Badges() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badges = [
    { emoji: "\uD83D\uDC3B", name: "Badge Ourson", ring: C.gold, desc: "Premier compagnon", delay: 10 },
    { emoji: "\uD83E\uDD8B", name: "Badge Papillon", ring: C.blue, desc: "Transformation", delay: 22 },
    { emoji: "\uD83E\uDD84", name: "Badge Licorne Rare", ring: "#EC4899", desc: "Ultra rare !", delay: 34 },
    { emoji: "\uD83D\uDC09", name: "Badge Dragon", ring: C.red, desc: "Puissance max", delay: 46 },
    { emoji: "\uD83C\uDFC6", name: "Badge Troph\u00E9e d'Or", ring: C.gold, desc: "+5 XP bonus", delay: 58 },
    { emoji: "\uD83D\uDC51", name: "Badge Couronne Royale", ring: C.gold, desc: "+10 XP bonus", delay: 80, legendary: true as const },
  ];

  // Legendary glow ring
  const legendaryGlow = interpolate(
    frame,
    [85, 95, 110, 130],
    [0, 1, 0.6, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const glowScale = interpolate(frame, [85, 130], [1, 2.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: C.darker,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IPhone screenBg="#0F0A1E">
        <StatusBar light />
        <div
          style={{
            padding: "8px 16px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
              borderRadius: 14,
              padding: "14px 16px",
              marginTop: 6,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 17,
                fontWeight: 800,
                color: C.white,
              }}
            >
              Badges D{"\u00E9"}bloqu{"\u00E9"}s {"\uD83C\uDFC5"}
            </div>
          </div>

          {/* 3x2 Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              padding: "8px 0",
            }}
          >
            {badges.map((b, i) => {
              const isLegendary = "legendary" in b && b.legendary;
              const badgeSpring = spr(
                frame,
                fps,
                {
                  damping: isLegendary ? 6 : 10,
                  stiffness: isLegendary ? 400 : 280,
                },
                b.delay,
              );
              const badgeScale = interpolate(
                badgeSpring,
                [0, 1],
                [isLegendary ? 4 : 0, 1],
              );
              const badgeOp = interpolate(badgeSpring, [0, 1], [0, 1]);

              // Legendary pulse
              const legendaryPulse = isLegendary
                ? 1 + 0.04 * Math.sin((frame - 90) * 0.2)
                : 1;

              return (
                <div
                  key={i}
                  style={{
                    opacity: badgeOp,
                    transform: `scale(${badgeScale * legendaryPulse})`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    position: "relative",
                  }}
                >
                  {/* Legendary glow ring */}
                  {isLegendary && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: 80,
                        height: 80,
                        marginTop: -25,
                        marginLeft: -40,
                        borderRadius: "50%",
                        border: `2px solid ${C.gold}`,
                        opacity: legendaryGlow * 0.5,
                        transform: `scale(${glowScale})`,
                        boxShadow: `0 0 30px ${C.gold}66`,
                      }}
                    />
                  )}
                  {/* Badge circle */}
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: "50%",
                      border: `3px solid ${b.ring}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      background: `${b.ring}15`,
                      boxShadow: isLegendary
                        ? `0 0 24px ${C.gold}44`
                        : `0 0 12px ${b.ring}22`,
                    }}
                  >
                    {b.emoji}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      fontWeight: 700,
                      color: isLegendary ? C.gold : C.white,
                      textAlign: "center",
                      textShadow: isLegendary
                        ? `0 0 10px ${C.gold}66`
                        : "none",
                    }}
                  >
                    {b.name}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 9,
                      fontWeight: 500,
                      color: C.muted,
                      textAlign: "center",
                    }}
                  >
                    {b.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legendary particle burst */}
          {frame > 85 &&
            Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const dist = interpolate(frame, [85, 110], [0, 80], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const pOp = interpolate(frame, [85, 95, 115], [0, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 250 + Math.cos(angle) * dist + 140,
                    top: 650 + Math.sin(angle) * dist,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: C.gold,
                    opacity: pOp,
                    boxShadow: `0 0 8px ${C.gold}`,
                  }}
                />
              );
            })}
        </div>
      </IPhone>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE 5: Weekly Stats Showdown + Challenge
// ══════════════════════════════════════════════════════════
function Scene5_Stats() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bars = [
    { name: "Lucas", color: C.purple, tasks: 47, maxH: 220, delay: 15 },
    { name: "Emma", color: "#EC4899", tasks: 42, maxH: 196, delay: 25 },
    { name: "Maman", color: C.green, tasks: 35, maxH: 164, delay: 35 },
    { name: "Papa", color: "#F97316", tasks: 28, maxH: 131, delay: 45 },
  ];

  // Total stat
  const totalSpring = spr(frame, fps, { damping: 12, stiffness: 200 }, 80);
  const totalScale = interpolate(totalSpring, [0, 1], [0.3, 1]);
  const totalOp = interpolate(totalSpring, [0, 1], [0, 1]);

  // Record text
  const recordOp = interpolate(frame, [100, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowY = interpolate(
    frame,
    [100, 115, 130, 145],
    [10, 0, -3, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Challenge card spring
  const challengeSpring = spr(frame, fps, { damping: 10, stiffness: 200 }, 115);
  const challengeScale = interpolate(challengeSpring, [0, 1], [0.8, 1]);
  const challengeOp = interpolate(challengeSpring, [0, 1], [0, 1]);

  // Challenge progress bar animation
  const progressFill = interpolate(
    spr(frame, fps, { damping: 14, stiffness: 150 }, 125),
    [0, 1],
    [0, 71],
  );

  // Confetti
  const confettiStart = 110;
  const confettiColors = [
    C.gold,
    C.purple,
    "#EC4899",
    C.green,
    C.blue,
    C.red,
    "#F97316",
  ];

  return (
    <AbsoluteFill
      style={{
        background: C.darker,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IPhone screenBg="#0F0A1E">
        <StatusBar light />
        <div
          style={{
            padding: "8px 16px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`,
              borderRadius: 14,
              padding: "12px 16px",
              marginTop: 6,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 800,
                color: C.white,
              }}
            >
              Cette semaine
            </div>
          </div>

          {/* Bar chart */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 20,
              height: 260,
              padding: "16px 8px 0",
            }}
          >
            {bars.map((b, i) => {
              const barSpring = spr(
                frame,
                fps,
                { damping: 12, stiffness: 200 },
                b.delay,
              );
              const barH = interpolate(barSpring, [0, 1], [0, b.maxH]);
              const labelOp = interpolate(barSpring, [0.6, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {/* Task count label */}
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      fontWeight: 700,
                      color: b.color,
                      opacity: labelOp,
                    }}
                  >
                    {b.tasks}
                  </div>
                  {/* Bar */}
                  <div
                    style={{
                      width: 50,
                      height: barH,
                      background: `linear-gradient(180deg, ${b.color}, ${b.color}88)`,
                      borderRadius: "8px 8px 4px 4px",
                      boxShadow: `0 0 16px ${b.color}33`,
                    }}
                  />
                  {/* Name */}
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.muted,
                    }}
                  >
                    {b.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total stat */}
          <div
            style={{
              opacity: totalOp,
              transform: `scale(${totalScale})`,
              textAlign: "center",
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 800,
              color: C.white,
              background: "rgba(124,58,237,0.15)",
              padding: "8px 14px",
              borderRadius: 12,
              border: `1px solid ${C.purple}44`,
            }}
          >
            152 t{"\u00E2"}ches cette semaine ! {"\uD83C\uDF89"}
          </div>

          {/* Record */}
          <div
            style={{
              opacity: recordOp,
              transform: `translateY(${arrowY}px)`,
              textAlign: "center",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              color: C.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 14 }}>{"\u2191"}</span>
            Record battu ! +12% vs semaine derni{"\u00E8"}re
          </div>

          {/* Challenge Card */}
          <div
            style={{
              opacity: challengeOp,
              transform: `scale(${challengeScale})`,
              position: "relative",
              borderRadius: 14,
              padding: 2,
              background: `linear-gradient(135deg, ${C.purple}, ${C.gold})`,
            }}
          >
            <div
              style={{
                background: "#0F0A1E",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Challenge title */}
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 800,
                  color: C.gold,
                  letterSpacing: 0.5,
                }}
              >
                {"\uD83C\uDFC6"} D{"\u00C9"}FI DE LA SEMAINE
              </div>
              {/* Challenge text */}
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 16,
                  fontWeight: 800,
                  color: C.white,
                }}
              >
                7 jours sans {"\u00E9"}crans
              </div>
              {/* Progress bar */}
              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressFill}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${C.purple}, ${C.gold})`,
                    borderRadius: 4,
                  }}
                />
              </div>
              {/* Progress text */}
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.muted,
                }}
              >
                Jour 5/7 — En cours ! {"\uD83D\uDD25"}
              </div>
            </div>
          </div>
        </div>
      </IPhone>

      {/* Confetti */}
      {frame > confettiStart &&
        Array.from({ length: 30 }).map((_, i) => {
          const seed = i * 137.508;
          const x = ((seed * 7.3) % 1080);
          const startY = -20 - (i % 5) * 40;
          const speed = 3 + (i % 4) * 2;
          const elapsed = frame - confettiStart;
          const y = startY + elapsed * speed;
          const rotation = elapsed * (5 + (i % 3) * 3);
          const confOp = interpolate(
            elapsed,
            [0, 10, 50, 80],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const col = confettiColors[i % confettiColors.length];
          const isCircle = i % 3 === 0;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: isCircle ? 8 : 10,
                height: isCircle ? 8 : 6,
                borderRadius: isCircle ? "50%" : 1,
                background: col,
                opacity: confOp,
                transform: `rotate(${rotation}deg)`,
              }}
            />
          );
        })}
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// SCENE 6: Competitive Closing
// ══════════════════════════════════════════════════════════
function Scene6_Closing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Trophy glow + scale
  const trophySpring = spr(
    frame,
    fps,
    { damping: 8, stiffness: 250 },
  );
  const trophyScale = interpolate(trophySpring, [0, 1], [0, 1]);
  const trophyGlow =
    0.3 + 0.2 * Math.sin(frame * 0.15);

  // Text lines
  const line1Op = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line1Y = interpolate(frame, [25, 40], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const line2Op = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Y = interpolate(frame, [45, 60], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // App icon
  const iconSpring = spr(frame, fps, { damping: 12, stiffness: 200 }, 70);
  const iconScale = interpolate(iconSpring, [0, 1], [0.5, 1]);
  const iconOp = interpolate(iconSpring, [0, 1], [0, 1]);

  // "Family Flow" text
  const nameOp = interpolate(frame, [85, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline
  const tagOp = interpolate(frame, [105, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Gold underline
  const underlineW = interpolate(frame, [115, 145], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Final fade out
  const fadeOut = interpolate(frame, [155, 175], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: C.darker,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        opacity: fadeOut,
      }}
    >
      {/* Trophy */}
      <div
        style={{
          fontSize: 100,
          transform: `scale(${trophyScale})`,
          filter: `drop-shadow(0 0 ${30 + trophyGlow * 30}px rgba(255,215,0,${trophyGlow}))`,
          marginBottom: 10,
        }}
      >
        {"\uD83C\uDFC6"}
      </div>

      {/* Line 1 */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 42,
          fontWeight: 700,
          color: C.white,
          opacity: line1Op,
          transform: `translateY(${line1Y}px)`,
          textAlign: "center",
          letterSpacing: -1,
        }}
      >
        La famille qui s'organise...
      </div>

      {/* Line 2 */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 46,
          fontWeight: 800,
          color: C.gold,
          opacity: line2Op,
          transform: `translateY(${line2Y}px)`,
          textAlign: "center",
          letterSpacing: -1,
          textShadow: `0 0 30px rgba(255,215,0,0.3)`,
        }}
      >
        ...est celle qui gagne.
      </div>

      {/* App icon */}
      <div
        style={{
          marginTop: 30,
          opacity: iconOp,
          transform: `scale(${iconScale})`,
        }}
      >
        <AppIcon size={100} />
      </div>

      {/* App name */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: 700,
          color: C.white,
          opacity: nameOp,
          letterSpacing: -0.5,
        }}
      >
        Family Flow
      </div>

      {/* Tagline + gold underline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: tagOp,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 500,
            color: C.muted,
            letterSpacing: 0.5,
          }}
        >
          Ensemble, on est plus forts
        </div>
        <div
          style={{
            width: underlineW,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ══════════════════════════════════════════════════════════
export const Video5_Competition: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.darker }}>
      <Audio src={staticFile("music-epic.mp3")} volume={0.6} />

      {/* Scene Slogan: French tagline (0-75) */}
      <Sequence from={0} durationInFrames={75}>
        <SceneFade fadeIn={3} fadeOut={5}>
          <SceneSlogan />
        </SceneFade>
      </Sequence>

      {/* Scene 1: Dramatic Opening (70-150) */}
      <Sequence from={70} durationInFrames={80}>
        <SceneFade fadeIn={3} fadeOut={5}>
          <Scene1_Opening />
        </SceneFade>
      </Sequence>

      {/* Scene 2: Leaderboard Reveal (145-290) */}
      <Sequence from={145} durationInFrames={145}>
        <SceneFade fadeIn={5} fadeOut={5}>
          <Scene2_Leaderboard />
        </SceneFade>
      </Sequence>

      {/* Scene 3: The Chase — Emma Scores (285-450) */}
      <Sequence from={285} durationInFrames={165}>
        <SceneFade fadeIn={5} fadeOut={5}>
          <Scene3_Chase />
        </SceneFade>
      </Sequence>

      {/* Scene 4: Badge Unlocking Cascade (445-600) */}
      <Sequence from={445} durationInFrames={155}>
        <SceneFade fadeIn={5} fadeOut={5}>
          <Scene4_Badges />
        </SceneFade>
      </Sequence>

      {/* Scene 5: Weekly Stats Showdown (595-760) */}
      <Sequence from={595} durationInFrames={165}>
        <SceneFade fadeIn={5} fadeOut={5}>
          <Scene5_Stats />
        </SceneFade>
      </Sequence>

      {/* Scene 6: Competitive Closing (725-900) */}
      <Sequence from={725} durationInFrames={175}>
        <SceneFade fadeIn={5} fadeOut={0}>
          <Scene6_Closing />
        </SceneFade>
      </Sequence>
    </AbsoluteFill>
  );
};
