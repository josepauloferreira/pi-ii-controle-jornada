// Ícones SVG locais: mesmo traço, sem fonte ou biblioteca externa.
const paths = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  settings: '<path d="M4 6h7m4 0h5M4 12h3m4 0h9M4 18h9m4 0h3"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  logout: '<path d="M9 4H4v16h5m5-12 4 4-4 4M8 12h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18M10.6 5.1 12 5c7 0 10 7 10 7a17 17 0 0 1-3 4M6.3 6.3A19 19 0 0 0 2 12s3 7 10 7a12 12 0 0 0 5.7-1.7M10 10a2.8 2.8 0 0 0 4 4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
  balance: '<path d="M12 3v18m-6 0h12M4 6h16M6 6l-4 8h8L6 6Zm12 0-4 8h8l-4-8Z"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7"/>'
};
export const icon = (name, className = '') => `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.clock}</svg>`;
