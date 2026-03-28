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

// ── Colors — Warm kitchen palette ──
const C = {
  white: "#FFFFFF",
  black: "#111827",
  orange: "#F97316",
  orangeLight: "#FFF7ED",
  orangeDark: "#EA580C",
  green: "#10B981",
  greenLight: "#D1FAE5",
  amber: "#F59E0B",
  cream: "#FFFBEB",
  warmGray: "#F5F0EB",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
  muted: "#6B7280",
  border: "#E5E7EB",
  card: "#FFFFFF",
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

// ── SceneFade — cross-fade wrapper ──
function SceneFade({
  children,
  fadeIn = 8,
  fadeOut = 8,
}: {
  children: React.ReactNode;
  fadeIn?: number;
  fadeOut?: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
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
  screenBg = C.warmGray,
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
      {/* Side button */}
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
      {/* Screen */}
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
        {/* Dynamic Island */}
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
function StatusBar({ dark = false }: { dark?: boolean }) {
  const col = dark ? C.white : C.black;
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
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        fontFamily: FONT,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCENE 1: Warm Opening (0–70)
// ═══════════════════════════════════════════════════════════
function Scene1_Opening() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = tw("Le second cerveau", frame, 0, 1.2);
  const sub = spr(frame, fps, { damping: 200 }, 40);
  const subOpacity = interpolate(sub, [0, 1], [0, 1]);
  const subY = interpolate(sub, [0, 1], [20, 0]);

  return (
    <SceneFade fadeOut={6}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(170deg, ${C.cream} 0%, ${C.warmGray} 100%)`,
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
    </SceneFade>
  );
}

// ═══════════════════════════════════════════════════════════
// SCENE 2: Recipe Browser (65–200)
// ═══════════════════════════════════════════════════════════
const RECIPES = [
  {
    emoji: "🍝",
    name: "Carbonara",
    meta: "30 min · Facile",
    tint: C.cream,
  },
  {
    emoji: "🥗",
    name: "Salade César",
    meta: "15 min · Facile",
    tint: C.greenLight,
  },
  {
    emoji: "🍕",
    name: "Pizza Maison",
    meta: "45 min · Moyen",
    tint: C.orangeLight,
  },
];

function Scene2_RecipeBrowser() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // iPhone entrance
  const phoneY = interpolate(frame, [0, 30], [300, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Selection happens around frame 80 (relative to scene start)
  const selectFrame = 80;
  const isSelected = frame >= selectFrame;

  // Tap indicator pulse
  const tapVisible = frame >= 55 && frame < selectFrame;
  const tapScale = tapVisible
    ? 0.9 + 0.15 * Math.sin(((frame - 55) / 15) * Math.PI * 2)
    : 0;
  const tapOpacity = tapVisible
    ? 0.4 + 0.3 * Math.sin(((frame - 55) / 15) * Math.PI * 2)
    : 0;

  return (
    <SceneFade fadeIn={6} fadeOut={6}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(170deg, ${C.cream} 0%, ${C.warmGray} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: phoneOpacity,
            transform: `translateY(${phoneY}px)`,
          }}
        >
          <IPhone screenBg={C.warmGray}>
            <StatusBar />
            {/* Header */}
            <div
              style={{
                padding: "20px 20px 12px",
                fontFamily: FONT,
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: C.black,
                  letterSpacing: -0.5,
                }}
              >
                Recettes
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: C.muted,
                  marginTop: 4,
                }}
              >
                Vos recettes préférées
              </div>
            </div>

            {/* Search bar */}
            <div style={{ padding: "0 20px 12px" }}>
              <div
                style={{
                  background: C.white,
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 14,
                  color: C.muted,
                  fontFamily: FONT,
                  border: `1px solid ${C.border}`,
                }}
              >
                🔍 Rechercher une recette...
              </div>
            </div>

            {/* Recipe cards */}
            <div
              style={{
                padding: "0 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {RECIPES.map((recipe, i) => {
                const delay = 20 + i * 12;
                const cardY = interpolate(
                  frame,
                  [delay, delay + 20],
                  [60, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.cubic),
                  },
                );
                const cardOpacity = interpolate(
                  frame,
                  [delay, delay + 12],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );

                const isFirst = i === 0;
                const selectedScale =
                  isFirst && isSelected
                    ? interpolate(
                        frame,
                        [selectFrame, selectFrame + 10],
                        [1, 1.03],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.out(Easing.cubic),
                        },
                      )
                    : 1;

                const otherOpacity =
                  !isFirst && isSelected
                    ? interpolate(
                        frame,
                        [selectFrame, selectFrame + 15],
                        [1, 0.4],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        },
                      )
                    : 1;

                return (
                  <div
                    key={i}
                    style={{
                      opacity: cardOpacity * otherOpacity,
                      transform: `translateY(${cardY}px) scale(${selectedScale})`,
                      position: "relative",
                    }}
                  >
                    <Card
                      style={{
                        background: recipe.tint,
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        border:
                          isFirst && isSelected
                            ? `2.5px solid ${C.purple}`
                            : `1px solid ${C.border}`,
                        transition: "border 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 14,
                          background: "rgba(255,255,255,0.7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 32,
                        }}
                      >
                        {recipe.emoji}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: C.black,
                            fontFamily: FONT,
                          }}
                        >
                          {recipe.emoji} {recipe.name}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: C.muted,
                            marginTop: 2,
                            fontFamily: FONT,
                          }}
                        >
                          {recipe.meta}
                        </div>
                      </div>
                    </Card>

                    {/* Tap indicator on first card */}
                    {isFirst && tapVisible && (
                      <div
                        style={{
                          position: "absolute",
                          right: 30,
                          top: "50%",
                          transform: `translate(0, -50%) scale(${tapScale})`,
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: `rgba(124, 58, 237, ${tapOpacity})`,
                          border: `2px solid ${C.purple}`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </IPhone>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ═══════════════════════════════════════════════════════════
// SCENE 3: Recipe Detail (195–380)
// ═══════════════════════════════════════════════════════════
const INGREDIENTS = [
  "400g Spaghetti",
  "200g Lardons",
  "4 Oeufs",
  "100g Parmesan",
  "Poivre noir",
];

function Scene3_RecipeDetail() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone entrance
  const phoneScale = interpolate(frame, [0, 20], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Button glow pulse
  const glowPhase = Math.sin(((frame - 100) / 20) * Math.PI * 2);
  const buttonVisible = frame > 90;

  return (
    <SceneFade fadeIn={6} fadeOut={6}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(170deg, ${C.cream} 0%, ${C.warmGray} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ transform: `scale(${phoneScale})` }}>
          <IPhone screenBg={C.white}>
            <StatusBar />

            {/* Recipe header */}
            <div
              style={{
                background: C.cream,
                padding: "20px 20px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: C.black,
                  fontFamily: FONT,
                  letterSpacing: -0.5,
                }}
              >
                🍝 Carbonara Classique
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 10,
                  fontFamily: FONT,
                  fontSize: 13,
                  color: C.muted,
                }}
              >
                <span>⏱ 30 min</span>
                <span>👨‍👩‍👧‍👦 4 pers.</span>
                <span>⭐ Facile</span>
              </div>
            </div>

            {/* Ingredients section */}
            <div
              style={{
                padding: "16px 20px",
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.black,
                  fontFamily: FONT,
                  marginBottom: 12,
                }}
              >
                Ingrédients
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {INGREDIENTS.map((ing, i) => {
                  const delay = 15 + i * 10;
                  const x = interpolate(
                    frame,
                    [delay, delay + 14],
                    [-60, 0],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.out(Easing.cubic),
                    },
                  );
                  const o = interpolate(
                    frame,
                    [delay, delay + 10],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  );

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        opacity: o,
                        transform: `translateX(${x}px)`,
                        fontFamily: FONT,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: C.orange,
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 16,
                          color: C.black,
                          fontWeight: 500,
                          padding: "8px 0",
                          borderBottom: `1px solid ${C.border}`,
                          flex: 1,
                        }}
                      >
                        {ing}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA Button */}
            {buttonVisible && (
              <div style={{ padding: "12px 20px 28px" }}>
                {(() => {
                  const btnOpacity = interpolate(
                    frame,
                    [90, 100],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  );
                  const btnY = interpolate(
                    frame,
                    [90, 105],
                    [20, 0],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.out(Easing.cubic),
                    },
                  );
                  return (
                    <div
                      style={{
                        opacity: btnOpacity,
                        transform: `translateY(${btnY}px)`,
                        background: C.purple,
                        borderRadius: 16,
                        padding: "16px 24px",
                        textAlign: "center",
                        fontFamily: FONT,
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.white,
                        boxShadow: `0 4px ${16 + glowPhase * 6}px rgba(124, 58, 237, ${0.3 + glowPhase * 0.15})`,
                        cursor: "pointer",
                      }}
                    >
                      Ajouter aux courses 🛒
                    </div>
                  );
                })()}
              </div>
            )}
          </IPhone>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ═══════════════════════════════════════════════════════════
// SCENE 4: Auto-Add Magic (375–560)
// ═══════════════════════════════════════════════════════════
function Scene4_AutoAdd() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Button press animation (0-15)
  const btnPress =
    frame < 15
      ? interpolate(frame, [0, 5, 15], [1, 0.92, 1.05], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  // Ingredient pill trajectories (start staggered from frame 18)
  const pills = INGREDIENTS.map((name, i) => {
    const pillStart = 18 + i * 14;
    const pillDuration = 35;
    const t = interpolate(
      frame,
      [pillStart, pillStart + pillDuration],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      },
    );

    // Start positions (scattered from center-left)
    const startX = 200 + (i % 2) * 120;
    const startY = 700 + i * 60;
    // Target: cart icon position (center-top area)
    const endX = 540;
    const endY = 420;

    // Parabolic arc using sin for the curve
    const arcHeight = 200 + i * 40;
    const x = interpolate(t, [0, 1], [startX, endX]);
    const y =
      interpolate(t, [0, 1], [startY, endY]) -
      Math.sin(t * Math.PI) * arcHeight;

    const pillOpacity = t > 0 && t < 1 ? 1 : t >= 1 ? 0 : 0;
    const pillScale = t > 0 ? interpolate(t, [0, 0.1, 0.9, 1], [0.3, 1, 1, 0.3], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) : 0;

    return { name, x, y, opacity: pillOpacity, scale: pillScale, arrived: t >= 1, arriveFrame: pillStart + pillDuration };
  });

  // Cart counter
  const arrivedCount = pills.filter((p) => p.arrived).length;

  // Cart bounce on each arrival
  const cartBounce = pills.reduce((acc, p) => {
    if (frame >= p.arriveFrame && frame < p.arriveFrame + 8) {
      const bt = interpolate(
        frame,
        [p.arriveFrame, p.arriveFrame + 4, p.arriveFrame + 8],
        [1, 1.2, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      return Math.max(acc, bt);
    }
    return acc;
  }, 1);

  // Flash when all arrived
  const allArrived = arrivedCount === 5;
  const flashFrame = 18 + 4 * 14 + 35;
  const flashOpacity =
    allArrived && frame >= flashFrame && frame < flashFrame + 12
      ? interpolate(frame, [flashFrame, flashFrame + 4, flashFrame + 12], [0, 0.6, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  // Success text
  const successOpacity =
    allArrived
      ? interpolate(frame, [flashFrame + 8, flashFrame + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const successY = allArrived
    ? interpolate(frame, [flashFrame + 8, flashFrame + 20], [15, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 15;

  return (
    <SceneFade fadeIn={6} fadeOut={6}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(170deg, ${C.cream} 0%, ${C.orangeLight} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Button representation at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 500,
            left: "50%",
            transform: `translateX(-50%) scale(${btnPress})`,
            background: C.purple,
            borderRadius: 20,
            padding: "18px 40px",
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 700,
            color: C.white,
            boxShadow: "0 8px 30px rgba(124,58,237,0.35)",
            opacity: frame < 30 ? 1 : interpolate(frame, [30, 45], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Ajouter aux courses 🛒
        </div>

        {/* Cart icon */}
        <div
          style={{
            position: "absolute",
            top: 360,
            left: "50%",
            transform: `translateX(-50%) scale(${cartBounce})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            opacity: interpolate(frame, [15, 25], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontSize: 80,
              position: "relative",
            }}
          >
            🛒
            {/* Counter badge */}
            {arrivedCount > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: C.orange,
                  color: C.white,
                  fontFamily: FONT,
                  fontSize: 18,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(249,115,22,0.4)",
                }}
              >
                {arrivedCount}
              </div>
            )}
          </div>
        </div>

        {/* Flying ingredient pills */}
        {pills.map((pill, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pill.x,
              top: pill.y,
              transform: `translate(-50%, -50%) scale(${pill.scale})`,
              opacity: pill.opacity,
              background: C.white,
              borderRadius: 20,
              padding: "8px 16px",
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 600,
              color: C.black,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              border: `1.5px solid ${C.orange}`,
              whiteSpace: "nowrap" as const,
            }}
          >
            {pill.name}
          </div>
        ))}

        {/* Flash overlay */}
        <AbsoluteFill
          style={{
            background: C.white,
            opacity: flashOpacity,
            pointerEvents: "none" as const,
          }}
        />

        {/* Success text */}
        <div
          style={{
            position: "absolute",
            top: 560,
            left: "50%",
            transform: `translateX(-50%) translateY(${successY}px)`,
            opacity: successOpacity,
            fontFamily: FONT,
            fontSize: 28,
            fontWeight: 700,
            color: C.green,
            display: "flex",
            alignItems: "center",
            gap: 10,
            whiteSpace: "nowrap" as const,
          }}
        >
          5 ingrédients ajoutés ✓
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ═══════════════════════════════════════════════════════════
// SCENE 5: Shopping List View (555–730)
// ═══════════════════════════════════════════════════════════
const SHOPPING_CATEGORIES = [
  {
    emoji: "🥩",
    label: "Viandes",
    items: [{ name: "Lardons 200g", checked: false }],
  },
  {
    emoji: "🧀",
    label: "Fromages",
    items: [{ name: "Parmesan 100g", checked: false }],
  },
  {
    emoji: "🥚",
    label: "Frais",
    items: [{ name: "Oeufs x4", checked: false }],
  },
  {
    emoji: "🍝",
    label: "Épicerie",
    items: [
      { name: "Spaghetti 400g", checked: true },
      { name: "Poivre noir", checked: false },
    ],
  },
];

