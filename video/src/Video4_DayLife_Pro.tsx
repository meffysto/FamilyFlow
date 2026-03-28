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

// ── Day Color Palettes ──
const PAL = {
  dawn1: "#FDF2F8", dawn2: "#FBBF24", dawnAccent: "#F43F5E",
  morn1: "#EFF6FF", morn2: "#3B82F6", mornAccent: "#60A5FA",
  aft1: "#ECFEFF", aft2: "#06B6D4", aftAccent: "#8B5CF6",
  eve1: "#FFF7ED", eve2: "#F97316", eveAccent: "#EC4899",
  night1: "#1E1B4B", night2: "#312E81", nightAccent: "#A78BFA",
};

const C = {
  white: "#FFFFFF",
  black: "#111827",
  green: "#10B981",
  muted: "#6B7280",
  card: "#FFFFFF",
  border: "#E5E7EB",
};

// ── Helpers ──
function spr(frame: number, fps: number, cfg: Record<string, number> = { damping: 200 }, delay = 0) {
  return spring({ frame: frame - delay, fps, config: cfg as any });
}

function tw(text: string, frame: number, startFrame = 0, speed = 1.5) {
  const chars = Math.floor(Math.max(0, frame - startFrame) * speed);
  return text.slice(0, chars);
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

// ── Seeded random for deterministic particles ──
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ══════════════════════════════════════════════
// UPGRADE 1: SceneWipe (horizontal wipe transition)
// ══════════════════════════════════════════════
function SceneWipe({ children, durationInFrames }: { children: React.ReactNode; durationInFrames: number }) {
  const frame = useCurrentFrame();

  // Smooth crossfade with subtle zoom
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const opacity = Math.min(fadeIn, fadeOut);

  // Subtle scale: starts slightly zoomed, settles to 1
  const scaleIn = interpolate(frame, [0, 18], [1.03, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scaleIn})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 2: Morphing Clock
// ══════════════════════════════════════════════
function MorphingClock({
  fromTime,
  toTime,
}: {
  fromTime: string;
  toTime: string;
}) {
  const frame = useCurrentFrame();

  const fromDigits = fromTime.split("");
  const toDigits = toTime.split("");

  // Full-screen interstitial: fade in, hold, fade out
  const bgOpacity = interpolate(frame, [0, 6, 24, 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        zIndex: 50,
        opacity: bgOpacity,
      }}
    >
      {/* Dark scrim that hides the scenes underneath */}
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.6)" }} />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", gap: 0, fontFamily: FONT }}>
          {fromDigits.map((fromChar, i) => {
            const toChar = toDigits[i] || fromChar;
            const isSeparator = fromChar === ":";

            if (isSeparator) {
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 96,
                    fontWeight: 200,
                    color: C.white,
                    textShadow: "0 4px 30px rgba(0,0,0,0.3)",
                    letterSpacing: 2,
                    width: 30,
                    textAlign: "center",
                  }}
                >
                  :
                </span>
              );
            }

            // Each digit has a staggered animation
            const digitDelay = 4 + i * 3;
            const progress = interpolate(frame - digitDelay, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });

            const fromY = interpolate(progress, [0, 1], [0, -50]);
            const fromOpacity = interpolate(progress, [0, 0.5], [1, 0], { extrapolateRight: "clamp" });
            const toY = interpolate(progress, [0, 1], [40, 0]);
            const toOpacity = interpolate(progress, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" });

            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  width: 56,
                  height: 110,
                  overflow: "hidden",
                }}
              >
                {/* From digit */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 96,
                    fontWeight: 200,
                    color: C.white,
                    textShadow: "0 4px 30px rgba(0,0,0,0.3)",
                    transform: `translateY(${fromY}px)`,
                    opacity: fromOpacity,
                  }}
                >
                  {fromChar}
                </div>
                {/* To digit */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 96,
                    fontWeight: 200,
                    color: C.white,
                    textShadow: "0 4px 30px rgba(0,0,0,0.3)",
                    transform: `translateY(${toY}px)`,
                    opacity: toOpacity,
                  }}
                >
                  {toChar}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 3: Atmospheric Particles
