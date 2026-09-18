import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import {
  Activity,
  Cpu,
  Database,
  ShieldCheck,
  Server,
  Sparkles,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Users,
  Building2,
  Lock,
  Zap,
  Globe,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import { EggIcon } from "../../components/icons.js";
import "./AboutPage.css";

interface ArchitectureNode {
  id: string;
  step: string;
  title: string;
  short: string;
  details: string;
  tech: string[];
  icon: typeof Server;
  highlightColor: string;
}

const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: "client",
    step: "01 / CLIENT LAYER",
    title: "Web & Progressive Web App",
    short: "Ultra-responsive React 19 interface with offline PWA sync & camera access.",
    details:
      "Engineered for desktop farm managers and mobile shed workers in low-connectivity areas. Utilizes Vite PWA caching, local media streaming for face detection, and optimistic UI transitions.",
    tech: ["React 19", "Vite PWA", "Framer Motion", "Recharts", "Vanilla CSS Tokens"],
    icon: Smartphone,
    highlightColor: "#38bdf8",
  },
  {
    id: "api",
    step: "02 / SECURITY GATEWAY",
    title: "Express & Scoped RBAC",
    short: "Multi-tenant API gateway enforcing granular permission scopes & rate limits.",
    details:
      "Every endpoint enforces strict permission gates (`attendance:create`, `farm:view`, `worker:view`). Employs dual-tier rate limiting protecting against abuse while facilitating public showcase demos.",
    tech: ["Node.js", "Express", "JWT Bearer", "Express-Rate-Limit", "CORS Preflight Matrix"],
    icon: Server,
    highlightColor: "#92d8a4",
  },
  {
    id: "db",
    step: "03 / DATA PERSISTENCE",
    title: "PostgreSQL & Prisma ORM",
    short: "Structured relational models: Companies → Farms → Sheds → Workers.",
    details:
      "Strict data integrity using foreign keys, cascading relationships, unique identification numbers, and non-blocking immutable audit logging for all compliance actions.",
    tech: ["PostgreSQL", "Prisma ORM", "Transactions", "Relational Constraints", "Audit Ledger"],
    icon: Database,
    highlightColor: "#f59e0b",
  },
  {
    id: "ai",
    step: "04 / BIOMETRICS ENGINE",
    title: "EdgeFace & YuNet Biometric AI",
    short: "512-dimensional vector embedding pipeline with live liveness & quality filters.",
    details:
      "Full vision pipeline: YuNet face detection (OpenCV Zoo), Light-FaceQ quality filter (Qualcomm), MiniFASNetV2 anti-spoofing liveness, 112x112 similarity alignment, and EdgeFace-S (γ=0.5, 512-D) ArcFace embedding extraction with Cosine/Euclidean matching in <15ms. In public demo mode, vectors auto-expire in 10 minutes.",
    tech: [
      "YuNet Detector (ONNX)",
      "EdgeFace-S (512-D, γ=0.5)",
      "MiniFASNetV2 Liveness",
      "Light-FaceQ (Qualcomm)",
      "ArcFace 512-D Embeddings",
      "Cosine / Euclidean Match",
      "Ephemeral 10m TTL Store",
    ],
    icon: Cpu,
    highlightColor: "#a855f7",
  },
];

const FEATURES = [
  {
    id: "biometrics",
    title: "Biometric Face Recognition",
    category: "ai",
    desc: "Instant facial landmark mapping and 512-dimensional vector matching for seamless, contactless daily attendance.",
    icon: Camera,
    colorClass: "about-feature-card__icon-wrap--sky",
    pills: ["EdgeFace-S", "YuNet ONNX", "512-D Vectors", "<15ms Match", "MiniFASNetV2 Liveness"],
  },
  {
    id: "hierarchy",
    title: "Multi-Tier Infrastructure",
    category: "ops",
    desc: "Complete operational tree linking parent Companies to distributed Farms, individual Sheds, and worker assignment squads.",
    icon: Building2,
    colorClass: "about-feature-card__icon-wrap",
    pills: ["Companies", "Farms & Sheds", "Flock Capacity", "Status Tracking"],
  },
  {
    id: "workers",
    title: "Workforce & Employee Registry",
    category: "ops",
    desc: "Comprehensive roster tracking active workers, shift assignments, employee managers, and real-time attendance ratios.",
    icon: Users,
    colorClass: "about-feature-card__icon-wrap--clay",
    pills: ["Worker Directory", "Assigned Sheds", "Shifts", "Salary & Role"],
  },
  {
    id: "telemetry",
    title: "Telemetry & Live Analytics",
    category: "data",
    desc: "Aggregated, privacy-sanitized metrics on workforce presence, infrastructure utilization, and attendance trends.",
    icon: BarChart3,
    colorClass: "about-feature-card__icon-wrap",
    pills: ["Recharts", "Zero-PII Public Feed", "7-Day Velocity", "Status Breakdown"],
  },
  {
    id: "security",
    title: "Granular RBAC & Audit Trails",
    category: "sec",
    desc: "Strict cryptographic authentication, fine-grained access control lists, and tamper-resistant audit logs for all mutations.",
    icon: ShieldCheck,
    colorClass: "about-feature-card__icon-wrap--rust",
    pills: ["JWT Tokenization", "Action Auditing", "Role Gates", "IP Tracking"],
  },
  {
    id: "sandbox",
    title: "Ephemeral Demo Vector Store",
    category: "ai",
    desc: "Dedicated sandbox allowing visitors and recruiters to test facial recognition with automated 10-minute session TTL cleanup.",
    icon: Zap,
    colorClass: "about-feature-card__icon-wrap--sky",
    pills: ["Auto-TTL 10m", "512-D In-Memory Store", "Session Isolated", "Strict Privacy"],
  },
];

