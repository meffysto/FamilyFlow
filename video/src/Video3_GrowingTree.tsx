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

// ── Colors — Nature/Seasons palette ──
const C = {
  white: "#FFFFFF",
  black: "#111827",
  earth: "#8B7355",
  earthLight: "#D4C5A9",
  green: "#22C55E",
  greenDark: "#15803D",
  greenLight: "#DCFCE7",
  sky: "#38BDF8",
  skyLight: "#E0F2FE",
  pink: "#F472B6",
  pinkLight: "#FDF2F8",
  amber: "#F59E0B",
  amberWarm: "#FEF3C7",
  brown: "#92400E",
  trunk: "#6B4423",
  gold: "#FFD700",
  night: "#1E1B4B",
  nightPurple: "#4C1D95",
  cream: "#FFF8F0",
};

// ── Helpers ──
function spr(
  frame: number,
  fps: number,
  cfg: Record<string, number> = { damping: 200 },
  delay = 0
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

// ── Scene fade wrapper ──
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
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
}

// ── Seeded random for deterministic particles ──
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── Sparkle particle ──
function Sparkle({
  x,
  y,
  delay,
  size = 4,
  color = C.gold,
}: {
  x: number;
  y: number;
  delay: number;
  size?: number;
  color?: string;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    Math.sin((frame - delay) * 0.08),
    [-1, 1],
    [0.1, 0.9]
  );
  const scale = interpolate(
    Math.sin((frame - delay) * 0.06 + 1),
    [-1, 1],
    [0.5, 1.2]
  );
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity: frame > delay ? opacity : 0,
        transform: `scale(${scale})`,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
    />
  );
}

