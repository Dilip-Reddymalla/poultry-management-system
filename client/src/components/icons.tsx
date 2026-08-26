/**
 * A small, deliberate icon set: line icons at 1.6px on a 24 grid, drawn for the
 * things this app actually names — sheds, farms, people, tallies.
 */

type IconProps = { className?: string };

function svgProps(className?: string): React.SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    className: className ?? "icon",
  };
}

export function DashboardIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 13h6V4H4zM14 20h6V9h-6zM4 20h6v-4H4zM14 6h6V4h-6z" />
    </svg>
  );
}

export function PeopleIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 15c2 .6 3.3 2.4 3.3 5" />
    </svg>
  );
}

export function FarmIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 10.5 12 5l9 5.5" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

export function ShedIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 9.5 7 6h10l4 3.5" />
      <path d="M4 9.5V19h16V9.5" />
      <path d="M8 19v-4h3v4M14 12.5h3" />
    </svg>
  );
}

export function ProfileIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  );
}

export function CompanyIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 20V6l7-2v16M11 20V9l7 2v9M4 20h16" />
      <path d="M7 8v.01M7 11v.01M7 14v.01M14 13v.01M14 16v.01" />
    </svg>
  );
}

export function WorkerIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5" />
      <path d="M8.5 6.2a3.6 3.6 0 0 1 7 0" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" />
      <path d="m9 14.5 2 2 4-4" />
    </svg>
  );
}

export function SignOutIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BackIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M14 6l-6 6 6 6" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function EggIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3c3.3 0 6 4.6 6 9a6 6 0 0 1-12 0c0-4.4 2.7-9 6-9Z" />
    </svg>
  );
}

export function InstallIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 4v10M8.5 10.5 12 14l3.5-3.5" />
      <path d="M5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18.5V16" />
    </svg>
  );
}

export function OfflineIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...svgProps(className)}>
      <path d="M5 12.5a7 7 0 0 1 3-2.3M16 10.2a7 7 0 0 1 3 2.3" />
      <path d="M8.5 16a4.5 4.5 0 0 1 7 0" />
      <path d="M12 20h.01" />
      <path d="M4 4l16 16" />
    </svg>
  );
}
