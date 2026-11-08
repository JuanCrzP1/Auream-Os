// Iconos de las tarjetas de elección. Trazo 1.6, `currentColor`, caja 20.

function Svg({ children }: { readonly children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const PlusTagIcon = () => (
  <Svg>
    <path d="M3 10.6V4.5A1.5 1.5 0 0 1 4.5 3h6.1l6.4 6.4-7.6 7.6z" />
    <path d="M7 6.5v3M5.5 8h3" />
  </Svg>
);

export const MinusTagIcon = () => (
  <Svg>
    <path d="M3 10.6V4.5A1.5 1.5 0 0 1 4.5 3h6.1l6.4 6.4-7.6 7.6z" />
    <path d="M5.5 8h3" />
  </Svg>
);

export const ListIcon = () => (
  <Svg>
    <rect x="3" y="3.5" width="14" height="13" rx="2.5" />
    <path d="M6.5 7.5h7M6.5 10h7M6.5 12.5h4.5" />
  </Svg>
);

export const ButtonsIcon = () => (
  <Svg>
    <rect x="3" y="3.5" width="14" height="3.5" rx="1.5" />
    <rect x="3" y="8.25" width="14" height="3.5" rx="1.5" />
    <rect x="3" y="13" width="14" height="3.5" rx="1.5" />
  </Svg>
);

export const AllIcon = () => (
  <Svg>
    <path d="M4 10.5l2.5 2.5L11 8.5" />
    <path d="M9 13l1 1 6-6.5" />
  </Svg>
);

export const AnyIcon = () => (
  <Svg>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M7 10.2l2 2 4-4.4" />
  </Svg>
);

export const UserPlusIcon = () => (
  <Svg>
    <circle cx="8.5" cy="7" r="3" />
    <path d="M3.5 16c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3M15 6v4M13 8h4" />
  </Svg>
);

export const CartIcon = () => (
  <Svg>
    <path d="M2.5 3.5h2l1.8 8.5h8.4l1.8-6H6" />
    <circle cx="8" cy="15.5" r="1.1" />
    <circle cx="13.5" cy="15.5" r="1.1" />
  </Svg>
);