const TECH_CATEGORIES = [
  {
    title: "Frontend Engineering",
    icon: Globe,
    items: ["React 19", "TypeScript", "Vite", "Framer Motion", "Recharts", "Lucide React", "Vite PWA"],
  },
  {
    title: "Backend & Gateway",
    icon: Server,
    items: ["Node.js", "Express", "JWT Bearer", "CORS Multi-Transport", "Express-Rate-Limit", "Multer"],
  },
  {
    title: "AI & Vector Inference",
    icon: Cpu,
    items: [
      "EdgeFace-S (512-D, γ=0.5)",
      "YuNet Face Detector (ONNX)",
      "MiniFASNetV2 (Anti-Spoof Liveness)",
      "Light-FaceQ (Qualcomm Quality)",
      "ArcFace / Cosine Similarity",
      "112x112 Similarity Transform",
      "Ephemeral 10m TTL Sandbox",
    ],
  },
  {
    title: "Database & Security",
    icon: Lock,
    items: ["PostgreSQL", "Prisma ORM", "PBKDF2 Password Hashing", "Role-Based ACL", "Audit Logging"],
  },
];

export function AboutPage(): React.ReactElement {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [activeNodeId, setActiveNodeId] = useState<string>("client");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const activeNode: ArchitectureNode =
    ARCHITECTURE_NODES.find((n) => n.id === activeNodeId) ?? ARCHITECTURE_NODES[0]!;

  const filteredFeatures =
    selectedCategory === "all"
      ? FEATURES
      : FEATURES.filter((f) => f.category === selectedCategory);

  return (
    <div className="about-page">
      {/* Scroll-linked Progress Bar */}
      <motion.div className="about-progress-bar" style={{ scaleX }} />

      {/* Navigation */}
      <header className="about-nav">
        <Link to="/about" className="about-nav__brand">
          <EggIcon className="sidebar__mark" />
          <span>
            Poultry<strong>Ops</strong>
          </span>
        </Link>

        <nav className="about-nav__links">
          <a href="#overview" className="about-nav__link">
            Overview
          </a>
          <a href="#architecture" className="about-nav__link">
            Architecture
          </a>
          <a href="#features" className="about-nav__link">
            Features
          </a>
          <a href="#demos" className="about-nav__link">
            Live Demos
          </a>
          <a href="#stack" className="about-nav__link">
            Tech Stack
          </a>
        </nav>

        <div className="about-nav__actions">
          <Link to="/analytics" className="about-cta-btn about-cta-btn--secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            <BarChart3 size={15} />
            Analytics
          </Link>
          <Link to="/face-ai-demo" className="about-cta-btn about-cta-btn--primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            <Sparkles size={15} />
            Face AI
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="about-hero" id="overview">
        {/* Animated Ambient Glow Orbs */}
        <motion.div
          className="about-hero__ambient-glow about-hero__glow-1"
          animate={{
            x: [0, 40, 0],
            y: [0, -30, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="about-hero__ambient-glow about-hero__glow-2"
          animate={{
            x: [0, -50, 0],
            y: [0, 35, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="about-hero__ambient-glow about-hero__glow-3"
          animate={{
            scale: [0.9, 1.25, 0.9],
            opacity: [0.15, 0.28, 0.15],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="about-hero__container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="about-badge"
          >
            <span className="about-badge__pulse" />
            <span>Industrial Agricultural Intelligence & Biometrics</span>
          </motion.div>

          <motion.h1
            className="about-hero__title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Scalable Poultry Infrastructure & <span>On-Premise Biometric AI</span>
          </motion.h1>

          <motion.p
            className="about-hero__desc"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            An internal enterprise platform engineered to modernize poultry operations. 
            Combines multi-tier farm & shed capacity management, worker shift logistics, 
            and private biometric face recognition with high-speed Euclidean vector search.
          </motion.p>

          {/* Dual Action Hero Buttons */}
          <motion.div
            className="about-hero__cta-group"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link to="/analytics" className="about-cta-btn about-cta-btn--primary">
                <BarChart3 size={18} />
                <span>Explore Live Analytics</span>
                <ArrowRight size={16} />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link to="/face-ai-demo" className="about-cta-btn about-cta-btn--secondary">
                <Sparkles size={18} color="#38bdf8" />
                <span>Launch Face AI Sandbox</span>
                <ChevronRight size={16} />
              </Link>
            </motion.div>
          </motion.div>

          {/* Metric Highlights */}
          <motion.div
            className="about-hero__stats"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="about-hero__stat-card">
              <div className="about-hero__stat-val">512-D</div>
              <div className="about-hero__stat-label">Vector Face Embeddings</div>
            </div>
            <div className="about-hero__stat-card">
              <div className="about-hero__stat-val">&lt; 15ms</div>
              <div className="about-hero__stat-label">Euclidean Match Latency</div>
            </div>
            <div className="about-hero__stat-card">
              <div className="about-hero__stat-val">100%</div>
              <div className="about-hero__stat-label">Privacy Preserving (0 PII Leaks)</div>
            </div>
            <div className="about-hero__stat-card">
              <div className="about-hero__stat-val">10m TTL</div>
              <div className="about-hero__stat-label">Ephemeral Demo Auto-Cleanup</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Architecture Pipeline Section */}
      <section className="about-section" id="architecture">
        <div className="about-section-header">
          <div className="eyebrow" style={{ color: "var(--moss)", marginBottom: "8px" }}>
            SYSTEM BLUEPRINT
          </div>
          <h2 className="about-section-title">Interactive System Pipeline</h2>
          <p className="about-section-desc">
            Explore the multi-layered technology topology connecting field devices, security boundaries, 
            relational databases, and real-time biometric inference.
          </p>
        </div>

        <div className="about-pipeline-container">
          <div className="about-pipeline-nodes">
            {ARCHITECTURE_NODES.map((node) => {
              const IconComp = node.icon;
              const isActive = activeNodeId === node.id;
              return (
                <motion.div
                  key={node.id}
                  className={`about-pipeline-node ${isActive ? "about-pipeline-node--active" : ""}`}
                  onClick={() => setActiveNodeId(node.id)}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="about-pipeline-node__step">{node.step}</div>
                  <div className="about-pipeline-node__title">
                    <span>{node.title}</span>
                    <IconComp size={18} color={isActive ? "#38bdf8" : "rgba(255,255,255,0.6)"} />
                  </div>
                  <p className="about-pipeline-node__desc">{node.short}</p>
                </motion.div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeNode.id}
              className="about-pipeline-details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <div className="about-pipeline-details__content">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: activeNode.highlightColor,
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: activeNode.highlightColor, fontWeight: 600 }}>
                    {activeNode.step} SPECIFICATION
                  </span>
                </div>
                <h4>{activeNode.title}</h4>
                <p>{activeNode.details}</p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: "340px" }}>
                {activeNode.tech.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#ffffff",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Live Demos Showcase Section */}
      <section className="about-section" id="demos">
        <div className="about-section-header">
          <div className="eyebrow" style={{ color: "var(--clay)", marginBottom: "8px" }}>
            PORTFOLIO SHOWCASE
          </div>
          <h2 className="about-section-title">Interactive Live Showcases</h2>
          <p className="about-section-desc">
            Experience the system firsthand. Inspect live operational farm telemetry or test the 
            contactless face recognition AI sandbox without registering an account.
          </p>
        </div>

        <div className="about-demos-grid">
          {/* Demo 1: Analytics */}
          <motion.div
            className="about-demo-card about-demo-card--analytics"
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div>
              <div className="about-demo-card__tag">
                <Activity size={13} />
                <span>Live Telemetry</span>
              </div>
              <h3 className="about-demo-card__title">Farm Operations & Analytics</h3>
              <p className="about-demo-card__desc">
                High-level operational metrics showing real-time workforce attendance, 
                capacity utilization across all sheds, and 7-day velocity distributions. 
                Built with strict zero-PII privacy protection for public evaluation.
              </p>

              <ul className="about-demo-card__features">
                <li>
                  <CheckCircle2 size={16} color="#92d8a4" />
                  <span>Real-time presence ratios & status breakdowns</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#92d8a4" />
                  <span>Interactive Recharts telemetry visualizations</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#92d8a4" />
                  <span>Zero-leak architecture hiding personal identifying names</span>
                </li>
              </ul>
            </div>

            <Link to="/analytics" className="about-demo-card__btn">
              <BarChart3 size={18} />
              <span>Launch Analytics Dashboard</span>
              <ArrowRight size={16} />
            </Link>
          </motion.div>

          {/* Demo 2: Face AI Sandbox */}
          <motion.div
            className="about-demo-card about-demo-card--ai"
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div>
              <div className="about-demo-card__tag">
                <Sparkles size={13} />
                <span>AI Sandbox (10m TTL)</span>
              </div>
              <h3 className="about-demo-card__title">Biometric Face AI Sandbox</h3>
              <p className="about-demo-card__desc">
                Test the neural network embedding pipeline in your browser. Register sample profiles, 
                extract 512-float mathematical descriptors, and perform live Euclidean matching. 
                Embeddings exist in-memory only and self-destruct after 10 minutes.
              </p>

              <ul className="about-demo-card__features">
                <li>
                  <CheckCircle2 size={16} color="#38bdf8" />
                  <span>Live camera feed or image file upload support</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#38bdf8" />
                  <span>Sub-15ms vector match pipeline inspection</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#38bdf8" />
                  <span>No database persistence or third-party cloud storage</span>
                </li>
              </ul>
            </div>

            <Link to="/face-ai-demo" className="about-demo-card__btn">
              <Camera size={18} />
              <span>Launch Face AI Sandbox</span>
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature Deep-Dive with Interactive Category Filter */}
      <section className="about-section" id="features">
        <div className="about-section-header">
          <div className="eyebrow" style={{ color: "var(--moss)", marginBottom: "8px" }}>
            CAPABILITIES
          </div>
          <h2 className="about-section-title">Core System Capabilities</h2>
          <p className="about-section-desc">
            Tailored specifically for enterprise agricultural firms managing distributed workforce squads 
            and intensive poultry cycles.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Capabilities" },
              { id: "ai", label: "Biometric AI" },
              { id: "ops", label: "Farm Operations" },
              { id: "data", label: "Analytics" },
              { id: "sec", label: "Security & Auditing" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: selectedCategory === tab.id ? "1px solid var(--moss)" : "1px solid var(--line-strong)",
                  backgroundColor: selectedCategory === tab.id ? "var(--moss)" : "var(--surface)",
                  color: selectedCategory === tab.id ? "#ffffff" : "var(--ink)",
                  transition: "all 150ms ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div layout className="about-features-grid">
          <AnimatePresence>
            {filteredFeatures.map((feat) => {
              const IconComp = feat.icon;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  key={feat.id}
                  className="about-feature-card"
                  whileHover={{ y: -4, boxShadow: "0 10px 24px rgba(22, 33, 28, 0.09)" }}
                >
                  <div className={`about-feature-card__icon-wrap ${feat.colorClass}`}>
                    <IconComp size={24} />
                  </div>
                  <h3 className="about-feature-card__title">{feat.title}</h3>
                  <p className="about-feature-card__desc">{feat.desc}</p>
                  <div className="about-feature-card__pills">
                    {feat.pills.map((p) => (
                      <span key={p} className="about-pill">
                        {p}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* Tech Stack Matrix Section */}
      <section className="about-section" id="stack">
        <div className="about-section-header">
          <div className="eyebrow" style={{ color: "var(--moss)", marginBottom: "8px" }}>
            SPECIFICATIONS
          </div>
          <h2 className="about-section-title">Full-Stack Technology Suite</h2>
          <p className="about-section-desc">
            A production-grade stack chosen for developer velocity, offline resilience, 
            type safety, and high-performance in-memory biometric vector queries.
          </p>
        </div>

        <div className="about-stack-categories">
          {TECH_CATEGORIES.map((cat) => {
            const IconComp = cat.icon;
            return (
              <motion.div
                key={cat.title}
                className="about-stack-category"
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              >
                <div className="about-stack-category__heading">
                  <IconComp size={18} color="var(--moss)" />
                  <span>{cat.title}</span>
                </div>
                <div className="about-stack-items">
                  {cat.items.map((item) => (
                    <span key={item} className="about-stack-badge">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <p>
          <strong>PoultryOps — Enterprise Poultry Management & Biometric Suite</strong> — Engineered as an enterprise showcase project.
        </p>
        <p>
          Need access to company credentials or production deployment details?{" "}
          <Link to="/login">Access Internal Portal</Link>
        </p>
      </footer>
    </div>
  );
}
