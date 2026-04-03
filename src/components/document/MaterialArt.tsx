type MaterialArtProps = {
  kind: 'training' | 'onboarding' | 'handbook';
  className?: string;
};

const palettes = {
  training: {
    backdrop: '#efe4fb',
    panel: '#ffffff',
    panelSoft: '#d8c3f7',
    accent: '#7b4a8f',
    accentSoft: '#a77cd3',
    stroke: '#3d2251',
    text: '#42265d',
  },
  onboarding: {
    backdrop: '#eadcf9',
    panel: '#ffffff',
    panelSoft: '#d3b7f5',
    accent: '#8a56a3',
    accentSoft: '#b58ae2',
    stroke: '#4c2d69',
    text: '#4a2d66',
  },
  handbook: {
    backdrop: '#f2e7fc',
    panel: '#ffffff',
    panelSoft: '#e0c9f8',
    accent: '#744492',
    accentSoft: '#aa80d6',
    stroke: '#56316f',
    text: '#52316b',
  },
} as const;

export default function MaterialArt({ kind, className }: MaterialArtProps) {
  const palette = palettes[kind];

  if (kind === 'training') {
    return (
      <svg viewBox="0 0 120 92" className={className} aria-hidden="true">
        <rect x="8" y="10" width="104" height="72" rx="20" fill={palette.backdrop} />
        <rect x="18" y="24" width="54" height="42" rx="12" fill={palette.panel} />
        <rect x="22" y="29" width="46" height="8" rx="4" fill={palette.panelSoft} />
        <rect x="22" y="43" width="22" height="15" rx="7.5" fill={palette.accent} />
        <path d="M31 46.5L38 50.5L31 54.5V46.5Z" fill={palette.panel} />
        <rect x="76" y="18" width="26" height="44" rx="11" fill={palette.accent} />
        <circle cx="89" cy="33" r="7" fill={palette.panel} />
        <path
          d="M83 46.5H95M83 52H95"
          stroke={palette.panel}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M26 70C32 63 42 61 50 65C57 68 63 69 70 66"
          stroke={palette.stroke}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M77 68L83 74L100 57"
          stroke={palette.accentSoft}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === 'onboarding') {
    return (
      <svg viewBox="0 0 120 92" className={className} aria-hidden="true">
        <rect x="8" y="10" width="104" height="72" rx="20" fill={palette.backdrop} />
        <rect x="18" y="20" width="40" height="52" rx="14" fill={palette.panel} />
        <circle cx="38" cy="34" r="8" fill={palette.panelSoft} />
        <path
          d="M27 52C30 46 36 43 42 43C48 43 53 46 56 52"
          stroke={palette.accent}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="64" y="24" width="38" height="44" rx="12" fill={palette.accent} />
        <path
          d="M74 37H92M74 46H92M74 55H86"
          stroke={palette.panel}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M34 70L49 56L58 63L76 44L92 58"
          stroke={palette.accentSoft}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 92" className={className} aria-hidden="true">
      <rect x="8" y="10" width="104" height="72" rx="20" fill={palette.backdrop} />
      <path
        d="M30 24H67C73 24 78 29 78 35V66C78 71 74 76 69 76H30C24 76 20 72 20 67V34C20 29 24 24 30 24Z"
        fill={palette.panel}
      />
      <path
        d="M69 24H87C92 24 96 28 96 33V64C96 69 92 73 87 73H69C74 73 78 69 78 64V35C78 29 74 24 69 24Z"
        fill={palette.panelSoft}
      />
      <path
        d="M31 34H62M31 43H62M31 52H56"
        stroke={palette.text}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M59 18H82L89 27V57C89 61 86 64 82 64H59C55 64 52 61 52 57V25C52 21 55 18 59 18Z"
        fill={palette.accent}
      />
      <path d="M82 18V27H89" stroke={palette.panel} strokeWidth="4" strokeLinecap="round" />
      <path
        d="M63 33H78M63 42H78M63 51H72"
        stroke={palette.panel}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M24 71C34 63 49 61 60 65C67 68 75 68 84 63"
        stroke={palette.accentSoft}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
