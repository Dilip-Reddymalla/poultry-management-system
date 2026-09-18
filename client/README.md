# PoultryOps Client App

The modern web frontend for the PoultryOps Poultry Management & Biometric Suite. Engineered with **React 19**, **TypeScript**, **Vite**, **Framer Motion**, and **Recharts**.

---

## 🚀 Key Features & Pages

- **Interactive System Blueprint & About Page** (`/about`):
  - Fluid scroll-linked reading progress indicator.
  - Interactive multi-stage pipeline architecture with real-time specification card switcher.
  - Physics-based spring animations (`whileHover`, `whileTap`) and ambient floating radial glow orbs.
  - Capability category filtering and full-stack technology specifications.

- **Public Operations Telemetry & Analytics** (`/analytics`):
  - Live workforce presence ratios, shift breakdowns, and 7-day attendance velocity.
  - Interactive charts powered by **Recharts**.
  - **Zero-PII Privacy Protection**: Sanitized public API consumption preventing employee name exposure.

- **Ephemeral Biometric Face AI Sandbox** (`/face-ai-demo`):
  - Interactive testbed for registering profiles and executing <15ms vector matches.
  - Live webcam streaming and image file drag-and-drop.
  - Session-scoped 10-minute auto-expiring in-memory storage.

- **Core Operational Dashboard & Management** (Authenticated):
  - Farm & shed flock capacity monitoring with visual status indicators (`AVAILABLE`, `MAINTENANCE`, `INACTIVE`).
  - Shift-based attendance tracking (`MORNING_SHIFT`, `AFTERNOON_SHIFT`, `NIGHT_SHIFT`, `OVERTIME`) with GPS logging.
  - User provisioning, role assignments, and Excel export reports.

- **Installable Progressive Web App (PWA)**:
  - Built with `vite-plugin-pwa` for desktop and mobile installation.
  - Offline status detection and app shell caching.

---

## 🛠️ Setup & Development

```bash
# Install dependencies (React 19, Framer Motion, Lucide, Recharts)
npm install

# Start Vite dev server on http://localhost:5173
npm run dev
```

### Scripts

- `npm run dev`: Start Vite development server with hot module replacement (HMR).
- `npm run build`: Type-check (`tsc -b`) and build optimized production bundle in `dist/`.
- `npm run typecheck`: Run strict TypeScript checks across all features and routes.
- `npm run lint`: Run ESLint checks.
- `npm run preview`: Serve the production build locally.
- `npm run icons:generate`: Generate branded PWA icons.

---

## 🌐 Route Architecture

```text
Public Showcase Routes:
├── /about            # Interactive system architecture & tech showcase
├── /analytics        # Live operational metrics & workforce telemetry
├── /face-ai-demo     # Biometric 512-D vector testbed (10m TTL)
├── /login            # Enterprise credentials sign-in
├── /otp-login        # SMS OTP phone authentication
└── /forgot-password  # Password recovery

Protected Operational Routes (Behind RBAC):
├── /dashboard        # Farm and shed health summary
├── /companies        # Multi-company enterprise hierarchy
├── /farms            # Distributed farm locations
├── /sheds            # Individual flock shed capacities
├── /employees        # Internal staff directory & provisioning
├── /workers          # Farm field workers & squad assignments
├── /attendance       # Daily attendance records & Face AI logs
├── /audit-logs       # Tamper-resistant compliance ledger
└── /profile          # Personal user profile & attendance stats
```

---

## 🎨 Design System & Animation Engine

- **Palette**: Agricultural slate and nature tokens (`--moss`, `--clay`, `--rust`, `--ink`, `--paper`) defined in `src/index.css`.
- **Animations**: Driven by **Framer Motion** for spring physics, layout transitions, and scroll progress tracking.
- **Icons**: Clean iconography provided by **Lucide React** alongside branded SVG marks.
- **Privacy First**: Public showcase pages consume specialized zero-PII and session-isolated endpoints.
