import Link from "next/link";

const PVP_TYPES = [
  "Crystal",
  "Sword",
  "Axe",
  "UHC",
  "Manhunt",
  "Mace",
  "SMP",
  "Cart",
  "Bow",
];

const FEATURES = [
  {
    icon: "⚔",
    title: "Log Fights",
    desc: "Record match results across 9 PvP categories. Opponent confirms before it counts.",
  },
  {
    icon: "🏆",
    title: "Challenge System",
    desc: "10-match challenge sets with cooldowns. Climb through head-to-head results.",
  },
  {
    icon: "📊",
    title: "Live Rankings",
    desc: "Points-based leaderboard updated in real time as matches are verified.",
  },
  {
    icon: "🛡",
    title: "Verified Results",
    desc: "Dual-confirmation prevents fake results. Admins can override anything.",
  },
];

export default function HomePage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
      {/* Hero */}
      <section style={{ textAlign: "center", padding: "80px 0 64px" }}>
        <p
          className="font-mono"
          style={{
            color: "var(--color-green)",
            fontSize: "0.75rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Competitive Minecraft PvP
        </p>
        <h1
          className="font-pixel glow-green"
          style={{
            fontSize: "clamp(3rem, 8vw, 6rem)",
            color: "var(--color-green)",
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          MC PvP Tierlist
        </h1>
        <p
          className="font-pixel"
          style={{
            fontSize: "clamp(1.2rem, 3vw, 1.8rem)",
            color: "var(--color-gold)",
            marginBottom: 32,
            letterSpacing: "0.05em",
          }}
        >
          Track · Challenge · Dominate
        </p>
        <p
          style={{
            color: "var(--color-text-dim)",
            maxWidth: 520,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          }}
        >
          The definitive platform for tracking Minecraft PvP results. Log
          matches, challenge rivals, and see exactly where you rank across every
          combat style.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/register"
            className="btn btn-primary"
            style={{
              padding: "12px 32px",
              fontSize: "0.95rem",
              textDecoration: "none",
            }}
          >
            Get Started
          </Link>
          <Link
            href="/rankings"
            className="btn btn-ghost"
            style={{
              padding: "12px 32px",
              fontSize: "0.95rem",
              textDecoration: "none",
            }}
          >
            View Rankings
          </Link>
        </div>
      </section>

      {/* PvP Type Badges */}
      <section style={{ textAlign: "center", marginBottom: 80 }}>
        <p
          className="font-mono"
          style={{
            color: "var(--color-muted)",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Supported PvP Types
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {PVP_TYPES.map((t) => (
            <span
              key={t}
              className="badge badge-green"
              style={{ fontSize: "0.75rem", padding: "4px 12px" }}
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ marginBottom: 96 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card"
              style={{ padding: 28 }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>{f.icon}</div>
              <h3
                className="font-body"
                style={{
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  color: "var(--color-green)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  color: "var(--color-text-dim)",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="card"
        style={{
          textAlign: "center",
          padding: "48px 24px",
          marginBottom: 80,
          background:
            "linear-gradient(135deg, rgba(74,222,128,0.05) 0%, rgba(8,12,8,0) 60%)",
          borderColor: "rgba(74,222,128,0.2)",
        }}
      >
        <h2
          className="font-pixel glow-green"
          style={{
            fontSize: "2.5rem",
            color: "var(--color-green)",
            marginBottom: 16,
          }}
        >
          Ready to Compete?
        </h2>
        <p style={{ color: "var(--color-text-dim)", marginBottom: 28 }}>
          Register with your Minecraft username and start logging fights today.
        </p>
        <Link
          href="/register"
          className="btn btn-primary"
          style={{
            padding: "12px 36px",
            fontSize: "1rem",
            textDecoration: "none",
          }}
        >
          Create Account →
        </Link>
      </section>
    </div>
  );
}
