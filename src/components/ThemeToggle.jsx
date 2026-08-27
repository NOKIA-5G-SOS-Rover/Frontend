import React from 'react';

const THEME_ORDER = ['light', 'dark', 'pink'];
const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  pink: 'Pink',
};

export default function ThemeToggle({ theme = 'light', onCycle, className = '' }) {
  const safeTheme = THEME_ORDER.includes(theme) ? theme : 'light';
  const currentIndex = THEME_ORDER.indexOf(safeTheme);
  const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
  const classes = ['theme-toggle', `theme-toggle--${safeTheme}`, className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onCycle}
      aria-label={`${THEME_LABELS[safeTheme]} mode. Switch to ${THEME_LABELS[nextTheme].toLowerCase()} mode`}
      title={`${THEME_LABELS[safeTheme]} mode · next: ${THEME_LABELS[nextTheme]}`}
      data-theme={safeTheme}
    >
      <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false">
        <path d="M29 23C22 9 9 5 5 14c-4 9 7 16 24 9Z" />
        <path d="M35 23C42 9 55 5 59 14c4 9-7 16-24 9Z" />
        <circle cx="32" cy="24" r="5" />
        <path d="M29 28 20 43l12-5 12 5-9-15" />
      </svg>
    </button>
  );
}
