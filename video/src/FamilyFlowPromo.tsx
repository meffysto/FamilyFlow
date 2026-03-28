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
  amber: "#F59E0B",
  muted: "#6B7280",
  gray: "#F3F4F6",
  card: "#FFFFFF",
  border: "#E5E7EB",
};

// ── Helpers ──
function spr(frame: number, fps: number, cfg: Record<string, number> = { damping: 200 }, delay = 0) {
  return spring({ frame: frame - delay, fps, config: cfg as any });
}

// ── Zoom smooth: ease-in-out entrance then gentle continuous drift ──
function useZoom(delay = 0, from = 0.82, drift = 1.06) {
  const frame = useCurrentFrame();
  const entrance = interpolate(frame, [delay, delay + 40], [from, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const slowZoom = interpolate(frame, [delay + 40, delay + 150], [1, drift], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  return frame < delay + 40 ? entrance : slowZoom;
}

function tw(text: string, frame: number, startFrame = 0, speed = 1.5) {
  const chars = Math.floor(Math.max(0, frame - startFrame) * speed);
  return text.slice(0, chars);
}

// ── App Icon — uses real icon.png ──
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

// ── iPhone Mockup wrapper ──
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
        width: 500,
        height: 930,
        background: "#1A1A1A",
        borderRadius: 44,
        padding: 10,
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
          top: 100,
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
          top: 90,
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
          background: C.gray,
          borderRadius: 36,
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
              style={{ width: 3, height: 10 + i * 2, background: C.black, opacity: o, borderRadius: 1 }}
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

// ── Progress Bar ──
function XPBar({ fill, color }: { fill: number; color: string }) {
  return (
    <div style={{ width: "100%", height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${fill}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );
}

// ── SCENE 1: Logo Intro ──
function SceneLogo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spr(frame, fps, { damping: 12, stiffness: 180 });
  const nameOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const nameY = interpolate(nameOpacity, [0, 1], [16, 0]);

  return (
    <AbsoluteFill
      style={{ background: C.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}
    >
      <AppIcon scale={scale} />
      <div
        style={{
          opacity: nameOpacity,
          transform: `translateY(${nameY}px)`,
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: 700,
          color: C.black,
          letterSpacing: -0.5,
        }}
      >
        Family Flow
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 2: Slogan Part 1 ──
function SceneSlogan1() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = tw("The second brain", frame, 0, 1.2);
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
      <div
        style={{
          fontFamily: FONT,
          fontSize: 58,
          fontWeight: 800,
          color: C.black,
          textAlign: "center",
          letterSpacing: -2,
          lineHeight: 1.1,
          minHeight: 70,
        }}
      >
        {line1}
        <span style={{ opacity: frame % 30 < 18 ? 1 : 0, color: C.purple }}>|</span>
      </div>
      <div
        style={{
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          fontFamily: FONT,
          fontSize: 38,
          fontWeight: 600,
          color: C.muted,
          textAlign: "center",
          letterSpacing: -0.5,
        }}
      >
        your family deserves.
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 3: Dashboard ──
function SceneDashboard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneY = interpolate(spr(frame, fps, { damping: 200 }), [0, 1], [300, 0]);
  const phoneScale = useZoom(0, 0.8, 1.08);
  const card1 = spr(frame, fps, { damping: 200 }, 10);
  const card2 = spr(frame, fps, { damping: 200 }, 20);
  const card3 = spr(frame, fps, { damping: 200 }, 30);
  const labelOp = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });
  const labelY = interpolate(frame, [60, 80], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: C.gray,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div style={{ transform: `translateY(${phoneY}px) scale(${phoneScale})` }}>
        <IPhone>
          <StatusBar />
          <div style={{ padding: "4px 12px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Greeting */}
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.black, paddingTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>LD</div>
              Bonjour, Lucas 👋
            </div>

            {/* Card 1 */}
            <div style={{ opacity: interpolate(card1, [0, 1], [0, 1]), transform: `translateY(${interpolate(card1, [0, 1], [15, 0])}px)` }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.black, marginBottom: 7 }}>📆 Aujourd'hui</div>
                <div style={{ fontSize: 10, color: "#374151", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div>🏥 <span style={{ fontWeight: 600 }}>09:30</span> — RDV pédiatre Emma</div>
                  <div>✅ Ranger le garage</div>
                </div>
              </Card>
            </div>

            {/* Card 2 */}
            <div style={{ opacity: interpolate(card2, [0, 1], [0, 1]), transform: `translateY(${interpolate(card2, [0, 1], [15, 0])}px)` }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.black, marginBottom: 7 }}>🍽️ Repas du jour</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["🥐", "Matin", "Tartines"], ["🥗", "Midi", "Salade César"], ["🌙", "Soir", "Gratin"]].map(([e, l, v]) => (
                    <div key={l} style={{ flex: 1, background: C.gray, borderRadius: 8, padding: "7px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 14 }}>{e}</span>
                      <span style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", fontFamily: FONT, fontWeight: 600 }}>{l}</span>
                      <span style={{ fontSize: 9, color: "#374151", fontFamily: FONT, fontWeight: 500, textAlign: "center" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Card 3 */}
            <div style={{ opacity: interpolate(card3, [0, 1], [0, 1]), transform: `translateY(${interpolate(card3, [0, 1], [15, 0])}px)` }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.black, marginBottom: 6 }}>🎁 Loot</div>
                <div style={{ fontSize: 10, color: C.black, marginBottom: 5 }}>Lucas — Explorateur ⭐</div>
                <div style={{ fontSize: 9, color: C.muted, display: "flex", justifyContent: "space-between", marginBottom: 3, fontFamily: FONT }}>
                  <span>XP</span><span>340 / 500</span>
                </div>
                <XPBar fill={68} color={C.purple} />
              </Card>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", justifyContent: "space-around", background: C.white, borderTop: `1px solid ${C.border}`, padding: "6px 0 12px", marginTop: "auto" }}>
              {["🏠", "📆", "🍽️", "✅", "⋯"].map((e, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <span style={{ fontSize: 16 }}>{e}</span>
                  {i === 0 && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.purple }} />}
                </div>
              ))}
            </div>
          </div>
        </IPhone>
      </div>

      <div style={{ opacity: labelOp, transform: `translateY(${labelY}px)`, fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.black, textAlign: "center" }}>
        Everything in one place.
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 4: Calendar ──
function SceneCalendar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneX = interpolate(spr(frame, fps, { damping: 200 }), [0, 1], [400, 0]);
  const phoneScale = useZoom(0, 0.8, 1.08);
  const labelOp = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
  // March 2026 starts on Sunday (offset=6 in Mon-first grid)
  // We'll simplify: show weeks 2-5 clearly
  const weeks = [
    [24, 25, 26, 27, 28, 1, 2],   // prev month + Mar 1-2
    [3, 4, 5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14, 15, 16],
    [17, 18, 19, 20, 21, 22, 23],
    [24, 25, 26, 27, 28, 29, 30],
    [31, 1, 2, 3, 4, 5, 6],        // Apr
  ];
  const dots: Record<number, string[]> = {
    3: ["#8B5CF6"], 5: ["#10B981", "#3B82F6"], 10: ["#EC4899"],
    12: ["#8B5CF6", "#10B981"], 15: ["#F59E0B"], 18: ["#3B82F6", "#10B981"],
    20: ["#8B5CF6"], 23: ["#10B981", "#F59E0B"],
    26: ["#8B5CF6", "#3B82F6", "#10B981"], 28: ["#EC4899"],
  };

  return (
    <AbsoluteFill style={{ background: C.gray, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ transform: `translateX(${phoneX}px) scale(${phoneScale})` }}>
        <IPhone>
          <StatusBar />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "4px 10px 8px" }}>
            {/* Header */}
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: C.black, textAlign: "center", marginBottom: 6 }}>
              Calendrier
            </div>
            {/* Seg */}
            <div style={{ display: "flex", background: C.border, borderRadius: 8, padding: 2, marginBottom: 8 }}>
              {["Mois", "Semaine"].map((t, i) => (
                <div key={t} style={{ flex: 1, textAlign: "center", padding: "4px 0", fontSize: 10, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? C.black : C.muted, background: i === 0 ? C.white : "transparent", borderRadius: 6, fontFamily: FONT }}>
                  {t}
                </div>
              ))}
            </div>
            {/* Month nav */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: C.purple }}>‹</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.black, fontFamily: FONT }}>Mars 2026</span>
              <span style={{ fontSize: 14, color: C.purple }}>›</span>
            </div>
            {/* Grid header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 600, color: C.muted, fontFamily: FONT }}>{d}</div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 2 }}>
                {week.map((d, di) => {
                  const isOther = (wi === 0 && di < 5) || (wi === 5 && di > 0);
                  const isToday = d === 26 && wi === 4;
                  const isWeekend = di >= 5;
                  const dayDots = dots[d] || [];
                  return (
                    <div
                      key={di}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "2px 0",
                        borderRadius: 6,
                        border: isToday ? `1.5px solid ${C.purple}` : "1.5px solid transparent",
                        background: isToday ? `${C.purpleLight}60` : "transparent",
                      }}
                    >
                      <span style={{
                        fontSize: 10,
                        fontWeight: isToday ? 700 : 500,
                        color: isOther ? C.border : isToday ? C.purple : isWeekend ? C.muted : C.black,
                        fontFamily: FONT,
                      }}>{d}</span>
                      <div style={{ display: "flex", gap: 1 }}>
                        {dayDots.slice(0, 3).map((c, ci) => (
                          <div key={ci} style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Detail card */}
            <div style={{ background: C.white, borderRadius: 10, padding: "8px 10px", marginTop: 4, boxShadow: "0 1px 6px rgba(0,0,0,.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.black, fontFamily: FONT, marginBottom: 6 }}>Jeudi 26 mars</div>
              {[["#8B5CF6", "🏥 Dentiste Emma", "10:00"], ["#10B981", "✅ Courses Carrefour", ""], ["#3B82F6", "🍽️ Poulet rôti ce soir", ""]].map(([c, t, sub]) => (
                <div key={t} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <div style={{ width: 2.5, height: 22, background: c, borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 9.5, fontFamily: FONT, color: "#374151" }}>{t}</div>
                    {sub && <div style={{ fontSize: 8.5, color: C.muted, fontFamily: FONT }}>{sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </IPhone>
      </div>

      <div style={{ opacity: labelOp, fontFamily: FONT, fontSize: 28, fontWeight: 800, color: C.purple, textAlign: "center" }}>
        9 sources. 1 view.
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 5: Meals ──
function SceneMeals() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneX = interpolate(spr(frame, fps, { damping: 200 }), [0, 1], [400, 0]);
  const phoneScale = useZoom(0, 0.8, 1.08);
  const labelOp = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  const days = [
    { name: "Lundi", today: false, meals: ["Tartines", "Salade niçoise", "Pâtes carbo"] },
    { name: "Mardi", today: false, meals: ["Céréales", "Quiche", "Soupe légumes"] },
    { name: "Mercredi", today: false, meals: ["Pancakes", "Croque-M.", "Poulet rôti"] },
    { name: "Jeudi", today: true, meals: ["Tartines", "Wrap poulet", "Gratin 🧀"] },
    { name: "Vendredi", today: false, meals: ["Granola", "Pizza maison", "Saumon"] },
  ];

  return (
    <AbsoluteFill style={{ background: C.gray, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ transform: `translateX(${phoneX}px) scale(${phoneScale})` }}>
        <IPhone>
          <StatusBar />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "4px 10px 8px" }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: C.black, textAlign: "center", marginBottom: 6 }}>Repas</div>
            {/* Seg */}
            <div style={{ display: "flex", background: C.border, borderRadius: 8, padding: 2, marginBottom: 6 }}>
              {["Repas", "Courses", "Recettes"].map((t, i) => (
                <div key={t} style={{ flex: 1, textAlign: "center", padding: "4px 0", fontSize: 9, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? C.black : C.muted, background: i === 0 ? C.white : "transparent", borderRadius: 6, fontFamily: FONT }}>
                  {t}
                </div>
              ))}
            </div>
            {/* Week nav */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: C.purple, fontSize: 13 }}>‹</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.black, fontFamily: FONT }}>Semaine du 23 mars</span>
              <span style={{ color: C.purple, fontSize: 13 }}>›</span>
            </div>
            {/* Day cards */}
            {days.map(({ name, today, meals }) => (
              <div
                key={name}
                style={{
                  background: C.white,
                  borderRadius: 8,
                  padding: "7px 8px",
                  marginBottom: 5,
                  borderLeft: today ? `3px solid ${C.purple}` : "3px solid transparent",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                }}
              >
                <div style={{ width: 50, flexShrink: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: today ? C.purple : C.black, fontFamily: FONT }}>{name}</div>
                  {today && (
                    <div style={{ background: C.purple, color: "#fff", fontSize: 7, fontWeight: 600, padding: "1px 4px", borderRadius: 3, display: "inline-block", marginTop: 2, fontFamily: FONT }}>
                      Auj.
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flex: 1, gap: 4 }}>
                  {[["🥐", meals[0]], ["🍽️", meals[1]], ["🌙", meals[2]]].map(([e, m]) => (
                    <div key={e} style={{ flex: 1 }}>
                      <div style={{ fontSize: 8, color: C.muted, fontFamily: FONT }}>{e}</div>
                      <div style={{ fontSize: 8.5, fontWeight: 500, color: "#374151", fontFamily: FONT, lineHeight: 1.2 }}>{m}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </IPhone>
      </div>

      <div style={{ opacity: labelOp, fontFamily: FONT, fontSize: 26, fontWeight: 700, color: C.black, textAlign: "center" }}>
        Every meal, planned.
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 6: Gamification ──
function SceneGamification() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneX = interpolate(spr(frame, fps, { damping: 8, stiffness: 100 }), [0, 1], [400, 0]);
  const phoneScale = useZoom(0, 0.75, 1.1);
  const labelOp = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });

  const badgeColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"];
  const badgeEmojis = ["📚", "🧹", "🍳", "⭐", "🏆"];

  return (
    <AbsoluteFill style={{ background: C.gray, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ transform: `translateX(${phoneX}px) scale(${phoneScale})` }}>
        <IPhone>
          {/* Purple header */}
          <div style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDark})`, padding: "40px 14px 12px", flexShrink: 0 }}>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: "#fff" }}>🎁 Récompenses</div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Gagne des XP, ouvre des loot boxes !</div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {["Récompenses", "Collection"].map((t, i) => (
              <div key={t} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 10, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? C.purple : C.muted, borderBottom: i === 0 ? `2px solid ${C.purple}` : "none", fontFamily: FONT }}>
                {t}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
            {/* Profile cards */}
            {[
              { name: "Lucas", level: "⭐ Explorateur", lvlColor: C.purple, xp: 68, xpColor: C.purple, xpText: "340/500", btn: true },
              { name: "Emma", level: "🌟 Aventurière", lvlColor: C.amber, xp: 60, xpColor: C.amber, xpText: "180/300", btn: false },
            ].map(({ name, level, lvlColor, xp, xpColor, xpText, btn }) => (
              <div key={name} style={{ background: C.white, borderRadius: 10, padding: "9px 10px", boxShadow: "0 1px 6px rgba(0,0,0,.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${lvlColor}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {name === "Lucas" ? "👦" : "👧"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.black, fontFamily: FONT }}>{name}</div>
                    <div style={{ fontSize: 9, fontWeight: 500, color: lvlColor, fontFamily: FONT }}>{level}</div>
                  </div>
                  {btn ? (
                    <div style={{ background: C.purple, color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 10, fontWeight: 600, fontFamily: FONT }}>🎁 Ouvrir</div>
                  ) : (
                    <div style={{ background: C.gray, color: C.muted, borderRadius: 8, padding: "5px 8px", fontSize: 9, fontWeight: 500, fontFamily: FONT }}>Dans 2j</div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted, fontFamily: FONT, marginBottom: 3 }}>
                  <span>XP</span><span>{xpText}</span>
                </div>
                <XPBar fill={xp} color={xpColor} />
              </div>
            ))}

            {/* Leaderboard */}
            <div style={{ background: C.white, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,.07)" }}>
              {[["🥇", "👦", "Lucas", "2 340 XP", "🔥 12j"], ["🥈", "👧", "Emma", "1 850 XP", "🔥 8j"], ["🥉", "👨", "Papa", "1 200 XP", "🔥 3j"]].map(([medal, av, name, xp, streak], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: i % 2 === 0 ? "#FAFAFA" : C.white, borderBottom: i < 2 ? `1px solid ${C.gray}` : "none" }}>
                  <span style={{ fontSize: 13 }}>{medal}</span>
                  <span style={{ fontSize: 14 }}>{av}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.black, fontFamily: FONT }}>{name}</div>
                    <div style={{ fontSize: 8.5, color: C.muted, fontFamily: FONT }}>{xp}</div>
                  </div>
                  <div style={{ background: "#FEF3C7", color: "#D97706", fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 5, fontFamily: FONT }}>{streak}</div>
                </div>
              ))}
            </div>

            {/* Badges */}
            <div style={{ display: "flex", gap: 6 }}>
              {badgeEmojis.map((e, i) => {
                const bSpr = spr(frame, fps, { damping: 8, stiffness: 200 }, i * 8);
                const bScale = interpolate(bSpr, [0, 1], [0, 1]);
                return (
                  <div key={i} style={{ width: 40, height: 40, borderRadius: 10, background: C.gray, border: `2px solid ${badgeColors[i]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transform: `scale(${bScale})` }}>
                    {e}
                  </div>
                );
              })}
            </div>
          </div>
        </IPhone>
      </div>

      <div style={{ opacity: labelOp, fontFamily: FONT, fontSize: 32, fontWeight: 800, color: C.purple, textAlign: "center" }}>
        Make it a game.
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 7: Slogan Climax ──
function SceneSloganClimax() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = tw("The one that never forgets", frame, 0, 0.9);
  const dashSpr = spr(frame, fps, { damping: 200 }, 60);
  const dashScale = interpolate(dashSpr, [0, 1], [0, 1]);
  const line2 = tw("and never shares.", frame, 75, 1.0);

  return (
    <AbsoluteFill
      style={{
        background: C.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 60px",
        gap: 8,
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 48, fontWeight: 800, color: C.black, textAlign: "center", letterSpacing: -2, lineHeight: 1.15, minHeight: 58 }}>
        {line1}
        {frame >= 60 && (
          <span style={{ transform: `scale(${dashScale})`, display: "inline-block", margin: "0 8px", color: C.purple, fontSize: 32 }}>-</span>
        )}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 48, fontWeight: 700, color: C.purple, textAlign: "center", letterSpacing: -2, lineHeight: 1.15, minHeight: 58 }}>
        {line2}
        {frame >= 75 && frame < 110 && <span style={{ opacity: frame % 28 < 16 ? 1 : 0 }}>|</span>}
      </div>
    </AbsoluteFill>
  );
}

