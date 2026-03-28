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

// ── Colors ──
const C = {
  white: "#FFFFFF",
  black: "#111827",
  purple: "#7C3AED",
  purpleDark: "#6D28D9",
  purpleLight: "#EDE9FE",
  green: "#10B981",
  greenDark: "#059669",
  amber: "#F59E0B",
  gold: "#FFD700",
  goldDark: "#B8860B",
  muted: "#6B7280",
  gray: "#F3F4F6",
  card: "#FFFFFF",
  border: "#E5E7EB",
  red: "#EF4444",
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
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
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
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
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
          height: 28,
          background: "#2A2A2A",
          borderRadius: "3px 0 0 3px",
          boxShadow: "0 40px 0 #2A2A2A, 0 72px 0 #2A2A2A",
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          background: C.gray,
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

// ── Status Bar ──
function StatusBar() {
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
      <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>9:41</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {[1, 0.7, 0.4].map((o, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 10 + i * 2,
                background: C.black,
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
            border: `1.5px solid ${C.black}`,
            borderRadius: 2,
            padding: 1.5,
          }}
        >
          <div style={{ width: "75%", height: "100%", background: C.black, borderRadius: 1 }} />
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

// ── XP Bar ──
function XPBar({ fill, color, glow = false }: { fill: number; color: string; glow?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: C.border,
        borderRadius: 4,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${Math.min(fill, 100)}%`,
          height: "100%",
          background: glow
            ? `linear-gradient(90deg, ${color}, ${C.purple}, ${color})`
            : color,
          borderRadius: 4,
          boxShadow: glow ? `0 0 12px ${color}, 0 0 24px ${color}44` : "none",
          transition: "width 0.1s ease-out",
        }}
      />
    </div>
  );
}

// ── Seeded random for deterministic confetti ──
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── Floating particle dot ──
function FloatingDot({
  x,
  y,
  size,
  color,
  frame,
  speed,
  amplitude,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  frame: number;
  speed: number;
  amplitude: number;
}) {
  const yOffset = Math.sin(frame * speed * 0.02) * amplitude;
  const xOffset = Math.cos(frame * speed * 0.015 + speed) * amplitude * 0.5;
  const opacity = 0.15 + Math.sin(frame * 0.03 + speed) * 0.1;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + yOffset,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity,
        transform: `translateX(${xOffset}px)`,
      }}
    />
  );
}

// ── SCENE 0: French Slogan ──
function SceneSlogan() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = tw("Le second cerveau", frame, 0, 1.2);
  const sub = spr(frame, fps, { damping: 200 }, 40);
  const subOpacity = interpolate(sub, [0, 1], [0, 1]);
  const subY = interpolate(sub, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        background: C.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 60px",
        gap: 16,
      }}
    >
      <div style={{
        fontFamily: FONT, fontSize: 54, fontWeight: 800, color: C.black,
        textAlign: "center", letterSpacing: -2, lineHeight: 1.1, minHeight: 70,
      }}>
        {line1}
        <span style={{ opacity: frame % 30 < 18 ? 1 : 0, color: C.purple }}>|</span>
      </div>
      <div style={{
        fontFamily: FONT, fontSize: 28, fontWeight: 500, color: C.muted,
        opacity: subOpacity, transform: `translateY(${subY}px)`,
      }}>
        que votre famille mérite
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 1: Morning Dashboard Greeting ──
function SceneMorning() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Living gradient animation
  const gradAngle = 135 + Math.sin(frame * 0.02) * 15;
  const bg = `linear-gradient(${gradAngle}deg, #1E3A5F 0%, #2D5986 30%, #E8A87C 65%, #F5C28E 100%)`;

  // Greeting typewriter
  const greeting = tw("Bonjour Lucas", frame, 10, 1.0);
  const waveOpacity = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const waveRotation = Math.sin(frame * 0.3) * 15;

  // Date slide in
  const dateSlide = interpolate(frame, [30, 50], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const dateOp = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle
  const subOp = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [50, 65], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Background particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: seededRandom(i * 3 + 1) * 1080,
    y: seededRandom(i * 3 + 2) * 1920,
    size: 3 + seededRandom(i * 3 + 3) * 6,
    speed: 0.5 + seededRandom(i * 5) * 2,
    amplitude: 8 + seededRandom(i * 7) * 20,
  }));

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {/* Floating dots */}
      {particles.map((p, i) => (
        <FloatingDot
          key={i}
          x={p.x}
          y={p.y}
          size={p.size}
          color="rgba(255,255,255,0.2)"
          frame={frame}
          speed={p.speed}
          amplitude={p.amplitude}
        />
      ))}

      {/* Center content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "0 80px",
          gap: 20,
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            transform: `scale(${spr(frame, fps, { damping: 10, stiffness: 180 })})`,
          }}
        >
          👦
        </div>

        {/* Greeting */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 56,
              fontWeight: 800,
              color: C.white,
              letterSpacing: -2,
              textShadow: "0 4px 20px rgba(0,0,0,0.3)",
              minHeight: 64,
            }}
          >
            {greeting}
          </span>
          <span
            style={{
              fontSize: 52,
              opacity: waveOpacity,
              transform: `rotate(${waveRotation}deg)`,
              display: "inline-block",
            }}
          >
            👋
          </span>
        </div>

        {/* Date */}
        <div
          style={{
            opacity: dateOp,
            transform: `translateX(${dateSlide}px)`,
            fontFamily: FONT,
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: 2,
          }}
        >
          Jeudi 26 mars
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subOp,
            transform: `translateY(${subY}px)`,
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: 1,
          }}
        >
          4 taches t'attendent aujourd'hui
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 2: Task Checking ──
function SceneTaskList() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneY = interpolate(spr(frame, fps, { damping: 14, stiffness: 200 }), [0, 1], [300, 0]);

  const tasks = [
    { text: "Ranger la chambre", emoji: "🛏️", delay: 20 },
    { text: "Sortir les poubelles", emoji: "🗑️", delay: 45 },
    { text: "Devoirs de maths", emoji: "📐", delay: 70 },
    { text: "Nourrir le chat", emoji: "🐱", delay: 95 },
  ];

  // Streak appears after 3rd check
  const streakDelay = 85;
  const streakSpr = spr(frame, fps, { damping: 8, stiffness: 250 }, streakDelay);
  const streakScale = interpolate(streakSpr, [0, 1], [0, 1]);
  const streakOp = interpolate(streakSpr, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: C.gray,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <div style={{ transform: `translateY(${phoneY}px)` }}>
        <IPhone>
          <StatusBar />
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Purple header */}
            <div
              style={{
                background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})`,
                padding: "8px 14px 12px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                Mes taches du jour
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 9,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 2,
                }}
              >
                Jeudi 26 mars - 4 taches
              </div>
            </div>

            {/* Task list */}
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: 1,
              }}
            >
              {tasks.map((task, i) => {
                const checkFrame = task.delay;
                const isChecked = frame >= checkFrame;
                const checkProgress = interpolate(
                  frame,
                  [checkFrame, checkFrame + 8],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );

                // Checkbox bounce
                const checkBounce = isChecked
                  ? spr(frame, fps, { damping: 8, stiffness: 300 }, checkFrame)
                  : 0;
                const checkScale = interpolate(checkBounce, [0, 1], [0.5, 1]);

                // Strikethrough progress
                const strikeW = interpolate(
                  frame,
                  [checkFrame + 4, checkFrame + 18],
                  [0, 100],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );

                // Text fade
                const textOpacity = interpolate(
                  frame,
                  [checkFrame, checkFrame + 15],
                  [1, 0.45],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );

                // Floating +10 points
                const pointsY = interpolate(
                  frame,
                  [checkFrame, checkFrame + 25],
                  [0, -45],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                const pointsOp = interpolate(
                  frame,
                  [checkFrame, checkFrame + 5, checkFrame + 20, checkFrame + 25],
                  [0, 1, 1, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );

                return (
                  <div key={i} style={{ position: "relative" }}>
                    <Card
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "11px 12px",
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          border: isChecked ? "none" : `2px solid ${C.border}`,
                          background: isChecked
                            ? C.green
                            : C.white,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transform: `scale(${isChecked ? checkScale : 1})`,
                          flexShrink: 0,
                        }}
                      >
                        {isChecked && (
                          <span
                            style={{
                              color: C.white,
                              fontSize: 14,
                              fontWeight: 800,
                              opacity: checkProgress,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Emoji */}
                      <span style={{ fontSize: 18 }}>{task.emoji}</span>

                      {/* Text with strikethrough */}
                      <div style={{ flex: 1, position: "relative" }}>
                        <span
                          style={{
                            fontFamily: FONT,
                            fontSize: 13,
                            fontWeight: 600,
                            color: C.black,
                            opacity: textOpacity,
                          }}
                        >
                          {task.text}
                        </span>
                        {isChecked && (
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: 0,
                              width: `${strikeW}%`,
                              height: 1.5,
                              background: C.muted,
                              transform: "translateY(-50%)",
                            }}
                          />
                        )}
                      </div>

                      {/* Points badge */}
                      <div
                        style={{
                          fontFamily: FONT,
                          fontSize: 10,
                          fontWeight: 600,
                          color: C.muted,
                          background: C.gray,
                          padding: "3px 7px",
                          borderRadius: 6,
                        }}
                      >
                        +10 XP
                      </div>
                    </Card>

                    {/* Floating +10 animation */}
                    {isChecked && (
                      <div
                        style={{
                          position: "absolute",
                          right: 20,
                          top: 0,
                          transform: `translateY(${pointsY}px)`,
                          opacity: pointsOp,
                          fontFamily: FONT,
                          fontSize: 20,
                          fontWeight: 800,
                          color: C.green,
                          textShadow: `0 0 10px ${C.green}44`,
                        }}
                      >
                        +10
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streak badge */}
              {frame >= streakDelay && (
                <div
                  style={{
                    alignSelf: "center",
                    background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
                    border: "2px solid #F59E0B",
                    borderRadius: 16,
                    padding: "8px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transform: `scale(${streakScale})`,
                    opacity: streakOp,
                    boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 22 }}>🔥</span>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#92400E",
                    }}
                  >
                    3 jours !
                  </span>
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                background: C.white,
                borderTop: `1px solid ${C.border}`,
                padding: "6px 0 12px",
                flexShrink: 0,
              }}
            >
              {["🏠", "📆", "🍽️", "✅", "⋯"].map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{e}</span>
                  {i === 3 && (
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: C.purple,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </IPhone>
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 3: XP Bar Filling ──
function SceneXPFill() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = interpolate(
    spr(frame, fps, { damping: 14, stiffness: 180 }),
    [0, 1],
    [0.9, 1],
  );

  // XP fill from 40% to 95%
  const xpFill = interpolate(frame, [20, 90], [40, 95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // XP number counting
  const xpNumber = Math.round(
    interpolate(frame, [20, 90], [600, 1425], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );

  // Screen flash at ~90%
  const flashOp = interpolate(
    frame,
    [82, 88, 94],
    [0, 0.3, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Loot box available text
  const lootDelay = 100;
  const lootSpr = spr(frame, fps, { damping: 10, stiffness: 220 }, lootDelay);
  const lootScale = interpolate(lootSpr, [0, 1], [0.3, 1]);
  const lootOp = interpolate(lootSpr, [0, 1], [0, 1]);

  // Golden glow pulse
  const glowPulse = 0.3 + Math.sin(frame * 0.1) * 0.2;

  return (
    <AbsoluteFill
      style={{
        background: C.gray,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <div style={{ transform: `scale(${phoneScale})` }}>
        <IPhone>
          <StatusBar />
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              padding: "4px 12px",
            }}
          >
            {/* Greeting */}
            <div
              style={{
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 700,
                color: C.black,
                paddingTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: C.purple,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                LD
              </div>
              <span>Lucas</span>
            </div>

            {/* Completed tasks summary */}
            <Card style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.black,
                  marginBottom: 6,
                }}
              >
                ✅ Taches completes
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                {["Ranger la chambre", "Poubelles", "Maths", "Nourrir le chat"].map((t) => (
                  <div
                    key={t}
                    style={{
                      background: `${C.green}15`,
                      color: C.greenDark,
                      fontSize: 8.5,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontFamily: FONT,
                    }}
                  >
                    ✓ {t}
                  </div>
                ))}
              </div>
            </Card>

            {/* Gamification card — main focus */}
            <Card
              style={{
                border: `2px solid ${xpFill > 85 ? C.purple : C.border}`,
                padding: 16,
                boxShadow:
                  xpFill > 85
                    ? `0 0 20px ${C.purple}30, 0 4px 16px rgba(0,0,0,0.1)`
                    : "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              {/* Avatar row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: `${C.purple}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    border: `2px solid ${C.purple}40`,
                  }}
                >
                  👦
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 16,
                      fontWeight: 800,
                      color: C.black,
                    }}
                  >
                    Lucas
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.purple,
                    }}
                  >
                    Nv. 12 — Explorateur ⭐
                  </div>
                </div>
              </div>

              {/* XP bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.muted,
                  fontFamily: FONT,
                  fontWeight: 600,
                  marginBottom: 5,
                }}
              >
                <span>XP</span>
                <span style={{ color: xpFill > 85 ? C.purple : C.muted, fontWeight: 700 }}>
                  {xpNumber.toLocaleString("fr-FR")} / 1 500
                </span>
              </div>
              <XPBar fill={xpFill} color={C.purple} glow={xpFill > 80} />

              {/* Level progress label */}
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 9,
                  color: C.muted,
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                Niveau 13 dans {Math.max(1, Math.round(1500 - xpNumber)).toLocaleString("fr-FR")} XP
              </div>
            </Card>

            {/* Loot box available */}
            {frame >= lootDelay && (
              <div
                style={{
                  marginTop: 12,
                  transform: `scale(${lootScale})`,
                  opacity: lootOp,
                }}
              >
                <Card
                  style={{
                    background: `linear-gradient(135deg, #FEF3C7, #FDE68A)`,
                    border: "2px solid #F59E0B",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: `0 0 ${30 * glowPulse}px ${C.gold}60, 0 8px 24px rgba(0,0,0,0.15)`,
                  }}
                >
                  <span style={{ fontSize: 36 }}>🎁</span>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#92400E",
                      textAlign: "center",
                    }}
                  >
                    LOOT BOX DISPONIBLE !
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 11,
                      color: "#B45309",
                      fontWeight: 500,
                    }}
                  >
                    Appuie pour ouvrir
                  </div>
                </Card>
              </div>
            )}
          </div>
        </IPhone>
      </div>

      {/* Screen flash overlay */}
      <AbsoluteFill
        style={{
          background: C.white,
          opacity: flashOp,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}

// ── SCENE 4: Loot Box Opening ──
function SceneLootOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phases: float (0-60), shake (60-110), burst (110-140), reveal (140+)
  const isFloating = frame < 60;
  const isShaking = frame >= 60 && frame < 110;
  const isBursting = frame >= 110 && frame < 140;
  const isRevealed = frame >= 140;

  // Floating box
  const floatY = Math.sin(frame * 0.06) * 12;
  const floatScale = interpolate(
    spr(frame, fps, { damping: 12, stiffness: 200 }),
    [0, 1],
    [0, 1],
  );

  // Shaking intensity increases over time
  const shakeIntensity = isShaking
    ? interpolate(frame, [60, 110], [1, 8], {
        extrapolateRight: "clamp",
      })
    : 0;
  const shakeX = isShaking ? Math.sin(frame * 2.5) * shakeIntensity : 0;
  const shakeRotation = isShaking ? Math.cos(frame * 3) * shakeIntensity * 0.6 : 0;

  // Burst: scale up and disappear
  const burstScale = isBursting
    ? interpolate(frame, [110, 118, 125], [1, 1.8, 0], {
        extrapolateRight: "clamp",
      })
    : isRevealed
      ? 0
      : 1;
  const burstOp = isBursting
    ? interpolate(frame, [118, 128], [1, 0], {
        extrapolateRight: "clamp",
      })
    : isRevealed
      ? 0
      : 1;

  // Light rays
  const raysOp = interpolate(
    frame,
    [80, 110, 130, 145],
    [0, 0.6, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const raysRotation = frame * 0.3;

  // Golden ring
  const ringScale = isRevealed
    ? spr(frame, fps, { damping: 10, stiffness: 200 }, 130)
    : 0;

  // Reward card slide up
  const cardSpr = isRevealed
    ? spr(frame, fps, { damping: 12, stiffness: 180 }, 145)
    : 0;
  const cardY = interpolate(cardSpr, [0, 1], [100, 0]);
  const cardOp = interpolate(cardSpr, [0, 1], [0, 1]);

  // Background particles
  const bgParticles = Array.from({ length: 30 }, (_, i) => ({
    x: seededRandom(i * 7 + 1) * 1080,
    y: seededRandom(i * 7 + 2) * 1920,
    size: 2 + seededRandom(i * 7 + 3) * 3,
    speed: 0.3 + seededRandom(i * 7 + 4) * 1.5,
  }));

  // Flash on burst
  const burstFlash = interpolate(
    frame,
    [110, 115, 125],
    [0, 0.7, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, #1a1035 0%, #0a0618 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Background particles */}
      {bgParticles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y + Math.sin(frame * 0.02 * p.speed + i) * 15,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: `rgba(124,58,237,${0.15 + Math.sin(frame * 0.04 + i) * 0.1})`,
          }}
        />
      ))}

      {/* Light rays */}
      {raysOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) rotate(${raysRotation}deg)`,
            opacity: raysOp,
          }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 4,
                height: 500,
                background: `linear-gradient(to top, transparent, rgba(255,255,255,${0.15 + Math.sin(frame * 0.05 + i) * 0.1}))`,
                transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                transformOrigin: "bottom center",
              }}
            />
          ))}
        </div>
      )}

      {/* Gift box */}
      {burstOp > 0 && (
        <div
          style={{
            transform: `translateX(${shakeX}px) translateY(${isFloating ? floatY : 0}px) rotate(${shakeRotation}deg) scale(${isFloating ? floatScale : burstScale})`,
            opacity: burstOp,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Box body */}
          <div
            style={{
              width: 200,
              height: 180,
              background: `linear-gradient(145deg, ${C.purple}, ${C.purpleDark})`,
              borderRadius: 20,
              position: "relative",
              boxShadow: `0 20px 60px rgba(124,58,237,0.5), 0 0 ${isShaking ? 40 : 20}px rgba(124,58,237,0.3)`,
            }}
          >
            {/* Box lid */}
            <div
              style={{
                position: "absolute",
                top: -20,
                left: -12,
                width: 224,
                height: 40,
                background: `linear-gradient(145deg, #8B5CF6, ${C.purple})`,
                borderRadius: "14px 14px 4px 4px",
                boxShadow: "0 -4px 12px rgba(124,58,237,0.3)",
              }}
            />

            {/* Golden ribbon vertical */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -20,
                width: 24,
                height: 220,
                background: `linear-gradient(180deg, ${C.gold}, ${C.goldDark}, ${C.gold})`,
                transform: "translateX(-50%)",
                opacity: 0.8,
              }}
            />

            {/* Golden ribbon horizontal */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                width: "100%",
                height: 24,
                background: `linear-gradient(90deg, ${C.gold}, ${C.goldDark}, ${C.gold})`,
                transform: "translateY(-50%)",
                opacity: 0.8,
              }}
            />

            {/* Ribbon bow */}
            <div
              style={{
                position: "absolute",
                top: -40,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 40,
              }}
            >
              🎀
            </div>

            {/* Sparkle */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 15,
                fontSize: 20,
                opacity: 0.5 + Math.sin(frame * 0.15) * 0.5,
              }}
            >
              ✨
            </div>
          </div>
        </div>
      )}

      {/* Golden ring on reveal */}
      {isRevealed && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${interpolate(ringScale, [0, 1], [0.3, 1])})`,
            width: 350,
            height: 350,
            borderRadius: "50%",
            border: `4px solid ${C.gold}`,
            boxShadow: `0 0 40px ${C.gold}60, 0 0 80px ${C.gold}30, inset 0 0 40px ${C.gold}20`,
            opacity: interpolate(ringScale, [0, 1], [0, 0.8]),
          }}
        />
      )}

      {/* Reward card preview */}
      {isRevealed && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translateY(${cardY}px)`,
            opacity: cardOp,
            width: 280,
            minHeight: 160,
            background: `linear-gradient(145deg, #1C1332, #2D1F54)`,
            borderRadius: 20,
            border: `2px solid ${C.gold}`,
            boxShadow: `0 0 30px ${C.gold}40, 0 16px 48px rgba(0,0,0,0.5)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 8,
          }}
        >
          <span style={{ fontSize: 48 }}>⚡</span>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 800,
              color: C.gold,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            EPIQUE
          </div>
        </div>
      )}

      {/* Burst flash */}
      <AbsoluteFill
        style={{
          background: C.white,
          opacity: burstFlash,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}

// ── SCENE 5: Epic Reward Reveal ──
function SceneRewardReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card entrance
  const cardSpr = spr(frame, fps, { damping: 12, stiffness: 200 });
  const cardScale = interpolate(cardSpr, [0, 1], [0.6, 1]);
  const cardOp = interpolate(cardSpr, [0, 1], [0, 1]);

  // Shimmer effect — rotating highlight
  const shimmerAngle = frame * 2;

  // Golden border glow pulse
  const glowIntensity = 30 + Math.sin(frame * 0.08) * 15;

  // Confetti particles (40 pieces)
  const confettiColors = [C.gold, C.purple, C.white, C.amber, "#EC4899", "#8B5CF6"];
  const confettiParticles = Array.from({ length: 40 }, (_, i) => {
    const seed = i + 42;
    const startX = 540 + (seededRandom(seed * 3) - 0.5) * 400;
    const startY = -30 - seededRandom(seed * 5) * 200;
    const speedY = 2 + seededRandom(seed * 7) * 4;
    const speedX = (seededRandom(seed * 11) - 0.5) * 3;
    const rotation = seededRandom(seed * 13) * 360;
    const rotSpeed = (seededRandom(seed * 17) - 0.5) * 8;
    const size = 6 + seededRandom(seed * 19) * 12;
    const color = confettiColors[Math.floor(seededRandom(seed * 23) * confettiColors.length)];
    const delay = seededRandom(seed * 29) * 30;
    const isSquare = seededRandom(seed * 31) > 0.5;

    return { startX, startY, speedY, speedX, rotation, rotSpeed, size, color, delay, isSquare };
  });

  // +50 XP Bonus
  const bonusDelay = 50;
  const bonusSpr = spr(frame, fps, { damping: 10, stiffness: 250 }, bonusDelay);
  const bonusScale = interpolate(bonusSpr, [0, 1], [0.3, 1]);
  const bonusOp = interpolate(bonusSpr, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, #1a1035 0%, #0a0618 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Confetti */}
      {confettiParticles.map((p, i) => {
        const t = Math.max(0, frame - p.delay);
        const x = p.startX + p.speedX * t + Math.sin(t * 0.05 + i) * 20;
        const y = p.startY + p.speedY * t;
        const rot = p.rotation + p.rotSpeed * t;
        const opacity = interpolate(
          y,
          [0, 1600, 1920],
          [1, 0.8, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        if (y > 1950 || t <= 0) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.isSquare ? p.size : p.size * 0.5,
              background: p.color,
              borderRadius: p.isSquare ? 2 : p.size,
              transform: `rotate(${rot}deg)`,
              opacity: opacity * 0.9,
            }}
          />
        );
      })}

      {/* Reward card */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity: cardOp,
          width: 400,
          minHeight: 380,
          background: `linear-gradient(145deg, #1C1332, #2D1F54)`,
          borderRadius: 28,
          border: `3px solid ${C.gold}`,
          boxShadow: `0 0 ${glowIntensity}px ${C.gold}50, 0 0 ${glowIntensity * 2}px ${C.gold}20, 0 24px 64px rgba(0,0,0,0.6)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 28px",
          gap: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shimmer overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: `linear-gradient(${shimmerAngle}deg, transparent 30%, rgba(255,215,0,0.08) 50%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Epic label */}
        <div
          style={{
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
            padding: "6px 24px",
            borderRadius: 20,
            fontFamily: FONT,
            fontSize: 16,
            fontWeight: 800,
            color: "#1C1332",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          ⚡ EPIQUE
        </div>

        {/* Icon */}
        <div style={{ fontSize: 72, marginTop: 8 }}>🎯</div>

        {/* Main reward text */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 42,
            fontWeight: 800,
            color: C.white,
            textAlign: "center",
            letterSpacing: -1,
            textShadow: `0 0 20px ${C.purple}80`,
          }}
        >
          x3 Multiplicateur
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 500,
            color: "rgba(255,255,255,0.6)",
            textAlign: "center",
          }}
        >
          Pendant 5 taches
        </div>

        {/* Rarity bar */}
        <div
          style={{
            width: "80%",
            height: 3,
            background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
            borderRadius: 2,
            marginTop: 4,
          }}
        />
      </div>

      {/* +50 XP Bonus */}
      {frame >= bonusDelay && (
        <div
          style={{
            marginTop: 32,
            transform: `scale(${bonusScale})`,
            opacity: bonusOp,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
              padding: "10px 28px",
              borderRadius: 16,
              fontFamily: FONT,
              fontSize: 24,
              fontWeight: 800,
              color: C.white,
              boxShadow: `0 0 20px ${C.green}40, 0 8px 24px rgba(0,0,0,0.3)`,
              letterSpacing: 1,
            }}
          >
            +50 XP Bonus
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

// ── SCENE 6: Closing ──
function SceneClosing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = useVideoConfig();

  // White fade in
  const bgOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Icon entrance
  const iconSpr = spr(frame, fps, { damping: 10, stiffness: 160 }, 10);
  const iconScale = interpolate(iconSpr, [0, 1], [0, 1]);

  // Name
  const nameOp = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const nameY = interpolate(frame, [30, 50], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Tagline with letter spacing animation
  const tagDelay = 55;
  const tagOp = interpolate(frame, [tagDelay, tagDelay + 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const tagSpacing = interpolate(
    frame,
    [tagDelay, tagDelay + 30],
    [12, 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  // Underline
  const underlineW = interpolate(
    spr(frame, fps, { damping: 200 }, tagDelay + 20),
    [0, 1],
    [0, 340],
  );

  // Final fade out
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: C.white,
        opacity: bgOp * fadeOut,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <AppIcon size={130} scale={iconScale} />

      <div
        style={{
          opacity: nameOp,
          transform: `translateY(${nameY}px)`,
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 800,
          color: C.black,
          letterSpacing: -2,
        }}
      >
        Family Flow
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            opacity: tagOp,
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 500,
            color: C.muted,
            letterSpacing: tagSpacing,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          Transforme les corvees en aventure
        </div>
        <div
          style={{
            width: underlineW,
            height: 3,
            background: `linear-gradient(90deg, ${C.purple}, ${C.amber})`,
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ── Scene Fade Wrapper ──
function SceneFade({
  duration,
  overlap,
  children,
}: {
  duration: number;
  overlap: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, overlap], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [duration - overlap, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
}

// ── MAIN EXPORT ──
export const Video1_TaskLoot: React.FC = () => {
  const T = 15; // cross-fade overlap in frames

  const scenes = [
    { start: 0, end: 85 },      // S0: French slogan
    { start: 80, end: 165 },     // S1: Morning greeting
    { start: 160, end: 305 },    // S2: Task checking
    { start: 300, end: 455 },    // S3: XP bar filling
    { start: 450, end: 645 },    // S4: Loot box opening
    { start: 640, end: 805 },    // S5: Epic reward reveal
    { start: 800, end: 900 },    // S6: Closing
  ];

  const sceneComponents = [
    <SceneSlogan />,
    <SceneMorning />,
    <SceneTaskList />,
    <SceneXPFill />,
    <SceneLootOpen />,
    <SceneRewardReveal />,
    <SceneClosing />,
  ];

  return (
    <AbsoluteFill style={{ background: C.white, overflow: "hidden" }}>
      {/* Background music */}
      <Audio
        src={staticFile("music-gaming.mp3")}
        volume={(f) =>
          interpolate(f, [0, 15, 870, 900], [0, 0.4, 0.4, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Scenes */}
      {scenes.map((s, i) => {
        const duration = s.end - s.start;
        return (
          <Sequence key={i} from={s.start} durationInFrames={duration + T} premountFor={T}>
            <SceneFade duration={duration} overlap={T}>
              {sceneComponents[i]}
            </SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
