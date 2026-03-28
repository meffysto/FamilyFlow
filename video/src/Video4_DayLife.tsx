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

// ── SceneFade ──
function SceneFade({ children, durationInFrames }: { children: React.ReactNode; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
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

// ── iPhone Mockup ──
function IPhone({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
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
          height: 60,
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
          background: "#F9FAFB",
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
function StatusBar({ time = "9:41", dark = false }: { time?: string; dark?: boolean }) {
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
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{time}</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {[1, 0.7, 0.4].map((o, i) => (
            <div
              key={i}
              style={{ width: 3, height: 10 + i * 2, background: color, opacity: o, borderRadius: 1 }}
            />
          ))}
        </div>
        <div
          style={{
            width: 20,
            height: 10,
            border: `1.5px solid ${color}`,
            borderRadius: 2,
            padding: 1.5,
          }}
        >
          <div style={{ width: "75%", height: "100%", background: color, borderRadius: 1 }} />
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
    { icon: "🏠", label: "Accueil" },
    { icon: "📅", label: "Calendrier" },
    { icon: "✅", label: "Tâches" },
    { icon: "🛒", label: "Courses" },
    { icon: "👤", label: "Profil" },
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
          <span style={{ fontSize: 20 }}>{tab.icon}</span>
          <span style={{ fontSize: 9, fontWeight: i === activeIndex ? 700 : 500, color: i === activeIndex ? PAL.morn2 : C.muted }}>
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

  // Define gradient stops across the day
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

// ════════════════════════════════════════════
// SCENE 0: Slogan — "Le second cerveau"
// ════════════════════════════════════════════
function SceneSlogan() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = tw("Le second cerveau", frame, 0, 1.2);
  const sub = spr(frame, fps, { damping: 200 }, 40);
  const subOpacity = interpolate(sub, [0, 1], [0, 1]);
  const subY = interpolate(sub, [0, 1], [20, 0]);
  return (
    <AbsoluteFill style={{ background: C.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 60px", gap: 16 }}>
      <div style={{ fontFamily: FONT, fontSize: 54, fontWeight: 800, color: "#111827", textAlign: "center", letterSpacing: -2, lineHeight: 1.1, minHeight: 70 }}>
        {line1}<span style={{ opacity: frame % 30 < 18 ? 1 : 0, color: "#7C3AED" }}>|</span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 500, color: "#6B7280", opacity: subOpacity, transform: `translateY(${subY}px)` }}>
        que votre famille mérite
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════
// SCENE 1: Dawn — 06:00 "Le réveil"
// ════════════════════════════════════════════
function SceneDawn() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sun rise
  const sunY = interpolate(frame, [0, 70], [300, 60], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const sunScale = spr(frame, fps, { damping: 14, stiffness: 120 });
  const sunGlow = interpolate(frame, [0, 50], [0, 1], { extrapolateRight: "clamp" });

  // Clock
  const clockOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" });

  // Typewriter text
  const typed = tw("Une nouvelle journée commence", frame, 30, 1.2);

  // Clouds
  const clouds = [
    { x: -200, y: 400, w: 140, h: 36, speed: 0.6, delay: 20 },
    { x: -300, y: 550, w: 180, h: 40, speed: 0.45, delay: 0 },
    { x: -150, y: 700, w: 120, h: 30, speed: 0.7, delay: 35 },
  ];

  return (
    <SceneFade durationInFrames={80}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
        }}
      >
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

        {/* Sun */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: `radial-gradient(circle, ${PAL.dawn2} 0%, ${PAL.dawnAccent} 100%)`,
            transform: `translateY(${sunY}px) scale(${sunScale})`,
            boxShadow: `0 0 ${60 * sunGlow}px ${30 * sunGlow}px rgba(251,191,36,0.4)`,
          }}
        />

        {/* Clock */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 72,
            fontWeight: 300,
            color: C.white,
            opacity: clockOpacity,
            letterSpacing: 4,
            textShadow: "0 2px 20px rgba(0,0,0,0.15)",
          }}
        >
          06:00
        </div>

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
    </SceneFade>
  );
}

// ════════════════════════════════════════════
// SCENE 2: Morning — 08:00 "Petit-déjeuner & planning"
// ════════════════════════════════════════════
function SceneMorning() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // iPhone slides up
  const phoneY = interpolate(
    spr(frame, fps, { damping: 16, stiffness: 80 }, 10),
    [0, 1],
    [600, 0]
  );

  // Card staggers
  const cardSpring = (delay: number) => {
    const s = spr(frame, fps, { damping: 14, stiffness: 100 }, delay);
    return {
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
    };
  };

  return (
    <SceneFade durationInFrames={125}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateY(${phoneY}px)` }}>
          <IPhone>
            <StatusBar time="08:12" />
            <div style={{ flex: 1, padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
              {/* Header */}
              <div style={cardSpring(20)}>
                <div
                  style={{
                    background: `linear-gradient(135deg, ${PAL.morn2} 0%, ${PAL.mornAccent} 100%)`,
                    borderRadius: 16,
                    padding: "20px 18px",
                  }}
                >
                  <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: C.white }}>
                    Bonjour famille Dupont 🌅
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    Jeudi 26 mars 2026
                  </div>
                </div>
              </div>

              {/* Today summary */}
              <div style={cardSpring(35)}>
                <Card>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.black, marginBottom: 8 }}>
                    📋 Aujourd'hui
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
                    Jeudi 26 mars
                  </div>
                </Card>
              </div>

              {/* Meal card */}
              <div style={cardSpring(50)}>
                <Card>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.black, marginBottom: 10 }}>
                    🍽️ Repas du jour
                  </div>
                  {[
                    { emoji: "🥐", label: "Petit-déj", meal: "Pancakes" },
                    { emoji: "🍽️", label: "Déj", meal: "Salade" },
                    { emoji: "🌙", label: "Dîner", meal: "Gratin" },
                  ].map((m, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: FONT,
                        fontSize: 12,
                        color: C.black,
                        padding: "4px 0",
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <span>{m.emoji}</span>
                      <span style={{ fontWeight: 600 }}>{m.label}:</span>
                      <span style={{ color: C.muted }}>{m.meal}</span>
                    </div>
                  ))}
                </Card>
              </div>

              {/* Tasks preview */}
              <div style={cardSpring(65)}>
                <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Mini progress circle */}
                  <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
                    <svg width={44} height={44} viewBox="0 0 44 44">
                      <circle cx={22} cy={22} r={18} fill="none" stroke={C.border} strokeWidth={4} />
                      <circle
                        cx={22}
                        cy={22}
                        r={18}
                        fill="none"
                        stroke={PAL.morn2}
                        strokeWidth={4}
                        strokeDasharray={`${113 * 0.33} ${113 * 0.67}`}
                        strokeLinecap="round"
                        transform="rotate(-90 22 22)"
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: FONT,
                        fontSize: 10,
                        fontWeight: 700,
                        color: PAL.morn2,
                      }}
                    >
                      2/6
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.black }}>
                      6 tâches aujourd'hui
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginTop: 2 }}>
                      2 terminées ce matin
                    </div>
                  </div>
                </Card>
              </div>
            </div>
            <TabBar activeIndex={0} />
          </IPhone>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ════════════════════════════════════════════
// SCENE 3: Midday — 12:00 "Le calendrier"
// ════════════════════════════════════════════
function SceneCalendar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Content slide transition
  const slideIn = interpolate(
    spr(frame, fps, { damping: 16, stiffness: 80 }, 5),
    [0, 1],
    [480, 0]
  );

  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const daysInMonth = 31;
  const startDay = 6; // March 2026 starts on Sunday (index 6)
  const today = 26;
  const eventDays = [5, 12, 19, 26];

  // Events stagger
  const events = [
    { time: "10:00", emoji: "🏥", label: "Dentiste — Emma", color: PAL.morn2 },
    { time: "14:00", emoji: "📚", label: "Bibliothèque", color: C.green },
    { time: "16:30", emoji: "⚽", label: "Football — Lucas", color: PAL.eve2 },
  ];

  return (
    <SceneFade durationInFrames={140}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateX(${slideIn}px)` }}>
          <IPhone>
            <StatusBar time="12:03" />
            <div style={{ flex: 1, padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
              {/* Month header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px",
                }}
              >
                <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.black }}>
                  Mars 2026
                </span>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 18, color: C.muted }}>◀</span>
                  <span style={{ fontSize: 18, color: C.muted }}>▶</span>
                </div>
              </div>

              {/* Calendar grid */}
              <Card style={{ padding: 10 }}>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
                  {days.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: FONT,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.muted,
                        textAlign: "center",
                        padding: "4px 0",
                      }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {/* Days */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`e${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today;
                    const hasEvent = eventDays.includes(day);
                    return (
                      <div
                        key={day}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          height: 36,
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isToday ? PAL.aftAccent : "transparent",
                            fontFamily: FONT,
                            fontSize: 12,
                            fontWeight: isToday ? 700 : 400,
                            color: isToday ? C.white : C.black,
                          }}
                        >
                          {day}
                        </div>
                        {hasEvent && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: 1,
                              display: "flex",
                              gap: 2,
                            }}
                          >
                            <div style={{ width: 4, height: 4, borderRadius: 2, background: PAL.morn2 }} />
                            {day === today && (
                              <>
                                <div style={{ width: 4, height: 4, borderRadius: 2, background: C.green }} />
                                <div style={{ width: 4, height: 4, borderRadius: 2, background: PAL.eve2 }} />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Event list */}
              <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.black, padding: "4px 4px 0" }}>
                Aujourd'hui
              </div>
              {events.map((ev, i) => {
                const s = spr(frame, fps, { damping: 14, stiffness: 100 }, 40 + i * 15);
                const evStyle = {
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(s, [0, 1], [60, 0])}px)`,
                };
                return (
                  <div key={i} style={evStyle}>
                    <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: ev.color,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.black }}>
                          {ev.time} {ev.emoji} {ev.label}
                        </span>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
            <TabBar activeIndex={1} />
          </IPhone>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ════════════════════════════════════════════
// SCENE 4: Afternoon — 15:00 "Les courses"
// ════════════════════════════════════════════
function SceneShopping() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const categories = [
    {
      emoji: "🥬",
      name: "Légumes",
      items: ["Tomates", "Courgettes", "Salade"],
    },
    {
      emoji: "🥛",
      name: "Frais",
      items: ["Lait", "Beurre", "Yaourts"],
    },
    {
      emoji: "🍞",
      name: "Boulangerie",
      items: ["Pain", "Croissants"],
    },
  ];

  const allItems = categories.flatMap((cat) => cat.items);
  const totalItems = allItems.length;

  // Items appear cascade
  const itemDelay = (globalIndex: number) => 15 + globalIndex * 8;

  // Checkoff timing — items 0 (Tomates) and 3 (Lait) get checked
  const checkedItems = [0, 3];
  const checkFrame = 90;

  // Progress
  const checkedCount = checkedItems.filter((idx) => frame > checkFrame + idx * 15).length;
  const progressFill = interpolate(
    frame,
    [checkFrame, checkFrame + 40],
    [0, (checkedCount / totalItems) * 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  let globalIdx = 0;

  return (
    <SceneFade durationInFrames={130}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IPhone>
          <StatusBar time="15:22" />
          <div style={{ flex: 1, padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: C.black, padding: "0 4px" }}>
              Courses 🛒
            </div>

            {/* Categories */}
            {categories.map((cat, ci) => (
              <Card key={ci} style={{ padding: 12 }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.black,
                    marginBottom: 8,
                  }}
                >
                  {cat.emoji} {cat.name}
                </div>
                {cat.items.map((item, ii) => {
                  const idx = globalIdx++;
                  const s = spr(frame, fps, { damping: 14, stiffness: 120 }, itemDelay(idx));
                  const isChecked = checkedItems.includes(idx) && frame > checkFrame + checkedItems.indexOf(idx) * 15;
                  const itemOpacity = interpolate(s, [0, 1], [0, 1]);
                  const itemY = interpolate(s, [0, 1], [20, 0]);

                  return (
                    <div
                      key={ii}
                      style={{
                        opacity: itemOpacity,
                        transform: `translateY(${itemY}px)`,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "5px 0",
                        borderBottom: ii < cat.items.length - 1 ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: `2px solid ${isChecked ? C.green : C.border}`,
                          background: isChecked ? C.green : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.3s",
                        }}
                      >
                        {isChecked && (
                          <span style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>✓</span>
                        )}
                      </div>
                      <span
                        style={{
                          fontFamily: FONT,
                          fontSize: 13,
                          color: isChecked ? C.muted : C.black,
                          textDecoration: isChecked ? "line-through" : "none",
                        }}
                      >
                        {item}
                      </span>
                    </div>
                  );
                })}
              </Card>
            ))}

            {/* Progress bar */}
            {frame > checkFrame - 5 && (
              <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.black }}>
                    Progression
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.green }}>
                    {checkedCount}/{totalItems} articles
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progressFill}%`,
                      height: "100%",
                      background: C.green,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </Card>
            )}
          </div>
          <TabBar activeIndex={3} />
        </IPhone>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ════════════════════════════════════════════
// SCENE 5: Evening — 19:00 "Tâches accomplies"
// ════════════════════════════════════════════
function SceneEvening() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Progress ring animation
  const ringProgress = interpolate(frame, [20, 80], [0, 83], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const circumference = 2 * Math.PI * 52;
  const strokeDash = (ringProgress / 100) * circumference;

  // Leaderboard
  const leaders = [
    { medal: "🥇", name: "Lucas", pts: 340, streak: "🔥 7j" },
    { medal: "🥈", name: "Emma", pts: 285, streak: "🔥 3j" },
    { medal: "🥉", name: "Maman", pts: 210, streak: "" },
  ];

  // XP bar fill
  const xpFill = interpolate(frame, [110, 145], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <SceneFade durationInFrames={155}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IPhone>
          <StatusBar time="19:15" />
          <div style={{ flex: 1, padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
            {/* Header */}
            <div
              style={{
                background: `linear-gradient(135deg, ${PAL.eve2} 0%, ${PAL.eveAccent} 100%)`,
                borderRadius: 16,
                padding: "18px 18px",
                textAlign: "center",
              }}
            >
              <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: C.white }}>
                Bravo ! 🎉
              </div>
              <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                5/6 tâches terminées aujourd'hui
              </div>
            </div>

            {/* Progress ring */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
              <div style={{ position: "relative", width: 130, height: 130 }}>
                <svg width={130} height={130} viewBox="0 0 130 130">
                  <circle cx={65} cy={65} r={52} fill="none" stroke={C.border} strokeWidth={10} />
                  <circle
                    cx={65}
                    cy={65}
                    r={52}
                    fill="none"
                    stroke={C.green}
                    strokeWidth={10}
                    strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                    strokeLinecap="round"
                    transform="rotate(-90 65 65)"
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT,
                    fontSize: 28,
                    fontWeight: 800,
                    color: C.green,
                  }}
                >
                  {Math.round(ringProgress)}%
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <Card>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.black, marginBottom: 10 }}>
                🏆 Classement famille
              </div>
              {leaders.map((l, i) => {
                const s = spr(frame, fps, { damping: 14, stiffness: 100 }, 60 + i * 12);
                const rowStyle = {
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px)`,
                };
                return (
                  <div
                    key={i}
                    style={{
                      ...rowStyle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: i < leaders.length - 1 ? `1px solid ${C.border}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{l.medal}</span>
                      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.black }}>
                        {l.name}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PAL.eve2 }}>
                        {l.pts} pts
                      </span>
                      {l.streak && (
                        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                          {l.streak}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* XP bar */}
            <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.black }}>
                  Expérience du jour
                </span>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PAL.aftAccent }}>
                  +60 XP
                </span>
              </div>
              <div style={{ width: "100%", height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${xpFill}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${PAL.aftAccent}, ${PAL.eveAccent})`,
                    borderRadius: 4,
                  }}
                />
              </div>
            </Card>
          </div>
          <TabBar activeIndex={2} />
        </IPhone>
      </AbsoluteFill>
    </SceneFade>
  );
}