// ══════════════════════════════════════════════
function AtmosphericParticles({
  type,
  count = 20,
}: {
  type: "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night";
  count?: number;
}) {
  const frame = useCurrentFrame();

  const particles = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: seededRandom(i * 17 + 3) * 1080,
      y: seededRandom(i * 31 + 7) * 1920,
      size: 5 + seededRandom(i * 41 + 11) * 12,
      speed: 0.3 + seededRandom(i * 53 + 13) * 0.7,
      phase: seededRandom(i * 67 + 19) * Math.PI * 2,
      delay: seededRandom(i * 79 + 23) * 30,
    }));
  }, [count]);

  const getParticleStyle = (p: (typeof particles)[0], i: number): React.CSSProperties => {
    const t = frame + p.delay;
    const baseX = p.x + Math.sin(t * 0.03 * p.speed + p.phase) * 40;
    const baseOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

    switch (type) {
      case "dawn": {
        // Golden sparkles rising upward
        const y = p.y - t * p.speed * 2;
        const wrappedY = ((y % 1920) + 1920) % 1920;
        const twinkle = 0.4 + 0.6 * Math.sin(t * 0.08 + p.phase);
        return {
          position: "absolute",
          left: baseX,
          top: wrappedY,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          background: `radial-gradient(circle, rgba(251,191,36,0.8) 0%, rgba(251,191,36,0) 70%)`,
          opacity: twinkle * baseOpacity,
          boxShadow: `0 0 ${p.size * 3}px rgba(251,191,36,0.6)`,
        };
      }
      case "morning": {
        // Gentle floating light motes
        const y = p.y + Math.cos(t * 0.02 + p.phase) * 30;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.05 + p.phase);
        return {
          position: "absolute",
          left: baseX,
          top: y,
          width: p.size * 0.8,
          height: p.size * 0.8,
          borderRadius: "50%",
          background: `rgba(255,255,255,0.8)`,
          opacity: twinkle * baseOpacity * 0.8,
          filter: `blur(${1 + p.size * 0.15}px)`,
        };
      }
      case "midday": {
        // Warm golden dust drifting slowly
        const y = p.y + Math.sin(t * 0.015 + p.phase) * 20;
        const x = baseX + t * p.speed * 0.3;
        const wrappedX = ((x % 1080) + 1080) % 1080;
        return {
          position: "absolute",
          left: wrappedX,
          top: y,
          width: p.size * 0.6,
          height: p.size * 0.6,
          borderRadius: "50%",
          background: `rgba(234,179,8,0.7)`,
          opacity: baseOpacity * 0.7,
          filter: `blur(1px)`,
        };
      }
      case "afternoon": {
        // Soft bokeh circles
        const y = p.y + Math.sin(t * 0.02 + p.phase) * 25;
        const bokehSize = p.size * 2 + Math.sin(t * 0.03 + p.phase) * 3;
        return {
          position: "absolute",
          left: baseX,
          top: y,
          width: bokehSize,
          height: bokehSize,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0.1) 60%, transparent 100%)`,
          border: `1px solid rgba(139,92,246,0.2)`,
          opacity: baseOpacity * 0.85,
        };
      }
      case "evening": {
        // Orange/pink floating embers
        const y = p.y - t * p.speed * 1.5;
        const wrappedY = ((y % 1920) + 1920) % 1920;
        const flicker = 0.3 + 0.7 * Math.sin(t * 0.1 + p.phase);
        return {
          position: "absolute",
          left: baseX,
          top: wrappedY,
          width: p.size * 0.5,
          height: p.size * 0.5,
          borderRadius: "50%",
          background: i % 2 === 0 ? `rgba(249,115,22,0.7)` : `rgba(236,72,153,0.6)`,
          opacity: flicker * baseOpacity * 0.9,
          boxShadow: `0 0 ${p.size * 2}px ${i % 2 === 0 ? "rgba(249,115,22,0.6)" : "rgba(236,72,153,0.5)"}`,
        };
      }
      case "night": {
        // Enhanced twinkling stars
        const twinkle = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.06 + p.phase));
        return {
          position: "absolute",
          left: p.x,
          top: p.y * 0.6,
          width: p.size * 0.5,
          height: p.size * 0.5,
          borderRadius: "50%",
          background: C.white,
          opacity: twinkle * baseOpacity,
          boxShadow: `0 0 ${p.size * 2}px rgba(255,255,255,0.5)`,
        };
      }
    }
  };

  return (
    <>
      {particles.map((p, i) => (
        <div key={i} style={getParticleStyle(p, i)} />
      ))}
    </>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 4: Sun/Moon Arc
// ══════════════════════════════════════════════
function CelestialArc() {
  const frame = useCurrentFrame();

  // iPhone center ≈ (540, 1050), half-width ≈ 280
  const cx = 540;
  const cy = 1050;
  const rx = 380;  // horizontal radius (wider than iPhone)
  const ryTop = 950;  // vertical radius up (reaches near top of screen)
  const ryBot = 950;  // vertical radius down (symmetrical with sun)

  // ── Sun: elliptical arc OVER the top of iPhone ──
  // angle from π (left) to 0 (right), peak at π/2 (top)
  const sunVisible = frame <= 520;
  const sunAngle = interpolate(frame, [0, 520], [Math.PI, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sunX = cx + rx * Math.cos(sunAngle);
  const sunY = cy - ryTop * Math.sin(sunAngle);
  const sunOpacity = interpolate(frame, [0, 30, 470, 520], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Moon: elliptical arc UNDER the bottom of iPhone ──
  // angle from 0 (right) to π (left), dip at π/2 (bottom)
  // Hide before Night scene (frame 680) which has its own moon
  const moonVisible = frame >= 380 && frame <= 680;
  const moonAngle = interpolate(frame, [380, 680], [0, Math.PI], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const moonX = cx + rx * Math.cos(moonAngle);
  const moonY = cy + ryBot * Math.sin(moonAngle);
  const moonOpacity = interpolate(frame, [380, 420, 650, 680], [0, 0.8, 0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {sunVisible && (
        <div
          style={{
            position: "absolute",
            left: sunX,
            top: sunY,
            width: 50,
            height: 50,
            borderRadius: 25,
            background: "radial-gradient(circle, #FBBF24 0%, #F59E0B 60%, rgba(245,158,11,0) 100%)",
            opacity: sunOpacity,
            boxShadow: "0 0 60px 20px rgba(251,191,36,0.3), 0 0 120px 40px rgba(251,191,36,0.1)",
            zIndex: 1,
            transform: "translate(-25px, -25px)",
          }}
        />
      )}
      {moonVisible && (
        <div
          style={{
            position: "absolute",
            left: moonX,
            top: moonY,
            opacity: moonOpacity,
            zIndex: 1,
            transform: "translate(-20px, -20px)",
          }}
        >
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <div
              style={{
                position: "absolute",
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "#FEFCE8",
                boxShadow: "0 0 30px 8px rgba(254,252,232,0.2)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 10,
                top: -4,
                width: 36,
                height: 36,
                borderRadius: 18,
                background: lerpColor(PAL.night1, PAL.night2, 0.5),
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 5: Enhanced iOS Status Bar
// ══════════════════════════════════════════════
function StatusBarPro({ time = "9:41", dark = false }: { time?: string; dark?: boolean }) {
  const color = dark ? C.white : C.black;
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
      <span style={{ fontSize: 16, fontWeight: 600, color }}>{time}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* Cellular signal bars */}
        <div style={{ display: "flex", gap: 1.5, alignItems: "flex-end" }}>
          {[5, 7, 9, 11].map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                background: color,
                opacity: i < 3 ? 1 : 0.35,
                borderRadius: 0.5,
              }}
            />
          ))}
        </div>
        {/* Wi-Fi icon (3 arcs) */}
        <svg width={14} height={11} viewBox="0 0 14 11" style={{ marginLeft: 2 }}>
          <path
            d="M7 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
            fill={color}
          />
          <path
            d="M4.5 7.5a3.5 3.5 0 0 1 5 0"
            stroke={color}
            strokeWidth={1.3}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M2.2 5a6.5 6.5 0 0 1 9.6 0"
            stroke={color}
            strokeWidth={1.3}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M0 2.5a10 10 0 0 1 14 0"
            stroke={color}
            strokeWidth={1.3}
            fill="none"
            strokeLinecap="round"
            opacity={0.4}
          />
        </svg>
        {/* Battery */}
        <div
          style={{
            width: 22,
            height: 11,
            border: `1.5px solid ${color}`,
            borderRadius: 3,
            padding: 1.5,
            position: "relative",
            marginLeft: 2,
          }}
        >
          <div style={{ width: "75%", height: "100%", background: color, borderRadius: 1.5 }} />
          <div
            style={{
              position: "absolute",
              right: -4,
              top: "50%",
              transform: "translateY(-50%)",
              width: 2,
              height: 5,
              background: color,
              borderRadius: "0 1px 1px 0",
              opacity: 0.4,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 7: Glass Reflection on iPhone
// ══════════════════════════════════════════════
function GlassReflection({ triggerFrame = 30 }: { triggerFrame?: number }) {
  const frame = useCurrentFrame();

  const sweepProgress = interpolate(frame - triggerFrame, [0, 35], [-150, 150], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sweepOpacity = interpolate(frame - triggerFrame, [0, 5, 28, 35], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (frame < triggerFrame || frame > triggerFrame + 40) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: 34,
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          top: "-50%",
          left: "-50%",
          background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 60%, transparent 100%)",
          transform: `translate(${sweepProgress}%, ${sweepProgress}%)`,
          opacity: sweepOpacity,
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 8: Cinematic Typography
// ══════════════════════════════════════════════
function CinematicLabel({
  time,
  label,
}: {
  time: string;
  label: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fullText = `${time} — ${label}`;
  const chars = Array.from(fullText);

  const overallOpacity = interpolate(frame, [30, 45], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [8, 14, 30, 45], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        left: 60,
        zIndex: 40,
        opacity: overallOpacity,
      }}
    >
      <div style={{ display: "flex", fontFamily: FONT }}>
        {chars.map((char, i) => {
          const charDelay = i * 1;
          const charSpring = spr(frame, fps, { damping: 12, stiffness: 120 }, charDelay);
          const charY = interpolate(charSpring, [0, 1], [-20, 0]);
          const charOpacity = interpolate(charSpring, [0, 1], [0, 1]);

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontSize: 32,
                fontWeight: 700,
                color: C.white,
                textShadow: "0 2px 16px rgba(0,0,0,0.3)",
                transform: `translateY(${charY}px)`,
                opacity: charOpacity,
                letterSpacing: char === " " ? 4 : 0.5,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 16,
          fontWeight: 400,
          fontStyle: "italic",
          color: "rgba(255,255,255,0.65)",
          marginTop: 6,
          opacity: subtitleOpacity,
          textShadow: "0 1px 10px rgba(0,0,0,0.2)",
        }}
      >
        Château-Dupont, Jeudi
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// UPGRADE 10: Shooting Stars
// ══════════════════════════════════════════════
function ShootingStars() {
  const frame = useCurrentFrame();

  const stars = [
    { startFrame: 30, x1: 900, y1: 100, x2: 200, y2: 600 },
    { startFrame: 80, x1: 700, y1: 50, x2: 100, y2: 500 },
    { startFrame: 140, x1: 1000, y1: 200, x2: 300, y2: 700 },
  ];

  return (
    <>
      {stars.map((star, i) => {
        const localFrame = frame - star.startFrame;
        if (localFrame < 0 || localFrame > 12) return null;

        const progress = interpolate(localFrame, [0, 10], [0, 1], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        });
        const opacity = interpolate(localFrame, [0, 3, 8, 12], [0, 1, 0.8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const x = interpolate(progress, [0, 1], [star.x1, star.x2]);
        const y = interpolate(progress, [0, 1], [star.y1, star.y2]);

        // Trail
        const trailLength = 60;
        const angle = Math.atan2(star.y2 - star.y1, star.x2 - star.x1);
        const trailX = x - Math.cos(angle) * trailLength;
        const trailY = y - Math.sin(angle) * trailLength;

        const angleDeg = (angle * 180) / Math.PI;

        return (
          <React.Fragment key={i}>
            {/* Trail line */}
            <div
              style={{
                position: "absolute",
                left: trailX,
                top: trailY,
                width: trailLength,
                height: 2,
                background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 100%)`,
                transform: `rotate(${angleDeg}deg)`,
                transformOrigin: "right center",
                opacity: opacity * 0.7,
                borderRadius: 1,
              }}
            />
            {/* Head */}
            <div
              style={{
                position: "absolute",
                left: x - 3,
                top: y - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                background: C.white,
                opacity,
                boxShadow: "0 0 10px 3px rgba(255,255,255,0.6)",
              }}
            />
          </React.Fragment>
        );
      })}
    </>
  );
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
      <Img src={staticFile("icon.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

// ── iPhone Mockup with Glass Reflection & Micro-Scroll ──
function IPhonePro({
  children,
  style = {},
  reflectionDelay = 30,
  scrollOffset = 0,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  reflectionDelay?: number;
  scrollOffset?: number;
}) {
  return (
    <div
      style={{
        width: 560,
        height: 1214,
        background: "#1A1A1A",
        borderRadius: 60,
        padding: 12,
        boxShadow: "0 0 0 2px #2A2A2A, 0 24px 64px rgba(0,0,0,0.45)",
        position: "relative",
        ...style,
      }}
    >
      {/* Right button */}
      <div
        style={{
          position: "absolute",
          right: -4,
          top: 130,
          width: 4,
          height: 90,
          background: "#2A2A2A",
          borderRadius: "0 3px 3px 0",
        }}
      />
      {/* Left buttons */}
      <div
        style={{
          position: "absolute",
          left: -4,
          top: 120,
          width: 4,
          height: 42,
          background: "#2A2A2A",
          borderRadius: "4px 0 0 4px",
          boxShadow: "0 60px 0 #2A2A2A, 0 108px 0 #2A2A2A",
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F9FAFB",
          borderRadius: 52,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 130,
            height: 34,
            background: "#000",
            borderRadius: 20,
            zIndex: 10,
          }}
        />
        {/* Glass reflection (upgrade 7) */}
        <GlassReflection triggerFrame={reflectionDelay} />
        {/* Content with micro-scroll (upgrade 6) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            transform: `translateY(${scrollOffset}px)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Card ──
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        fontFamily: FONT,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Bottom Tab Bar ──
function TabBar({ activeIndex = 0 }: { activeIndex?: number }) {
  const tabs = [
    { icon: "\u{1F3E0}", label: "Accueil" },
    { icon: "\u{1F4C5}", label: "Calendrier" },
    { icon: "\u2705", label: "Tâches" },
    { icon: "\u{1F6D2}", label: "Courses" },
    { icon: "\u{1F464}", label: "Profil" },
  ];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "8px 0 16px",
        background: C.white,
        borderTop: `1px solid ${C.border}`,
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      {tabs.map((tab, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            opacity: i === activeIndex ? 1 : 0.45,
          }}
        >
          <span style={{ fontSize: 24 }}>{tab.icon}</span>
          <span style={{ fontSize: 12, fontWeight: i === activeIndex ? 700 : 500, color: i === activeIndex ? PAL.morn2 : C.muted }}>
            {tab.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Dynamic Background Gradient ──
function DayBackground() {
  const frame = useCurrentFrame();

  const stops: [number, string, string][] = [
    [0, PAL.dawn1, PAL.dawnAccent],
    [90, PAL.dawn1, PAL.dawn2],
    [150, PAL.morn1, PAL.morn2],
    [300, PAL.aft1, PAL.aft2],
    [440, PAL.aft1, PAL.aftAccent],
    [550, PAL.eve1, PAL.eve2],
    [680, PAL.eve1, PAL.eveAccent],
    [720, PAL.night1, PAL.night2],
    [900, PAL.night1, PAL.night2],
  ];

  let top = stops[0][1];
  let bot = stops[0][2];

  for (let i = 0; i < stops.length - 1; i++) {
    const [fA, tA, bA] = stops[i];
    const [fB, tB, bB] = stops[i + 1];
    if (frame >= fA && frame <= fB) {
      const t = (frame - fA) / (fB - fA);
      top = lerpColor(tA, tB, t);
      bot = lerpColor(bA, bB, t);
      break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(170deg, ${top} 0%, ${bot} 100%)`,
      }}
    />
  );
}

// ══════════════════════════════════════════════
// UPGRADE 9: Split Screen Recap
// ══════════════════════════════════════════════
function SplitScreenRecap() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scenes = [
    { time: "06:00", emoji: "\u{1F305}", label: "Aube", gradient: [PAL.dawn2, PAL.dawnAccent] },
    { time: "08:12", emoji: "\u{1F4CB}", label: "Matin", gradient: [PAL.morn2, PAL.mornAccent] },
    { time: "12:03", emoji: "\u{1F4C5}", label: "Midi", gradient: [PAL.aft2, PAL.aftAccent] },
    { time: "15:22", emoji: "\u{1F6D2}", label: "Après-midi", gradient: [PAL.aft2, PAL.aftAccent] },
    { time: "19:15", emoji: "\u{1F3C6}", label: "Soir", gradient: [PAL.eve2, PAL.eveAccent] },
  ];

  // Fade in/out for the whole recap
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [30, 40], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        opacity: Math.min(fadeIn, fadeOut),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: 20,
          width: 960,
          height: 1400,
          padding: 20,
        }}
      >
        {scenes.map((scene, i) => {
          const stagger = i * 3;
          const s = spr(frame, fps, { damping: 12, stiffness: 120 }, stagger);
          const cellScale = interpolate(s, [0, 1], [0.3, 1]);
          const cellOpacity = interpolate(s, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                background: `linear-gradient(135deg, ${scene.gradient[0]}, ${scene.gradient[1]})`,
                borderRadius: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transform: `scale(${cellScale})`,
                opacity: cellOpacity,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              <span style={{ fontSize: 36 }}>{scene.emoji}</span>
              <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.white }}>
                {scene.time}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>
                {scene.label}
              </span>
            </div>
          );
        })}
        {/* 6th slot: App icon */}
        <div
          style={{
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            opacity: interpolate(
              spr(frame, fps, { damping: 12, stiffness: 120 }, 15),
              [0, 1],
              [0, 1]
            ),
            transform: `scale(${interpolate(
              spr(frame, fps, { damping: 12, stiffness: 120 }, 15),
              [0, 1],
              [0.3, 1]
            )})`,
          }}
        >
          <AppIcon size={70} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════
// SCENE 0: Slogan — "Le second cerveau"
// ════════════════════════════════════════════
function SceneSlogan() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // App icon bounces in first
  const iconSpring = spr(frame, fps, { damping: 10, stiffness: 80 }, 0);
  const iconScale = interpolate(iconSpring, [0, 1], [0, 1]);
  const iconOpacity = interpolate(iconSpring, [0, 1], [0, 1]);

  // Title scales up with punch
  const titleSpring = spr(frame, fps, { damping: 12, stiffness: 100 }, 18);
  const titleScale = interpolate(titleSpring, [0, 1], [0.7, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const line1 = tw("Le second cerveau", frame, 18, 1.2);

  // Subtitle slides up
  const sub = spr(frame, fps, { damping: 14, stiffness: 80 }, 45);
  const subOpacity = interpolate(sub, [0, 1], [0, 1]);
  const subY = interpolate(sub, [0, 1], [30, 0]);

  // Subtle animated gradient background
  const gradientAngle = interpolate(frame, [0, 80], [140, 160], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradientAngle}deg, #FAFAFA 0%, #F3E8FF 40%, #EDE9FE 70%, #F5F3FF 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 60px",
        gap: 24,
      }}
    >
      {/* App icon */}
      <div style={{ opacity: iconOpacity, transform: `scale(${iconScale})`, marginBottom: 12 }}>
        <AppIcon size={110} />
      </div>

      {/* Title with scale punch */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 54,
          fontWeight: 800,
          color: "#111827",
          textAlign: "center",
          letterSpacing: -2,
          lineHeight: 1.1,
          minHeight: 70,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        {line1}<span style={{ opacity: frame % 30 < 18 ? 1 : 0, color: "#7C3AED" }}>|</span>
      </div>

      {/* Subtitle in violet */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 600,
          color: "#7C3AED",
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
        }}
      >
        que votre famille mérite
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════
// SCENE 1: Dawn — 06:00 "Le r\u00E9veil"
// ════════════════════════════════════════════
function SceneDawn() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Typewriter starts at frame 10 (no more 06:00 clock)
  const typed = tw("Une nouvelle journée commence", frame, 10, 1.2);

  const clouds = [
    { x: -200, y: 400, w: 140, h: 36, speed: 0.6, delay: 20 },
    { x: -300, y: 550, w: 180, h: 40, speed: 0.45, delay: 0 },
    { x: -150, y: 700, w: 120, h: 30, speed: 0.7, delay: 35 },
  ];

  return (
    <SceneWipe durationInFrames={80}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
        }}
      >
        {/* Atmospheric particles (upgrade 3) */}
        <AtmosphericParticles type="dawn" count={30} />

        {/* Clouds */}
        {clouds.map((c, i) => {
          const cx = c.x + (frame + c.delay) * c.speed * 3;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx % 1400 - 200,
                top: c.y,
                width: c.w,
                height: c.h,
                background: "rgba(255,255,255,0.6)",
                borderRadius: c.h,
                filter: "blur(2px)",
              }}
            />
          );
        })}

        {/* Typewriter */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 600,
            color: C.white,
            textAlign: "center",
            padding: "0 80px",
            textShadow: "0 2px 12px rgba(0,0,0,0.12)",
            minHeight: 40,
          }}
        >
          {typed}
          <span style={{ opacity: frame % 24 < 14 ? 1 : 0, color: PAL.dawn2 }}>|</span>
        </div>
      </AbsoluteFill>
    </SceneWipe>
  );
}