// ── SCENE 8: Closing ──
function SceneClosing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = useVideoConfig();
  const iconSpr = spr(frame, fps, { damping: 10, stiffness: 160 });
  const iconScale = interpolate(iconSpr, [0, 1], [0, 1]);
  const nameOp = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });
  const tagOp = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const underlineW = interpolate(spr(frame, fps, { damping: 200 }, 55), [0, 1], [0, 220]);
  const fadeOut = interpolate(frame, [durationInFrames - 40, durationInFrames], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: C.white,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        opacity: fadeOut,
      }}
    >
      <AppIcon size={130} scale={iconScale} />
      <div style={{ opacity: nameOp, fontFamily: FONT, fontSize: 52, fontWeight: 800, color: C.black, letterSpacing: -2 }}>
        Family Flow
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{
          opacity: tagOp,
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 500,
          color: C.muted,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}>
          Free. Private. Complete.
        </div>
        <div style={{ width: underlineW, height: 2, background: C.purple, borderRadius: 1 }} />
      </div>
    </AbsoluteFill>
  );
}

// ── Scene fade wrapper — handles cross-fade using local frame ──
function SceneFade({ duration, overlap, children }: { duration: number; overlap: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, overlap], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [duration - overlap, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
}

// ── MAIN ──
export function FamilyFlowPromo() {
  const T = 15; // cross-fade overlap in frames
  const scenes = [
    { start: 0, end: 60 },      // S1 logo: 0-60
    { start: 55, end: 145 },    // S2 slogan1: 55-145 (overlap 5)
    { start: 140, end: 265 },   // S3 dashboard: 140-265
    { start: 260, end: 385 },   // S4 calendar: 260-385
    { start: 380, end: 505 },   // S5 meals: 380-505
    { start: 500, end: 625 },   // S6 gamification: 500-625
    { start: 620, end: 745 },   // S7 slogan climax: 620-745
    { start: 740, end: 900 },   // S8 closing: 740-900
  ];

  const sceneComponents = [
    <SceneLogo />,
    <SceneSlogan1 />,
    <SceneDashboard />,
    <SceneCalendar />,
    <SceneMeals />,
    <SceneGamification />,
    <SceneSloganClimax />,
    <SceneClosing />,
  ];

  return (
    <AbsoluteFill style={{ background: C.white, overflow: "hidden" }}>
      {/* ── Background music (local) ── */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 15, 870, 900], [0, 0.35, 0.35, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* ── Scenes ── */}
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
}