// ════════════════════════════════════════════
// SCENE 6: Night — 22:00 "Bonne nuit"
// ════════════════════════════════════════════
function SceneNight() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalFrames = 220;

  // Stars — scattered positions
  const stars = Array.from({ length: 24 }, (_, i) => ({
    x: ((i * 137 + 50) % 1000) / 1000 * 1080,
    y: ((i * 89 + 30) % 800) / 800 * 900,
    size: 2 + (i % 3),
    twinkleSpeed: 0.05 + (i % 5) * 0.02,
    phase: i * 1.3,
  }));

  // Moon crescent
  const moonOpacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });

  // Text animations
  const mainTextSpring = spr(frame, fps, { damping: 14, stiffness: 80 }, 30);
  const mainTextOpacity = interpolate(mainTextSpring, [0, 1], [0, 1]);
  const mainTextY = interpolate(mainTextSpring, [0, 1], [30, 0]);

  const subSpring = spr(frame, fps, { damping: 14, stiffness: 80 }, 55);
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const iconSpring = spr(frame, fps, { damping: 12, stiffness: 100 }, 80);
  const iconScale = interpolate(iconSpring, [0, 1], [0.5, 1]);
  const iconOpacity = interpolate(iconSpring, [0, 1], [0, 1]);

  const nameSpring = spr(frame, fps, { damping: 14, stiffness: 80 }, 100);
  const nameOpacity = interpolate(nameSpring, [0, 1], [0, 1]);

  const taglineSpring = spr(frame, fps, { damping: 14, stiffness: 80 }, 120);
  const taglineOpacity = interpolate(taglineSpring, [0, 1], [0, 1]);

  // Final fade out
  const fadeOut = interpolate(frame, [totalFrames - 30, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
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
            }}
          />
        );
      })}

      {/* Moon — crescent via two overlapping circles */}
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
          gap: 20,
          padding: "0 80px",
        }}
      >
        {/* Main text */}
        <div
          style={{
            opacity: mainTextOpacity,
            transform: `translateY(${mainTextY}px)`,
            fontFamily: FONT,
            fontSize: 48,
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
            fontSize: 32,
            fontWeight: 500,
            color: PAL.nightAccent,
            textAlign: "center",
          }}
        >
          Ensemble.
        </div>

        {/* Spacer */}
        <div style={{ height: 30 }} />

        {/* App icon */}
        <div style={{ opacity: iconOpacity, transform: `scale(${iconScale})` }}>
          <AppIcon size={100} />
        </div>

        {/* App name */}
        <div
          style={{
            opacity: nameOpacity,
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 700,
            color: C.white,
            textShadow: `0 0 30px ${PAL.nightAccent}`,
          }}
        >
          Family Flow
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOpacity,
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 500,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Votre journée, organisée
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════
// MAIN COMPOSITION
// ════════════════════════════════════════════
export const Video4_DayLife: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* Dynamic gradient background that shifts throughout the day */}
      <DayBackground />

      {/* Audio */}
      <Audio src={staticFile("music-chill.mp3")} volume={0.5} />

      {/* Scene 0: Slogan — 0 to 80 */}
      <Sequence from={0} durationInFrames={80}>
        <SceneSlogan />
      </Sequence>

      {/* Scene 1: Dawn — 75 to 155 */}
      <Sequence from={75} durationInFrames={80}>
        <SceneDawn />
      </Sequence>

      {/* Scene 2: Morning — 150 to 275 */}
      <Sequence from={150} durationInFrames={125}>
        <SceneMorning />
      </Sequence>

      {/* Scene 3: Midday — 270 to 410 */}
      <Sequence from={270} durationInFrames={140}>
        <SceneCalendar />
      </Sequence>

      {/* Scene 4: Afternoon — 405 to 535 */}
      <Sequence from={405} durationInFrames={130}>
        <SceneShopping />
      </Sequence>

      {/* Scene 5: Evening — 530 to 685 */}
      <Sequence from={530} durationInFrames={155}>
        <SceneEvening />
      </Sequence>

      {/* Scene 6: Night — 680 to 900 */}
      <Sequence from={680} durationInFrames={220}>
        <SceneNight />
      </Sequence>
    </AbsoluteFill>
  );
};