// ════════════════════════════════════════════
// SCENE 2: Morning — 08:00
// ════════════════════════════════════════════
function SceneMorning() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneY = interpolate(
    spr(frame, fps, { damping: 16, stiffness: 80 }, 10),
    [0, 1],
    [600, 0]
  );

  // Micro-scroll (upgrade 6)
  const scrollOffset = interpolate(frame, [60, 100], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const cardSpring = (delay: number) => {
    const s = spr(frame, fps, { damping: 14, stiffness: 100 }, delay);
    return {
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
    };
  };

  return (
    <SceneWipe durationInFrames={125}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 180 }}>
        {/* Atmospheric particles (upgrade 3) */}
        <AtmosphericParticles type="morning" count={28} />

        {/* Cinematic label (upgrade 8) */}

        <div style={{ transform: `translateY(${phoneY}px)` }}>
          <IPhonePro reflectionDelay={40} scrollOffset={scrollOffset}>
            <Img src={staticFile("screen-dashboard.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
          </IPhonePro>
        </div>
      </AbsoluteFill>
    </SceneWipe>
  );
}

// ════════════════════════════════════════════
// SCENE 3: Midday — 12:00 "Le calendrier"
// ════════════════════════════════════════════
function SceneCalendar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = interpolate(
    spr(frame, fps, { damping: 16, stiffness: 80 }, 5),
    [0, 1],
    [480, 0]
  );

  // Micro-scroll (upgrade 6)
  const scrollOffset = interpolate(frame, [70, 110], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const daysInMonth = 31;
  const startDay = 6;
  const today = 26;
  const eventDays = [5, 12, 19, 26];

  const events = [
    { time: "10:00", emoji: "\u{1F3E5}", label: "Dentiste \u2014 Emma", color: PAL.morn2 },
    { time: "14:00", emoji: "\u{1F4DA}", label: "Biblioth\u00E8que", color: C.green },
    { time: "16:30", emoji: "\u26BD", label: "Football \u2014 Lucas", color: PAL.eve2 },
  ];

  return (
    <SceneWipe durationInFrames={140}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 180 }}>
        {/* Atmospheric particles (upgrade 3) */}
        <AtmosphericParticles type="midday" count={25} />

        {/* Cinematic label (upgrade 8) */}

        <div style={{ transform: `translateX(${slideIn}px)` }}>
          <IPhonePro reflectionDelay={35} scrollOffset={scrollOffset}>
            <Img src={staticFile("screen-calendar.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
          </IPhonePro>
        </div>
      </AbsoluteFill>
    </SceneWipe>
  );
}