// ── Falling particle (petals, leaves, snow) ──
function FallingParticle({
  seed,
  startFrame,
  duration,
  areaX,
  areaY,
  areaWidth,
  fallDistance,
  size,
  color,
  shape = "circle",
}: {
  seed: number;
  startFrame: number;
  duration: number;
  areaX: number;
  areaY: number;
  areaWidth: number;
  fallDistance: number;
  size: number;
  color: string;
  shape?: "circle" | "square" | "petal";
}) {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  if (localFrame < 0 || localFrame > duration) return null;

  const progress = localFrame / duration;
  const initialX = areaX + seededRandom(seed) * areaWidth;
  const swayAmount = 30 * seededRandom(seed + 1);
  const swaySpeed = 0.03 + seededRandom(seed + 2) * 0.04;
  const x = initialX + Math.sin(localFrame * swaySpeed) * swayAmount;
  const y = areaY + progress * fallDistance;
  const rotation = localFrame * (1.5 + seededRandom(seed + 3) * 2);
  const opacity = interpolate(progress, [0, 0.1, 0.8, 1], [0, 0.8, 0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const borderRadius = shape === "circle" ? "50%" : shape === "petal" ? "50% 0 50% 0" : "2px";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        background: color,
        borderRadius,
        opacity,
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
}

// ── XP float text (+10) ──
function XPFloat({
  x,
  delay,
  text = "+10",
}: {
  x: number;
  delay: number;
  text?: string;
}) {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;
  if (localFrame < 0 || localFrame > 50) return null;
  const progress = localFrame / 50;
  const y = interpolate(progress, [0, 1], [0, -80]);
  const opacity = interpolate(progress, [0, 0.2, 0.7, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 750 + y,
        fontFamily: FONT,
        fontSize: 20,
        fontWeight: 600,
        color: C.greenDark,
        opacity,
        textShadow: "0 2px 8px rgba(255,255,255,0.6)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCENE 1 — The Seed (0-100)
// ══════════════════════════════════════════════════════════════════
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
        background: C.cream,
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
        <span style={{ opacity: frame % 30 < 18 ? 1 : 0, color: "#7C3AED" }}>|</span>
      </div>
      <div style={{
        fontFamily: FONT, fontSize: 28, fontWeight: 500, color: "#6B7280",
        opacity: subOpacity, transform: `translateY(${subY}px)`,
      }}>
        que votre famille mérite
      </div>
    </AbsoluteFill>
  );
}

function SceneSeed() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background
  const bgGreen = interpolate(frame, [0, 100], [0, 0.05], {
    extrapolateRight: "clamp",
  });

  // Title typewriter
  const line1 = tw("Chaque famille commence...", frame, 8, 0.9);
  const line1Opacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2 = tw("...par une graine", frame, 65, 0.9);
  const line2Opacity = interpolate(frame, [60, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Seed
  const seedScale = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [0.95, 1.05]
  );
  const seedAppear = spr(frame, fps, { damping: 20, stiffness: 100 }, 5);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${C.cream} 0%, rgba(220,252,231,${bgGreen + 0.15}) 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      {/* Sparkles */}
      <Sparkle x={380} y={700} delay={20} size={5} color={C.earthLight} />
      <Sparkle x={650} y={750} delay={35} size={4} color={C.gold} />
      <Sparkle x={500} y={680} delay={50} size={3} color={C.earthLight} />
      <Sparkle x={570} y={820} delay={10} size={4} color={C.gold} />

      {/* Line 1 */}
      <div
        style={{
          opacity: line1Opacity,
          fontSize: 48,
          fontWeight: 700,
          color: C.earth,
          textAlign: "center",
          letterSpacing: -1,
          lineHeight: 1.2,
          padding: "0 80px",
          minHeight: 120,
          marginBottom: 80,
        }}
      >
        {line1}
        <span style={{ opacity: frame % 30 < 18 ? 1 : 0, color: C.earth }}>
          |
        </span>
      </div>

      {/* Ground line */}
      <div
        style={{
          width: 300,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${C.earth}, transparent)`,
          borderRadius: 2,
          position: "relative",
        }}
      >
        {/* Seed */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 2,
            transform: `translateX(-50%) scale(${seedScale * seedAppear})`,
            width: 30,
            height: 20,
            background: `radial-gradient(ellipse, ${C.brown} 30%, ${C.trunk} 100%)`,
            borderRadius: "50%",
            boxShadow: `0 4px 12px rgba(107,68,35,0.3)`,
          }}
        />
      </div>

      {/* Line 2 */}
      <div
        style={{
          opacity: line2Opacity,
          fontSize: 38,
          fontWeight: 600,
          color: C.greenDark,
          textAlign: "center",
          marginTop: 100,
          letterSpacing: -0.5,
        }}
      >
        {line2}
        {frame > 60 && (
          <span
            style={{ opacity: frame % 30 < 18 ? 1 : 0, color: C.greenDark }}
          >
            |
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCENE 2 — Sprouting (95-230)
// ══════════════════════════════════════════════════════════════════
function SceneSprouting() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sprout growth
  const sproutProgress = interpolate(frame, [15, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const sproutHeight = sproutProgress * 80;
  const stemWidth = 3 + sproutProgress * 2;

  // Seed crack
  const crackWidth = interpolate(frame, [0, 20], [0, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Leaves unfold
  const leafAngleL = interpolate(frame, [40, 80], [0, -40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leafAngleR = interpolate(frame, [45, 85], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leafScale = interpolate(frame, [40, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Background green shift
  const bgGreen = interpolate(frame, [0, 135], [0.15, 0.35], {
    extrapolateRight: "clamp",
  });

  // Text
  const textOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const centerX = 540;
  const groundY = 1050;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${C.cream} 0%, rgba(220,252,231,${bgGreen}) 100%)`,
        fontFamily: FONT,
      }}
    >
      {/* Ground line */}
      <div
        style={{
          position: "absolute",
          left: centerX - 150,
          top: groundY,
          width: 300,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${C.earth}, transparent)`,
          borderRadius: 2,
        }}
      />

      {/* Seed with crack */}
      <div
        style={{
          position: "absolute",
          left: centerX - 15,
          top: groundY - 10,
          width: 30,
          height: 20,
          background: `radial-gradient(ellipse, ${C.brown} 30%, ${C.trunk} 100%)`,
          borderRadius: "50%",
          boxShadow: "0 4px 12px rgba(107,68,35,0.3)",
        }}
      >
        {/* Crack line */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 2,
            width: 2,
            height: crackWidth,
            background: C.earthLight,
            transform: "translateX(-50%)",
            borderRadius: 1,
          }}
        />
      </div>

      {/* Sprout stem */}
      {sproutProgress > 0 && (
        <div
          style={{
            position: "absolute",
            left: centerX - stemWidth / 2,
            top: groundY - 10 - sproutHeight,
            width: stemWidth,
            height: sproutHeight,
            background: `linear-gradient(180deg, ${C.green} 0%, ${C.greenDark} 100%)`,
            borderRadius: stemWidth / 2,
            transformOrigin: "bottom center",
          }}
        />
      )}

      {/* Left leaf */}
      {leafScale > 0 && (
        <div
          style={{
            position: "absolute",
            left: centerX - 20,
            top: groundY - 10 - sproutHeight + 10,
            width: 18,
            height: 10,
            background: C.green,
            borderRadius: "50% 0 50% 0",
            transform: `rotate(${leafAngleL}deg) scale(${leafScale})`,
            transformOrigin: "right center",
            boxShadow: "inset 0 -1px 3px rgba(0,0,0,0.1)",
          }}
        />
      )}

      {/* Right leaf */}
      {leafScale > 0 && (
        <div
          style={{
            position: "absolute",
            left: centerX + 3,
            top: groundY - 10 - sproutHeight + 20,
            width: 18,
            height: 10,
            background: C.green,
            borderRadius: "0 50% 0 50%",
            transform: `rotate(${leafAngleR}deg) scale(${leafScale})`,
            transformOrigin: "left center",
            boxShadow: "inset 0 -1px 3px rgba(0,0,0,0.1)",
          }}
        />
      )}

      {/* Baby milestone floats */}
      <XPFloat x={centerX - 100} delay={50} text="👶 1er sourire" />
      <XPFloat x={centerX + 10} delay={70} text="🎒 Première nuit" />
      <XPFloat x={centerX - 50} delay={90} text="🍼 1er biberon" />

      {/* Text */}
      <div
        style={{
          position: "absolute",
          bottom: 500,
          width: "100%",
          textAlign: "center",
          opacity: textOpacity,
          fontSize: 34,
          fontWeight: 600,
          color: C.greenDark,
          letterSpacing: -0.5,
        }}
      >
        Chaque instant, précieux
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCENE 3 — Small Tree Growing (225-380)
// ══════════════════════════════════════════════════════════════════
function SceneSmallTree() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const growProgress = interpolate(frame, [0, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const trunkWidth = interpolate(growProgress, [0, 1], [6, 22]);
  const trunkHeight = interpolate(growProgress, [0, 1], [80, 220]);
  const crownSize = interpolate(growProgress, [0.15, 1], [0, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const centerX = 540;
  const groundY = 1200;

  // Branch angles
  const branchProgress = interpolate(frame, [50, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bird V shapes fly in
  const bird1X = interpolate(frame, [70, 120], [-50, centerX - 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const bird2X = interpolate(frame, [85, 130], [1130, centerX + 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const birdOpacity = interpolate(frame, [70, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Swing
  const swingProgress = interpolate(frame, [100, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const swingAngle = Math.sin(frame * 0.04) * 5 * swingProgress;

  // Sky gradient
  const skyOpacity = interpolate(frame, [30, 100], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text
  const textOpacity = interpolate(frame, [110, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [110, 135], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, rgba(56,189,248,${skyOpacity}) 0%, ${C.greenLight} 50%, ${C.earthLight} 100%)`,
        fontFamily: FONT,
      }}
    >
      {/* Ground */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: groundY,
          width: 1080,
          height: 720,
          background: `linear-gradient(180deg, ${C.earthLight} 0%, ${C.earth} 100%)`,
          borderRadius: "50% 50% 0 0",
        }}
      />

      {/* Trunk */}
      <div
        style={{
          position: "absolute",
          left: centerX - trunkWidth / 2,
          top: groundY - trunkHeight,
          width: trunkWidth,
          height: trunkHeight,
          background: `linear-gradient(90deg, ${C.trunk} 0%, ${C.brown} 50%, ${C.trunk} 100%)`,
          borderRadius: `${trunkWidth / 2}px ${trunkWidth / 2}px 4px 4px`,
        }}
      />

      {/* Branches */}
      {branchProgress > 0 && (
        <>
          {/* Left branch */}
          <div
            style={{
              position: "absolute",
              left: centerX - trunkWidth / 2 - 30 * branchProgress,
              top: groundY - trunkHeight + 60,
              width: 40 * branchProgress,
              height: 5,
              background: C.trunk,
              borderRadius: 3,
              transform: "rotate(-30deg)",
              transformOrigin: "right center",
            }}
          />
          {/* Right branch */}
          <div
            style={{
              position: "absolute",
              left: centerX + trunkWidth / 2,
              top: groundY - trunkHeight + 40,
              width: 50 * branchProgress,
              height: 5,
              background: C.trunk,
              borderRadius: 3,
              transform: "rotate(25deg)",
              transformOrigin: "left center",
            }}
          />
          {/* Right lower branch (swing hangs here) */}
          <div
            style={{
              position: "absolute",
              left: centerX + trunkWidth / 2,
              top: groundY - trunkHeight + 100,
              width: 60 * branchProgress,
              height: 5,
              background: C.trunk,
              borderRadius: 3,
              transform: "rotate(15deg)",
              transformOrigin: "left center",
            }}
          />
        </>
      )}

      {/* Crown */}
      {crownSize > 0 && (
        <div
          style={{
            position: "absolute",
            left: centerX - crownSize * 0.7,
            top: groundY - trunkHeight - crownSize * 0.6,
            width: crownSize * 1.4,
            height: crownSize * 1.1,
            background: `radial-gradient(ellipse, ${C.green} 20%, ${C.greenDark} 100%)`,
            borderRadius: "50%",
            boxShadow: `inset 0 -10px 30px rgba(0,0,0,0.1), 0 8px 30px rgba(34,197,94,0.2)`,
          }}
        />
      )}

      {/* Birds */}
      {birdOpacity > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              left: bird1X,
              top: groundY - trunkHeight - 20,
              fontSize: 18,
              opacity: birdOpacity,
              transform: `scaleX(${frame > 100 ? 1 : -1})`,
            }}
          >
            &#x2228;
          </div>
          <div
            style={{
              position: "absolute",
              left: bird2X,
              top: groundY - trunkHeight + 10,
              fontSize: 16,
              opacity: birdOpacity,
            }}
          >
            &#x2228;
          </div>
        </>
      )}

      {/* Swing */}
      {swingProgress > 0 && (
        <div
          style={{
            position: "absolute",
            left: centerX + trunkWidth / 2 + 45,
            top: groundY - trunkHeight + 105,
            transform: `rotate(${swingAngle}deg)`,
            transformOrigin: "top center",
            opacity: swingProgress,
          }}
        >
          {/* Left rope */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 2,
              height: 50,
              background: C.earth,
            }}
          />
          {/* Right rope */}
          <div
            style={{
              position: "absolute",
              left: 22,
              top: 0,
              width: 2,
              height: 50,
              background: C.earth,
            }}
          />
          {/* Seat */}
          <div
            style={{
              position: "absolute",
              left: -2,
              top: 48,
              width: 28,
              height: 6,
              background: C.trunk,
              borderRadius: 2,
            }}
          />
        </div>
      )}

      {/* Text */}
      <div
        style={{
          position: "absolute",
          bottom: 380,
          width: "100%",
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          fontSize: 40,
          fontWeight: 700,
          color: C.greenDark,
          letterSpacing: -1,
        }}
      >
        Il grandit, vous grandissez
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCENE 4 — Majestic Tree, Seasons Montage (375-530)
// ══════════════════════════════════════════════════════════════════
function SceneSeasons() {
  const frame = useCurrentFrame();

  const trunkW = 30;
  const trunkH = 260;
  const crownW = 220;
  const crownH = 170;
  const centerX = 540;
  const groundY = 1250;

  // Season cycle: each ~38 frames
  const seasonFrame = frame % 152; // 4 seasons * 38 frames
  const seasonIndex = Math.floor(seasonFrame / 38);

  // Crown colors for each season
  // Couleurs couronne — progression bébé
  const seasonColors = [
    { main: "#93C5FD", accent: "#BFDBFE" },     // Bleu tendre — biberon
    { main: "#FDA4AF", accent: "#FECDD3" },     // Rose — alimentation
    { main: "#FDE047", accent: "#FEF08A" },     // Jaune soleil — premiers pas
    { main: "#A78BFA", accent: "#C4B5FD" },     // Violet — premiers mots
  ];

  // Smooth crown color transition
  const springAlpha = interpolate(
    seasonFrame,
    [0, 5, 33, 38],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const summerAlpha = interpolate(
    seasonFrame,
    [33, 43, 71, 76],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const autumnAlpha = interpolate(
    seasonFrame,
    [71, 81, 109, 114],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const winterAlpha = interpolate(
    seasonFrame,
    [109, 119, 147, 152],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Background colors — pastel doux bébé
  const bgTop = [
    "#EFF6FF",     // Bleu ciel doux — biberon
    "#FFF1F2",     // Rose tendre — alimentation
    "#FEFCE8",     // Jaune doux — premiers pas
    "#F5F3FF",     // Lavande — premiers mots
  ][seasonIndex];

  const bgBot = [
    "#DBEAFE",
    "#FECDD3",
    "#FEF9C3",
    "#EDE9FE",
  ][seasonIndex];

  // Season labels — 4 étapes majeures bébé
  const seasonEmojis = ["🍼", "🥄", "👣", "💬"];
  const seasonNames = [
    "Premier biberon tout seul",
    "Première purée à la cuillère",
    "Premiers pas",
    "Premiers mots",
  ];

  // Season label opacity
  const labelOpacity = interpolate(
    seasonFrame % 38,
    [0, 8, 28, 38],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Particle configs — soft baby colors per stage
  const particleConfigs = [
    { color: "#93C5FD", shape: "circle" as const, size: 7, count: 10 },   // Bleu doux — biberon
    { color: "#FCA5A5", shape: "petal" as const, size: 9, count: 10 },    // Rose — alimentation
    { color: "#FDE68A", shape: "circle" as const, size: 6, count: 8 },    // Doré — premiers pas
    { color: "#C4B5FD", shape: "circle" as const, size: 8, count: 12 },   // Violet — parole
  ];

  const currentParticle = particleConfigs[seasonIndex];

  // Firefly glow for summer
  const fireflyGlow = seasonIndex === 1
    ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.9])
    : 0;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${bgTop} 0%, ${bgBot} 100%)`,
        fontFamily: FONT,
        transition: "background 0.5s ease",
      }}
    >
      {/* Ground */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: groundY,
          width: 1080,
          height: 670,
          background: `linear-gradient(180deg, ${C.earthLight}, ${C.earth})`,
          borderRadius: "40% 40% 0 0",
        }}
      />

      {/* Trunk */}
      <div
        style={{
          position: "absolute",
          left: centerX - trunkW / 2,
          top: groundY - trunkH,
          width: trunkW,
          height: trunkH,
          background: `linear-gradient(90deg, ${C.trunk} 0%, ${C.brown} 40%, ${C.trunk} 100%)`,
          borderRadius: `${trunkW / 3}px ${trunkW / 3}px 6px 6px`,
        }}
      />

      {/* Large branches */}
      {[
        { x: -65, y: 70, w: 70, angle: -35 },
        { x: 30, y: 45, w: 80, angle: 30 },
        { x: -50, y: 130, w: 55, angle: -25 },
        { x: 30, y: 115, w: 65, angle: 20 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: centerX + b.x,
            top: groundY - trunkH + b.y,
            width: b.w,
            height: 6,
            background: C.trunk,
            borderRadius: 3,
            transform: `rotate(${b.angle}deg)`,
            transformOrigin: b.x > 0 ? "left center" : "right center",
          }}
        />
      ))}

      {/* Crown layers (crossfade per season) */}
      {seasonColors.map((sc, i) => {
        const alpha = [springAlpha, summerAlpha, autumnAlpha, winterAlpha][i];
        if (alpha <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: centerX - crownW / 2,
              top: groundY - trunkH - crownH * 0.55,
              width: crownW,
              height: crownH,
              background: `radial-gradient(ellipse, ${sc.main} 30%, ${sc.accent} 100%)`,
              borderRadius: "50%",
              opacity: alpha,
              boxShadow: `inset 0 -12px 35px rgba(0,0,0,0.12)`,
            }}
          />
        );
      })}

      {/* Falling particles */}
      {Array.from({ length: currentParticle.count }).map((_, i) => (
        <FallingParticle
          key={`${seasonIndex}-${i}`}
          seed={seasonIndex * 100 + i}
          startFrame={0}
          duration={38}
          areaX={centerX - crownW / 2 - 20}
          areaY={groundY - trunkH - crownH * 0.3}
          areaWidth={crownW + 40}
          fallDistance={300}
          size={currentParticle.size}
          color={currentParticle.color}
          shape={currentParticle.shape}
        />
      ))}

      {/* Floating baby milestone emojis per season */}
      {[
        ["🍼", "🧴", "💧"],   // Biberon
        ["🥄", "🥕", "🍎"],   // Cuillère + aliments
        ["👣", "👟", "🧸"],   // Petits pas + doudou
        ["💬", "❤️", "🗣️"],   // Mots + amour
      ][seasonIndex].map((emoji, i) => {
        const baseX = centerX + (i - 1) * 120;
        const floatY = Math.sin((frame + i * 40) * 0.08) * 25;
        const floatX = Math.cos((frame + i * 30) * 0.06) * 15;
        const emojiOpacity = interpolate(
          seasonFrame % 38,
          [2, 10, 28, 36],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const emojiScale = interpolate(
          seasonFrame % 38,
          [2, 12],
          [0.3, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={`baby-${seasonIndex}-${i}`}
            style={{
              position: "absolute",
              left: baseX + floatX,
              top: groundY - trunkH - crownH - 80 + i * 60 + floatY,
              fontSize: 44,
              opacity: emojiOpacity,
              transform: `scale(${emojiScale})`,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))",
            }}
          >
            {emoji}
          </div>
        );
      })}

      {/* Season label */}
      <div
        style={{
          position: "absolute",
          top: 300,
          width: "100%",
          textAlign: "center",
          opacity: labelOpacity,
        }}
      >
        <div style={{ fontSize: 60, marginBottom: 8 }}>
          {seasonEmojis[seasonIndex]}
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: C.black,
            letterSpacing: -0.5,
            lineHeight: 1.2,
            padding: "0 60px",
            textShadow: "0 2px 12px rgba(255,255,255,0.5)",
          }}
        >
          {seasonNames[seasonIndex]}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCENE 5 — Legendary Tree, Full Glory (525-700)
// ══════════════════════════════════════════════════════════════════
function SceneLegendary() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const centerX = 540;
  const groundY = 1300;
  const trunkW = 40;
  const trunkH = 340;
  const crownW = 280;
  const crownH = 220;

  // Entrance: tree scales up
  const treeScale = spr(frame, fps, { damping: 25, stiffness: 90 }, 0);

  // Golden aura pulse
  const auraPulse = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.3, 0.7]
  );
  const auraScale = interpolate(
    Math.sin(frame * 0.03),
    [-1, 1],
    [1.0, 1.08]
  );

  // Stars
  const stars = Array.from({ length: 40 }).map((_, i) => ({
    x: seededRandom(i * 7) * 1080,
    y: seededRandom(i * 13 + 3) * 800,
    size: 1.5 + seededRandom(i * 19) * 2.5,
    delay: i * 3,
  }));

  // Fairy figure-8 motion
  const fairyX = centerX + Math.sin(frame * 0.04) * 100;
  const fairyY =
    groundY - trunkH - crownH * 0.3 + Math.sin(frame * 0.08) * 40;
  const fairyGlow = interpolate(
    Math.sin(frame * 0.12),
    [-1, 1],
    [0.5, 1]
  );

  // Text fade in
  const textOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [60, 90], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle
  const subOpacity = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${C.night} 0%, ${C.nightPurple} 50%, #2E1065 100%)`,
        fontFamily: FONT,
      }}
    >
      {/* Stars */}
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: C.white,
            opacity: interpolate(
              Math.sin((frame - s.delay) * 0.06),
              [-1, 1],
              [0.2, 0.9]
            ),
          }}
        />
      ))}

      {/* Ground (dark) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: groundY,
          width: 1080,
          height: 620,
          background: `linear-gradient(180deg, #1C1917 0%, #0C0A09 100%)`,
          borderRadius: "35% 35% 0 0",
        }}
      />

      {/* Golden aura ring */}
      <div
        style={{
          position: "absolute",
          left: centerX - crownW * 0.9,
          top: groundY - trunkH - crownH * 0.8,
          width: crownW * 1.8,
          height: crownH * 1.6 + 100,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(255,215,0,${auraPulse * 0.2}) 0%, transparent 70%)`,
          transform: `scale(${auraScale * treeScale})`,
          filter: "blur(20px)",
        }}
      />

      {/* Tree group */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1080,
          height: 1920,
          transform: `scale(${treeScale})`,
          transformOrigin: `${centerX}px ${groundY}px`,
        }}
      >
        {/* Trunk (massive) */}
        <div
          style={{
            position: "absolute",
            left: centerX - trunkW / 2,
            top: groundY - trunkH,
            width: trunkW,
            height: trunkH,
            background: `linear-gradient(90deg, ${C.trunk} 0%, #8B6914 50%, ${C.trunk} 100%)`,
            borderRadius: `${trunkW / 3}px ${trunkW / 3}px 8px 8px`,
            boxShadow: "0 0 30px rgba(255,215,0,0.15)",
          }}
        />

        {/* Large branches */}
        {[
          { x: -90, y: 60, w: 95, angle: -35, h: 8 },
          { x: 40, y: 40, w: 110, angle: 28, h: 8 },
          { x: -70, y: 120, w: 75, angle: -20, h: 7 },
          { x: 40, y: 100, w: 85, angle: 22, h: 7 },
          { x: -55, y: 180, w: 60, angle: -30, h: 6 },
          { x: 40, y: 170, w: 70, angle: 18, h: 6 },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: centerX + b.x,
              top: groundY - trunkH + b.y,
              width: b.w,
              height: b.h,
              background: C.trunk,
              borderRadius: b.h / 2,
              transform: `rotate(${b.angle}deg)`,
              transformOrigin: b.x > 0 ? "left center" : "right center",
            }}
          />
        ))}

        {/* Crown — majestic golden-green */}
        <div
          style={{
            position: "absolute",
            left: centerX - crownW / 2,
            top: groundY - trunkH - crownH * 0.55,
            width: crownW,
            height: crownH,
            background: `radial-gradient(ellipse, ${C.green} 20%, ${C.greenDark} 70%, #064E3B 100%)`,
            borderRadius: "50%",
            boxShadow: `0 0 60px rgba(34,197,94,0.3), 0 0 100px rgba(255,215,0,${auraPulse * 0.2})`,
          }}
        />
        {/* Crown highlight */}
        <div
          style={{
            position: "absolute",
            left: centerX - crownW * 0.35,
            top: groundY - trunkH - crownH * 0.45,
            width: crownW * 0.7,
            height: crownH * 0.5,
            background: `radial-gradient(ellipse, rgba(255,215,0,0.15) 0%, transparent 70%)`,
            borderRadius: "50%",
          }}
        />

        {/* Lantern */}
        <div
          style={{
            position: "absolute",
            left: centerX + 75,
            top: groundY - trunkH + 45,
          }}
        >
          <div
            style={{
              width: 3,
              height: 20,
              background: C.earth,
              margin: "0 auto",
            }}
          />
          <div
            style={{
              width: 16,
              height: 20,
              background: `radial-gradient(circle, ${C.gold} 30%, ${C.amber} 100%)`,
              borderRadius: "3px 3px 8px 8px",
              boxShadow: `0 0 20px ${C.gold}, 0 0 40px rgba(255,215,0,0.4)`,
              opacity: interpolate(
                Math.sin(frame * 0.08),
                [-1, 1],
                [0.7, 1]
              ),
            }}
          />
        </div>

        {/* Owl emoji */}
        <div
          style={{
            position: "absolute",
            left: centerX - 85,
            top: groundY - trunkH + 55,
            fontSize: 28,
          }}
        >
          🦉
        </div>

        {/* Butterflies */}
        {[0, 1, 2].map((i) => {
          const bx =
            centerX +
            Math.sin(frame * 0.03 + i * 2.1) * (80 + i * 30);
          const by =
            groundY -
            trunkH -
            crownH * 0.2 +
            Math.cos(frame * 0.04 + i * 1.7) * 50;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: bx,
                top: by,
                fontSize: 20,
                transform: `scaleX(${Math.sin(frame * 0.15 + i) > 0 ? 1 : -1})`,
              }}
            >
              🦋
            </div>
          );
        })}
      </div>

      {/* Fairy (glowing dot with figure-8) */}
      <div
        style={{
          position: "absolute",
          left: fairyX,
          top: fairyY,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: C.gold,
          opacity: fairyGlow,
          boxShadow: `0 0 12px ${C.gold}, 0 0 24px rgba(255,215,0,0.5), 0 0 48px rgba(255,215,0,0.2)`,
        }}
      />

      {/* Main text — journal intime */}
      <div
        style={{
          position: "absolute",
          bottom: 500,
          width: "100%",
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          padding: "0 50px",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: C.gold,
            letterSpacing: -1,
            lineHeight: 1.2,
            textShadow: `0 0 30px rgba(255,215,0,0.6), 0 4px 16px rgba(0,0,0,0.5)`,
          }}
        >
          Du nourrisson à l'adulte
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          bottom: 420,
          width: "100%",
          textAlign: "center",
          opacity: subOpacity,
          padding: "0 60px",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: 0.5,
            lineHeight: 1.4,
          }}
        >
          Un journal pour ne rien oublier
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCENE 6 — Emotional Closing (695-900)
// ══════════════════════════════════════════════════════════════════
function SceneClosing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Silhouette tree (simplified dark shape)
  const centerX = 540;
  const groundY = 1200;
  const trunkW = 35;
  const trunkH = 280;
  const crownW = 240;
  const crownH = 190;

  // Sunset background warmth
  const sunsetProgress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Tree silhouette opacity (duration: 130 frames)
  const treeOpacity = interpolate(frame, [0, 15, 55, 70], [0, 0.9, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typewriter texts
  const line1 = tw("Grandissez ensemble.", frame, 10, 1.0);
  const line1Opacity = interpolate(frame, [8, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2 = tw("Un jour à la fois.", frame, 40, 0.9);
  const line2Opacity = interpolate(frame, [38, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // App icon + brand
  const iconScale = spr(frame, fps, { damping: 20, stiffness: 100 }, 60);
  const brandOpacity = interpolate(frame, [72, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline
  const taglineOpacity = interpolate(frame, [85, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final fade out
  const whiteOverlay = interpolate(frame, [115, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg,
          #F97316 0%,
          #EC4899 35%,
          ${C.nightPurple} 70%,
          ${C.night} 100%)`,
        fontFamily: FONT,
      }}
    >
      {/* Tree silhouette */}
      <div style={{ opacity: treeOpacity }}>
        {/* Trunk silhouette */}
        <div
          style={{
            position: "absolute",
            left: centerX - trunkW / 2,
            top: groundY - trunkH,
            width: trunkW,
            height: trunkH,
            background: "rgba(0,0,0,0.85)",
            borderRadius: `${trunkW / 3}px ${trunkW / 3}px 6px 6px`,
          }}
        />
        {/* Branch silhouettes */}
        {[
          { x: -80, y: 50, w: 85, angle: -35 },
          { x: 35, y: 35, w: 100, angle: 28 },
          { x: -60, y: 110, w: 65, angle: -22 },
          { x: 35, y: 95, w: 75, angle: 20 },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: centerX + b.x,
              top: groundY - trunkH + b.y,
              width: b.w,
              height: 7,
              background: "rgba(0,0,0,0.85)",
              borderRadius: 4,
              transform: `rotate(${b.angle}deg)`,
              transformOrigin: b.x > 0 ? "left center" : "right center",
            }}
          />
        ))}
        {/* Crown silhouette */}
        <div
          style={{
            position: "absolute",
            left: centerX - crownW / 2,
            top: groundY - trunkH - crownH * 0.55,
            width: crownW,
            height: crownH,
            background: "rgba(0,0,0,0.85)",
            borderRadius: "50%",
          }}
        />
      </div>

      {/* Ground silhouette */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: groundY + 10,
          width: 1080,
          height: 710,
          background: "rgba(0,0,0,0.75)",
          borderRadius: "40% 40% 0 0",
          opacity: treeOpacity,
        }}
      />

      {/* Text: Grandissez ensemble */}
      <div
        style={{
          position: "absolute",
          top: 350,
          width: "100%",
          textAlign: "center",
          opacity: line1Opacity,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: C.white,
            letterSpacing: -1.5,
            textShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {line1}
          <span style={{ opacity: frame % 30 < 18 && frame < 65 ? 1 : 0 }}>
            |
          </span>
        </div>
      </div>

      {/* Text: Un jour à la fois */}
      <div
        style={{
          position: "absolute",
          top: 430,
          width: "100%",
          textAlign: "center",
          opacity: line2Opacity,
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: -0.5,
            textShadow: "0 3px 16px rgba(0,0,0,0.3)",
          }}
        >
          {line2}
          <span
            style={{
              opacity: frame % 30 < 18 && frame > 65 && frame < 110 ? 1 : 0,
            }}
          >
            |
          </span>
        </div>
      </div>

      {/* App icon */}
      <div
        style={{
          position: "absolute",
          bottom: 620,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <AppIcon size={90} scale={iconScale} />
      </div>

      {/* Brand name */}
      <div
        style={{
          position: "absolute",
          bottom: 540,
          width: "100%",
          textAlign: "center",
          opacity: brandOpacity,
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: C.white,
            letterSpacing: -0.5,
            textShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          Family Flow
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 480,
          width: "100%",
          textAlign: "center",
          opacity: taglineOpacity,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: 2,
            textShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          Chaque étape compte
        </div>
      </div>

      {/* White fade overlay */}
      <AbsoluteFill
        style={{
          background: C.white,
          opacity: whiteOverlay,
        }}
      />
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ══════════════════════════════════════════════════════════════════
export const Video3_GrowingTree: React.FC = () => {
  const T = 15; // cross-fade overlap

  const scenes = [
    { start: 0, end: 80 },      // S0 — French Slogan
    { start: 75, end: 175 },    // S1 — The Seed
    { start: 170, end: 305 },   // S2 — Sprouting
    { start: 300, end: 455 },   // S3 — Small Tree Growing
    { start: 450, end: 605 },   // S4 — Seasons Montage
    { start: 600, end: 775 },   // S5 — Legendary Tree
    { start: 770, end: 900 },   // S6 — Emotional Closing
  ];

  const sceneComponents = [
    <SceneSlogan />,
    <SceneSeed />,
    <SceneSprouting />,
    <SceneSmallTree />,
    <SceneSeasons />,
    <SceneLegendary />,
    <SceneClosing />,
  ];

  return (
    <AbsoluteFill style={{ background: C.cream, overflow: "hidden" }}>
      {/* Background music */}
      <Audio
        src={staticFile("music-emotional.mp3")}
        volume={(f) =>
          interpolate(f, [0, 20, 860, 900], [0, 0.3, 0.3, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Scenes */}
      {scenes.map((s, i) => {
        const duration = s.end - s.start;
        return (
          <Sequence
            key={i}
            from={s.start}
            durationInFrames={duration + T}
            premountFor={T}
          >
            <SceneFade duration={duration} overlap={T}>
              {sceneComponents[i]}
            </SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