function Scene5_ShoppingList() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneY = interpolate(frame, [0, 25], [200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const phoneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Strikethrough animation on spaghetti (category 3, item 0)
  const strikeFrame = 90;
  const strikeWidth =
    frame >= strikeFrame
      ? interpolate(frame, [strikeFrame, strikeFrame + 15], [0, 100], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : 0;

  // Counter
  const countText =
    frame >= strikeFrame + 15 ? "4 à acheter" : "5 à acheter";
  const countOpacity = interpolate(frame, [60, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let itemIndex = 0;

  return (
    <SceneFade fadeIn={6} fadeOut={6}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(170deg, ${C.cream} 0%, ${C.warmGray} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: phoneOpacity,
            transform: `translateY(${phoneY}px)`,
          }}
        >
          <IPhone screenBg={C.white}>
            <StatusBar />

            {/* Header */}
            <div
              style={{
                padding: "20px 20px 8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: C.black,
                  fontFamily: FONT,
                  letterSpacing: -0.5,
                }}
              >
                Courses 🛒
              </div>
              <div
                style={{
                  background: C.greenLight,
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.green,
                  opacity: countOpacity,
                }}
              >
                {countText}
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: C.muted,
                fontFamily: FONT,
                padding: "0 20px 12px",
              }}
            >
              Depuis : Carbonara Classique
            </div>

            {/* Categories */}
            <div
              style={{
                padding: "0 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                overflow: "hidden",
              }}
            >
              {SHOPPING_CATEGORIES.map((cat, ci) => {
                const catDelay = 25 + ci * 18;
                const catOpacity = interpolate(
                  frame,
                  [catDelay, catDelay + 12],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                const catY = interpolate(
                  frame,
                  [catDelay, catDelay + 16],
                  [30, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.cubic),
                  },
                );

                return (
                  <div
                    key={ci}
                    style={{
                      opacity: catOpacity,
                      transform: `translateY(${catY}px)`,
                    }}
                  >
                    {/* Category header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        fontFamily: FONT,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: C.black,
                          textTransform: "uppercase" as const,
                          letterSpacing: 0.5,
                        }}
                      >
                        {cat.label}
                      </span>
                    </div>

                    {/* Items */}
                    {cat.items.map((item, ii) => {
                      const currentItemIndex = itemIndex++;
                      const isSpaghetti =
                        item.checked && ci === 3 && ii === 0;

                      return (
                        <div
                          key={ii}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            background: isSpaghetti
                              ? C.greenLight
                              : C.warmGray,
                            borderRadius: 10,
                            marginBottom: 4,
                            fontFamily: FONT,
                            position: "relative",
                          }}
                        >
                          {/* Checkbox */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              border: isSpaghetti
                                ? "none"
                                : `2px solid ${C.border}`,
                              background: isSpaghetti ? C.green : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isSpaghetti && frame >= strikeFrame + 5 && (
                              <span
                                style={{
                                  color: C.white,
                                  fontSize: 14,
                                  fontWeight: 800,
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 500,
                              color: isSpaghetti ? C.muted : C.black,
                              position: "relative",
                            }}
                          >
                            {item.name}
                            {/* Strikethrough line */}
                            {isSpaghetti && (
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: "50%",
                                  height: 2,
                                  width: `${strikeWidth}%`,
                                  background: C.muted,
                                  borderRadius: 1,
                                }}
                              />
                            )}
                          </div>

                          {isSpaghetti && frame >= strikeFrame + 10 && (
                            <div
                              style={{
                                marginLeft: "auto",
                                fontSize: 11,
                                color: C.green,
                                fontWeight: 600,
                                fontFamily: FONT,
                              }}
                            >
                              Déjà en stock !
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </IPhone>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ═══════════════════════════════════════════════════════════
// SCENE 6: Closing (725–900)
// ═══════════════════════════════════════════════════════════
function Scene6_Closing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconScale = spr(frame, fps, { damping: 12, stiffness: 160 }, 10);
  const titleOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [25, 40], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const tagOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagY = interpolate(frame, [50, 65], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Fade out at end
  const fadeOut = interpolate(frame, [155, 175], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(170deg, ${C.cream} 0%, ${C.orangeLight} 50%, ${C.warmGray} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: fadeOut,
      }}
    >
      <AppIcon size={130} scale={iconScale} />

      <div
        style={{
          fontFamily: FONT,
          fontSize: 44,
          fontWeight: 800,
          color: C.black,
          letterSpacing: -1.5,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Family Flow
      </div>

      <div
        style={{
          fontFamily: FONT,
          fontSize: 24,
          fontWeight: 500,
          color: C.muted,
          textAlign: "center",
          padding: "0 80px",
          lineHeight: 1.4,
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
        }}
      >
        De la recette au caddie,{"\n"}automatiquement
      </div>
    </AbsoluteFill>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════
export const Video2_RecipeFlow: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      {/* Audio */}
      <Audio
        src={staticFile("music-kitchen.mp3")}
        volume={(f) =>
          interpolate(f, [0, 30, 840, 900], [0, 0.7, 0.7, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Scene 1: Warm Opening (0–70) */}
      <Sequence from={0} durationInFrames={70}>
        <Scene1_Opening />
      </Sequence>

      {/* Scene 2: Recipe Browser (65–200) */}
      <Sequence from={65} durationInFrames={135}>
        <Scene2_RecipeBrowser />
      </Sequence>

      {/* Scene 3: Recipe Detail (195–380) */}
      <Sequence from={195} durationInFrames={185}>
        <Scene3_RecipeDetail />
      </Sequence>

      {/* Scene 4: Auto-Add Magic (375–560) */}
      <Sequence from={375} durationInFrames={185}>
        <Scene4_AutoAdd />
      </Sequence>

      {/* Scene 5: Shopping List (555–730) */}
      <Sequence from={555} durationInFrames={175}>
        <Scene5_ShoppingList />
      </Sequence>

      {/* Scene 6: Closing (725–900) */}
      <Sequence from={725} durationInFrames={175}>
        <Scene6_Closing />
      </Sequence>
    </AbsoluteFill>
  );
};