// ════════════════════════════════════════════
// SCENE 4: Afternoon — 15:00 "Les courses"
// ════════════════════════════════════════════
function SceneShopping() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Micro-scroll (upgrade 6)
  const scrollOffset = interpolate(frame, [70, 110], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const categories = [
    {
      emoji: "\u{1F96C}",
      name: "L\u00E9gumes",
      items: ["Tomates", "Courgettes", "Salade"],
    },
    {
      emoji: "\u{1F95B}",
      name: "Frais",
      items: ["Lait", "Beurre", "Yaourts"],
    },
    {
      emoji: "\u{1F35E}",
      name: "Boulangerie",
      items: ["Pain", "Croissants"],
    },
  ];

  const allItems = categories.flatMap((cat) => cat.items);
  const totalItems = allItems.length;

  const itemDelay = (globalIndex: number) => 15 + globalIndex * 8;

  const checkedItems = [0, 3];
  const checkFrame = 90;

  const checkedCount = checkedItems.filter((idx) => frame > checkFrame + idx * 15).length;
  const progressFill = interpolate(
    frame,
    [checkFrame, checkFrame + 40],
    [0, (checkedCount / totalItems) * 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  let globalIdx = 0;

  return (
    <SceneWipe durationInFrames={130}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 180 }}>
        {/* Atmospheric particles (upgrade 3) */}
        <AtmosphericParticles type="afternoon" count={25} />

        {/* Cinematic label (upgrade 8) */}

        <IPhonePro reflectionDelay={30} scrollOffset={scrollOffset}>
          <Img src={staticFile("screen-shopping.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </IPhonePro>
      </AbsoluteFill>
    </SceneWipe>
  );
}

// ════════════════════════════════════════════
// SCENE 5: Evening — 19:00 "Tâches accomplies"
// ════════════════════════════════════════════
function SceneEvening() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Micro-scroll (upgrade 6)
  const scrollOffset = interpolate(frame, [80, 120], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const ringProgress = interpolate(frame, [20, 80], [0, 83], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const circumference = 2 * Math.PI * 52;
  const strokeDash = (ringProgress / 100) * circumference;

  const leaders = [
    { medal: "\u{1F947}", name: "Lucas", pts: 340, streak: "\u{1F525} 7j" },
    { medal: "\u{1F948}", name: "Emma", pts: 285, streak: "\u{1F525} 3j" },
    { medal: "\u{1F949}", name: "Maman", pts: 210, streak: "" },
  ];

  const xpFill = interpolate(frame, [110, 145], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <SceneWipe durationInFrames={155}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 180 }}>
        {/* Atmospheric particles (upgrade 3) */}
        <AtmosphericParticles type="evening" count={30} />

        {/* Cinematic label (upgrade 8) */}

        <IPhonePro reflectionDelay={35} scrollOffset={scrollOffset}>
          <Img src={staticFile("screen-gamification.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </IPhonePro>
      </AbsoluteFill>
    </SceneWipe>
  );
}

// ════════════════════════════════════════════
// SCENE 6: Night — 22:00 "Bonne nuit"
// ════════════════════════════════════════════
function SceneNight() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = 220;

  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: ((i * 137 + 50) % 1000) / 1000 * 1080,
    y: ((i * 89 + 30) % 800) / 800 * 900,
    size: 2 + (i % 3),
    twinkleSpeed: 0.05 + (i % 5) * 0.02,
    phase: i * 1.3,
  }));

  const moonOpacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });

  // Faster sequencing — everything appears quicker
  const mainTextSpring = spr(frame, fps, { damping: 12, stiffness: 100 }, 15);
  const mainTextOpacity = interpolate(mainTextSpring, [0, 1], [0, 1]);
  const mainTextY = interpolate(mainTextSpring, [0, 1], [30, 0]);

  const subSpring = spr(frame, fps, { damping: 12, stiffness: 100 }, 35);
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const iconSpring = spr(frame, fps, { damping: 10, stiffness: 100 }, 55);
  const iconScale = interpolate(iconSpring, [0, 1], [0.5, 1]);
  const iconOpacity = interpolate(iconSpring, [0, 1], [0, 1]);

  const nameSpring = spr(frame, fps, { damping: 12, stiffness: 100 }, 70);
  const nameOpacity = interpolate(nameSpring, [0, 1], [0, 1]);

  const taglineSpring = spr(frame, fps, { damping: 12, stiffness: 100 }, 85);
  const taglineOpacity = interpolate(taglineSpring, [0, 1], [0, 1]);

  // CTA appears last
  const ctaSpring = spr(frame, fps, { damping: 14, stiffness: 80 }, 110);
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaSpring, [0, 1], [20, 0]);

  const fadeOut = interpolate(frame, [totalFrames - 30, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Enhanced atmospheric particles */}
      <AtmosphericParticles type="night" count={30} />

      {/* Shooting stars */}
      <ShootingStars />

      {/* Stars */}
      {stars.map((star, i) => {
        const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(frame * star.twinkleSpeed + star.phase));
        const starAppear = interpolate(frame, [5 + i * 2, 15 + i * 2], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              background: C.white,
              opacity: twinkle * starAppear,
              boxShadow: `0 0 ${star.size * 2}px rgba(255,255,255,0.3)`,
            }}
          />
        );
      })}

      {/* Moon crescent */}
      <div
        style={{
          position: "absolute",
          top: 200,
          right: 180,
          opacity: moonOpacity,
        }}
      >
        <div style={{ position: "relative", width: 70, height: 70 }}>
          <div
            style={{
              position: "absolute",
              width: 70,
              height: 70,
              borderRadius: 35,
              background: "#FEFCE8",
              boxShadow: "0 0 40px 10px rgba(254,252,232,0.3)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 18,
              top: -6,
              width: 64,
              height: 64,
              borderRadius: 32,
              background: lerpColor(PAL.night1, PAL.night2, 0.5),
            }}
          />
        </div>
      </div>

      {/* Centered content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 80px",
        }}
      >
        {/* Main text */}
        <div
          style={{
            opacity: mainTextOpacity,
            transform: `translateY(${mainTextY}px)`,
            fontFamily: FONT,
            fontSize: 52,
            fontWeight: 800,
            color: C.white,
            textAlign: "center",
            letterSpacing: -1,
            lineHeight: 1.2,
          }}
        >
          Demain, on recommence.
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subOpacity,
            fontFamily: FONT,
            fontSize: 34,
            fontWeight: 600,
            color: PAL.nightAccent,
            textAlign: "center",
          }}
        >
          Ensemble.
        </div>

        <div style={{ height: 20 }} />

        {/* App icon — bigger */}
        <div style={{ opacity: iconOpacity, transform: `scale(${iconScale})` }}>
          <AppIcon size={130} />
        </div>

        {/* App name — bigger */}
        <div
          style={{
            opacity: nameOpacity,
            fontFamily: FONT,
            fontSize: 36,
            fontWeight: 700,
            color: C.white,
            textShadow: `0 0 30px ${PAL.nightAccent}`,
          }}
        >
          Family Flow
        </div>

        {/* Tagline — bigger and more visible */}
        <div
          style={{
            opacity: taglineOpacity,
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 500,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Votre journée, organisée
        </div>

        <div style={{ height: 16 }} />

        {/* CTA — App Store style */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              background: C.white,
              borderRadius: 16,
              padding: "16px 40px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <svg width={28} height={34} viewBox="0 0 28 34" fill="none">
              <path
                d="M22.8 17.8c-.04-4.06 3.32-6.02 3.47-6.12-1.9-2.77-4.84-3.15-5.88-3.19-2.49-.26-4.89 1.48-6.16 1.48-1.28 0-3.24-1.45-5.34-1.41-2.73.04-5.27 1.6-6.68 4.06-2.86 4.97-.73 12.31 2.04 16.34 1.37 1.97 2.99 4.18 5.11 4.1 2.06-.08 2.84-1.33 5.32-1.33 2.48 0 3.2 1.33 5.36 1.29 2.22-.04 3.61-2 4.96-3.98 1.58-2.28 2.22-4.5 2.26-4.62-.05-.02-4.32-1.66-4.36-6.58h-.1zM18.8 5.76c1.12-1.38 1.88-3.27 1.67-5.18-1.62.07-3.6 1.1-4.76 2.45-1.04 1.2-1.96 3.15-1.72 5 1.82.14 3.68-.92 4.81-2.27z"
                fill="#111827"
              />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: 1 }}>
                Disponible sur
              </span>
              <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: C.black, lineHeight: 1.2 }}>
                l'App Store
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════
// MAIN COMPOSITION
// ════════════════════════════════════════════
export const Video4_DayLife_Pro: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* Dynamic gradient background */}
      <DayBackground />

      {/* Sun/Moon arc (upgrade 4) */}
      <CelestialArc />

      {/* Audio */}
      <Audio src={staticFile("music-chill.mp3")} volume={(f) => {
        // Fade out over last 3 seconds (90 frames)
        return interpolate(f, [0, 810, 900], [0.5, 0.5, 0], { extrapolateRight: "clamp" });
      }} />

      {/* Scene 0: Slogan — 0 to 80 */}
      <Sequence from={0} durationInFrames={80}>
        <SceneSlogan />
      </Sequence>

      {/* Scene 1: Dawn — 75 to 155 */}
      <Sequence from={75} durationInFrames={80}>
        <SceneDawn />
      </Sequence>

      {/* Morphing clock: 06:00 -> 08:12 */}
      <Sequence from={130} durationInFrames={30}>
        <MorphingClock fromTime="06:00" toTime="08:12" />
      </Sequence>

      {/* Scene 2: Morning — 150 to 275 */}
      <Sequence from={150} durationInFrames={125}>
        <SceneMorning />
      </Sequence>

      {/* Morphing clock: 08:12 -> 12:03 */}
      <Sequence from={250} durationInFrames={30}>
        <MorphingClock fromTime="08:12" toTime="12:03" />
      </Sequence>

      {/* Scene 3: Midday — 270 to 410 */}
      <Sequence from={270} durationInFrames={140}>
        <SceneCalendar />
      </Sequence>

      {/* Morphing clock: 12:03 -> 15:22 */}
      <Sequence from={385} durationInFrames={30}>
        <MorphingClock fromTime="12:03" toTime="15:22" />
      </Sequence>

      {/* Scene 4: Afternoon — 405 to 535 */}
      <Sequence from={405} durationInFrames={130}>
        <SceneShopping />
      </Sequence>

      {/* Morphing clock: 15:22 -> 19:15 */}
      <Sequence from={510} durationInFrames={30}>
        <MorphingClock fromTime="15:22" toTime="19:15" />
      </Sequence>

      {/* Scene 5: Evening — 530 to 660 */}
      <Sequence from={530} durationInFrames={130}>
        <SceneEvening />
      </Sequence>

      {/* Morphing clock: 19:15 -> 22:00 */}
      <Sequence from={655} durationInFrames={30}>
        <MorphingClock fromTime="19:15" toTime="22:00" />
      </Sequence>

      {/* Scene 6: Night — 680 to 900 */}
      <Sequence from={680} durationInFrames={220}>
        <SceneNight />
      </Sequence>
    </AbsoluteFill>
  );
};
