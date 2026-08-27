import React, { useEffect, useRef, useState } from 'react';
import '../styles/profile-menu.css';

const THEME_ORDER = ['light', 'dark', 'pink'];
const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  pink: 'Pink',
};

const AUTH_STORAGE_KEY = 'sanzi-operator-session-v2';

const readCurrentProfile = () => {
  try {
    const stored = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (!parsed?.username) return null;

    return {
      username: parsed.username,
      role: parsed.role || 'operator',
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      roverIds: Array.isArray(parsed.roverIds) ? parsed.roverIds : [],
    };
  } catch (error) {
    return null;
  }
};

const BowIcon = () => (
  <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false">
    <path d="M29 23C22 9 9 5 5 14c-4 9 7 16 24 9Z" />
    <path d="M35 23C42 9 55 5 59 14c4 9-7 16-24 9Z" />
    <circle cx="32" cy="24" r="5" />
    <path d="M29 28 20 43l12-5 12 5-9-15" />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="8" r="3.25" />
    <path d="M5.5 19c.7-3.35 3.15-5.25 6.5-5.25s5.8 1.9 6.5 5.25" />
  </svg>
);

const normaliseRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin' || value === 'administrator') return 'Administrator';
  if (value === 'user') return 'Operator';
  if (!value) return 'Operator';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function ThemeToggle({ theme = 'light', onCycle, className = '' }) {
  const safeTheme = THEME_ORDER.includes(theme) ? theme : 'light';
  const currentIndex = THEME_ORDER.indexOf(safeTheme);
  const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
  const classes = ['theme-toggle', `theme-toggle--${safeTheme}`, className].filter(Boolean).join(' ');

  const [profileOpen, setProfileOpen] = useState(false);
  const profileAreaRef = useRef(null);

  // Read directly on every render so a backend permission/session update is
  // reflected without introducing another copy of authentication state.
  const profile = typeof window !== 'undefined' ? readCurrentProfile() : null;

  useEffect(() => {
    if (!profileOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!profileAreaRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!profile) setProfileOpen(false);
  }, [profile]);

  const initials = profile?.username
    ? profile.username
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
    : '';

  return (
    <div className="theme-profile-controls" ref={profileAreaRef}>
      <button
        type="button"
        className={classes}
        onClick={onCycle}
        aria-label={`${THEME_LABELS[safeTheme]} mode. Switch to ${THEME_LABELS[nextTheme].toLowerCase()} mode`}
        title={`${THEME_LABELS[safeTheme]} mode · next: ${THEME_LABELS[nextTheme]}`}
        data-theme={safeTheme}
      >
        <BowIcon />
      </button>

      {profile && (
        <div className="profile-control">
          <button
            type="button"
            className={`profile-toggle profile-toggle--${safeTheme} ${profileOpen ? 'is-open' : ''}`}
            onClick={() => setProfileOpen((current) => !current)}
            aria-label={profileOpen ? 'Close account details' : 'Open account details'}
            aria-expanded={profileOpen}
            aria-haspopup="dialog"
            title="Account"
          >
            <ProfileIcon />
          </button>

          <div
            className={`profile-popover ${profileOpen ? 'is-open' : ''}`}
            role="dialog"
            aria-label="Account details"
            aria-hidden={!profileOpen}
          >
            <div className="profile-popover__top">
              <span className="profile-popover__eyebrow">Signed in as</span>
              <button
                type="button"
                className="profile-popover__close"
                onClick={() => setProfileOpen(false)}
                aria-label="Close account details"
              >
                ×
              </button>
            </div>

            <div className="profile-popover__identity">
              <span className="profile-popover__avatar" aria-hidden="true">
                {initials || 'U'}
              </span>
              <div>
                <strong>{profile.username}</strong>
                <span>{normaliseRole(profile.role)}</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
