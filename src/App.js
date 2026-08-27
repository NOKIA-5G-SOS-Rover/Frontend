import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import './App.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/navigation.css';
import './styles/login.css';
import './styles/admin.css';
import './styles/home.css';
import './styles/cameras.css';
import './styles/events.css';
import './styles/alerts.css';
import './styles/responsive.css';
import './fullscreen-viewer.css';
import './fullscreen-zoom-styles.css';
import './styles/coquette.css';
import HomeView from './components/HomeView';
import CamerasView from './components/CamerasView';
import PastAlertsView from './components/PastAlertsView';
import LoginView from './components/LoginView';
import AdminView from './components/AdminView';
import ThemeToggle from './components/ThemeToggle';
import { ALL_PERMISSIONS, DEFAULT_OPERATOR_PERMISSIONS, PERMISSIONS, getFirstAllowedView, hasPermission } from './auth/permissions';
import {
  formatAlertTitle,
  inferEventSeverity,
  normalizeConfidence,
  normalizeReviewStatus,
  resolveEventImageUrl,
  sortEventsNewestFirst,
} from './utils/eventNormalization';


const NOTIFIED_CRITICAL_ALERTS_KEY = 'sanzi-notified-critical-alert-ids';
const MAX_STORED_ALERT_IDS = 100;
const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const AUTH_STORAGE_KEY = 'sanzi-operator-session-v2';
const ADMIN_DEMO_STORAGE_KEY = 'sanzi-admin-demo-state-v2';
const VIEW_STORAGE_KEY = 'sanzi-current-view-v1';
const THEME_STORAGE_KEY = 'sanzi-theme-v1';
const THEME_ORDER = ['light', 'dark', 'pink'];
const VALID_VIEWS = new Set(['home-view', 'cameras-view', 'past-alerts-view', 'admin-view']);
const DEMO_ADMIN_USERNAME = process.env.REACT_APP_DEMO_ADMIN_USERNAME || 'admin';
const DEMO_ADMIN_PASSWORD = process.env.REACT_APP_DEMO_ADMIN_PASSWORD || 'dansiandrei';
const AUTH_LOGIN_ENDPOINT = process.env.REACT_APP_AUTH_LOGIN_ENDPOINT || '';


const readCurrentView = () => {
  try {
    const storedView = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    return VALID_VIEWS.has(storedView) ? storedView : 'home-view';
  } catch (error) {
    return 'home-view';
  }
};

const readThemePreference = () => {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_ORDER.includes(storedTheme) ? storedTheme : 'light';
  } catch (error) {
    return 'light';
  }
};

const userCanAccessView = (user, viewId) => {
  if (!user) return false;
  if (viewId === 'home-view') return hasPermission(user, PERMISSIONS.VIEW_OVERVIEW);
  if (viewId === 'cameras-view') return hasPermission(user, PERMISSIONS.VIEW_CAMERAS);
  if (viewId === 'past-alerts-view') return hasPermission(user, PERMISSIONS.VIEW_PAST_ALERTS);
  if (viewId === 'admin-view') return hasPermission(user, PERMISSIONS.ACCESS_ADMIN);
  return false;
};

const parseTelemetryNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numericValue) ? numericValue : null;
};

const pickTelemetryNumber = (payload, keys) => {
  if (!payload || typeof payload !== 'object') return null;
  for (const key of keys) {
    const value = parseTelemetryNumber(payload[key]);
    if (value !== null) return value;
  }
  return null;
};

const buildDemoAdminUser = (username) => ({
  id: 'account-admin',
  username,
  permissions: [...ALL_PERMISSIONS],
  roverIds: ['sanzi'],
  role: 'admin',
});

const readLocalAdminAccounts = () => {
  try {
    const storedValue = window.localStorage.getItem(ADMIN_DEMO_STORAGE_KEY);
    if (!storedValue) return [];
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed?.accounts) ? parsed.accounts : [];
  } catch (error) {
    return [];
  }
};

const buildLocalAccountUser = (account) => ({
  id: account.id,
  username: account.username,
  permissions: Array.isArray(account.permissions) ? [...new Set(account.permissions)] : [],
  roverIds: Array.isArray(account.roverIds) ? [...new Set(account.roverIds)] : [],
  role: Array.isArray(account.permissions) && account.permissions.includes(PERMISSIONS.ACCESS_ADMIN) ? 'admin' : 'operator',
});


const normalizeBackendPermissions = (permissions, role) => {
  if (String(role || '').toLowerCase() === 'admin') return [...ALL_PERMISSIONS];
  if (!Array.isArray(permissions)) return [...DEFAULT_OPERATOR_PERMISSIONS];

  const normalized = new Set();
  permissions.forEach((permission) => {
    const rawValue = typeof permission === 'object' && permission !== null
      ? (permission.key || permission.permission || permission.name || permission.label)
      : permission;
    if (typeof rawValue !== 'string') return;

    const value = rawValue.trim();
    if (ALL_PERMISSIONS.includes(value)) {
      normalized.add(value);
      return;
    }

    if (PERMISSIONS[value]) {
      normalized.add(PERMISSIONS[value]);
      return;
    }

    const normalizedAlias = value.toLowerCase().replace(/[\s_]+/g, '-');
    const exactKey = ALL_PERMISSIONS.find((permissionKey) => permissionKey.toLowerCase() === normalizedAlias);
    if (exactKey) normalized.add(exactKey);
  });

  return normalized.size ? ALL_PERMISSIONS.filter((permission) => normalized.has(permission)) : [...DEFAULT_OPERATOR_PERMISSIONS];
};

const normalizeBackendRoverIds = (candidate) => {
  const roverValues = candidate?.roverIds || candidate?.rovers || candidate?.assignedRovers || [];
  if (!Array.isArray(roverValues)) return ['sanzi'];

  const roverIds = roverValues
    .map((rover) => {
      if (typeof rover === 'string') return rover;
      if (!rover || typeof rover !== 'object') return null;
      return rover.id || rover.roverId || rover.slug || rover.name;
    })
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return roverIds.length ? [...new Set(roverIds)] : ['sanzi'];
};

const buildBackendAccountUser = (payload, fallbackUsername) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const candidate = data?.user || data?.account || data?.operator || data?.profile || data;
  if (!candidate || typeof candidate !== 'object') return null;

  const role = candidate.role || candidate.accountRole || data?.role || 'operator';
  const permissions = candidate.permissions || candidate.permissionKeys || candidate.access || data?.permissions;
  const username = candidate.username || candidate.userName || candidate.name || fallbackUsername;
  const id = candidate.id || candidate.accountId || candidate.userId || data?.accountId || data?.userId || username;

  if (!username) return null;
  if (candidate.enabled === false || candidate.isEnabled === false || candidate.active === false) {
    return { disabled: true };
  }

  return {
    id: String(id),
    username: String(username),
    permissions: normalizeBackendPermissions(permissions, role),
    roverIds: normalizeBackendRoverIds(candidate),
    role: String(role).toLowerCase() === 'admin' ? 'admin' : 'operator',
    authToken: data?.token || data?.accessToken || data?.jwt || payload?.token || payload?.accessToken || null,
    source: 'backend',
  };
};

const getBackendLoginEndpoints = () => {
  const endpoints = [];
  const addEndpoint = (value) => {
    if (!value) return;
    const resolved = /^https?:\/\//i.test(value)
      ? value
      : `${backendUrl}${value.startsWith('/') ? '' : '/'}${value}`;
    if (!endpoints.includes(resolved)) endpoints.push(resolved);
  };

  addEndpoint(AUTH_LOGIN_ENDPOINT);
  addEndpoint('/auth/login');
  addEndpoint('/login');
  addEndpoint('/api/login');
  addEndpoint('/api/auth/login');
  addEndpoint('/accounts/login');
  addEndpoint('/api/accounts/login');
  addEndpoint('/users/login');
  addEndpoint('/api/users/login');
  return endpoints;
};

const authenticateAgainstBackend = async (username, password) => {
  if (typeof fetch !== 'function') return { attempted: false };

  let reachedAuthEndpoint = false;
  for (const endpoint of getBackendLoginEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 404 || response.status === 405) continue;
      reachedAuthEndpoint = true;

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok || payload?.success === false) {
        const backendMessage = payload?.message || payload?.error || payload?.detail;
        return {
          attempted: true,
          success: false,
          message: backendMessage || (response.status === 401 || response.status === 403
            ? 'Incorrect user or password.'
            : 'The backend rejected the login request.'),
        };
      }

      const user = buildBackendAccountUser(response.status === 204 ? {} : payload, username);
      if (user?.disabled) {
        return { attempted: true, success: false, message: 'This account is disabled.' };
      }
      if (!user) {
        return {
          attempted: true,
          success: false,
          message: 'The backend authenticated the account but did not return usable account data.',
        };
      }

      return { attempted: true, success: true, user };
    } catch (error) {
      // Try the next supported endpoint. A network failure should not break local demo accounts.
    }
  }

  return { attempted: reachedAuthEndpoint, success: false };
};

const recordLocalAccountLogin = (accountId) => {
  try {
    const storedValue = window.localStorage.getItem(ADMIN_DEMO_STORAGE_KEY);
    if (!storedValue) return;
    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed?.accounts)) return;

    const now = new Date().toISOString();
    const accounts = parsed.accounts.map((account) => (
      account.id === accountId ? { ...account, lastLogin: now } : account
    ));

    window.localStorage.setItem(ADMIN_DEMO_STORAGE_KEY, JSON.stringify({ ...parsed, accounts }));
  } catch (error) {
    // Login still succeeds if the local admin preview state cannot be updated.
  }
};

const readAuthSession = () => {
  try {
    const storedValue = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedValue) return null;

    const parsed = JSON.parse(storedValue);
    if (!parsed?.username || !Array.isArray(parsed?.permissions)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
};

console.log('[App] SignalR backend URL:', backendUrl);

// 1. CREATE THE CONNECTION OUTSIDE THE COMPONENT (True Singleton)
const globalSignalRConnection = new HubConnectionBuilder()
  .withUrl(`${backendUrl}/dashboardHub`)
  .withAutomaticReconnect()
  .build();

window.debugConnection = globalSignalRConnection; 
// Start it exactly once when the JavaScript file loads
globalSignalRConnection.start()
  .then(() => console.log('Conectat cu succes la SignalR (DashboardHub)!'))
  .catch(err => console.error('Eroare la conectarea SignalR: ', err));

let criticalAlertAudio = null;

const playCriticalAlertSound = () => {
  try {
    if (!criticalAlertAudio) {
      criticalAlertAudio = new Audio('/sounds/critical-alert.wav');
      criticalAlertAudio.preload = 'auto';
      criticalAlertAudio.volume = 1;
    }
    criticalAlertAudio.pause();
    criticalAlertAudio.currentTime = 0;
    const playPromise = criticalAlertAudio.play();
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn('Critical alert sound was blocked by the browser.', error);
      });
    }
  } catch (error) {
    console.warn('Critical alert sound could not be played.', error);
  }
};

const getNotifiedCriticalAlertIds = () => {
  try {
    const storedValue = window.localStorage.getItem(NOTIFIED_CRITICAL_ALERTS_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    return [];
  }
};

const markCriticalAlertAsNotified = (alertId) => {
  if (!alertId) return false;
  const notifiedIds = getNotifiedCriticalAlertIds();
  if (notifiedIds.includes(alertId)) {
    return false;
  }
  const updatedIds = [...notifiedIds, alertId].slice(-MAX_STORED_ALERT_IDS);
  try {
    window.localStorage.setItem(
      NOTIFIED_CRITICAL_ALERTS_KEY,
      JSON.stringify(updatedIds)
    );
  } catch (error) {
    // Silent fail
  }
  return true;
};

const mapBackendEvent = (backendEvent) => {
  const source = backendEvent.source || backendEvent.cameraId || 'rover sensors';
  const hasCoordinates = backendEvent.locationX !== null
    && backendEvent.locationX !== undefined
    && backendEvent.locationY !== null
    && backendEvent.locationY !== undefined;
  const verificationStatus = normalizeReviewStatus(backendEvent);

  const eventId = backendEvent.id || backendEvent.sourceId || `${backendEvent.timestamp}-${backendEvent.alertType || 'event'}`;

  return {
    id: eventId,
    sourceId: eventId,
    type: backendEvent.type || backendEvent.alertType,
    title: formatAlertTitle(backendEvent.title || backendEvent.alertType),
    description: backendEvent.description
      || `Detected via ${source}${backendEvent.injuryClass ? `. Injury Class: ${backendEvent.injuryClass}` : ''}`,
    severity: inferEventSeverity(backendEvent),
    timestamp: backendEvent.timestamp,
    location: backendEvent.location || (hasCoordinates ? `X:${backendEvent.locationX} Y:${backendEvent.locationY}` : null),
    locationX: backendEvent.locationX ?? null,
    locationY: backendEvent.locationY ?? null,
    cameraId: backendEvent.cameraId || backendEvent.source || null,
    confidence: normalizeConfidence(backendEvent.confidenceScore ?? backendEvent.confidence),
    verificationStatus,
    acknowledged: verificationStatus !== 'unverified',
    imageUrl: resolveEventImageUrl(backendEvent.imageUrl, backendUrl),
  };
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(readAuthSession);
  const isAuthenticated = Boolean(currentUser);
  const [currentView, setCurrentView] = useState(readCurrentView);
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [roverTelemetry, setRoverTelemetry] = useState({ battery: null, responseMs: null });
  const [fiveGConnected, setFiveGConnected] = useState(null);
  
  const [theme, setTheme] = useState(readThemePreference);
  // Mobile nav open state
  const [navOpen, setNavOpen] = useState(false);
  // Auto-hide navbar in landscape mode preference
  const [autoHideNav, setAutoHideNav] = useState(() => {
    try {
      const raw = window.localStorage.getItem('sanzi:autoHideNav');
      return raw ? JSON.parse(raw) : false;
    } catch (e) {
      return false;
    }
  });
  const [isLandscape, setIsLandscape] = useState(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: landscape)').matches : false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width:760px)').matches : false);
  
  // 2. Just pass the global connection to state so views can use it
  const [sharedConnection] = useState(globalSignalRConnection);
  
  const notifiedAlertIdsRef = useRef(new Set());
  const browserNotificationRef = useRef(null);


  const handleLogin = async ({ username, password }) => {
    const cleanUsername = username.trim();
    const normalizedUsername = cleanUsername.toLowerCase();
    const isDemoAdmin = normalizedUsername === DEMO_ADMIN_USERNAME.toLowerCase()
      && password === DEMO_ADMIN_PASSWORD;

    let nextUser = null;

    if (isDemoAdmin) {
      nextUser = buildDemoAdminUser(cleanUsername);
    } else {
      // Keep the built-in admin deterministic; a wrong demo-admin password should not
      // trigger a series of backend requests. Real database accounts still use backend auth below.
      if (normalizedUsername === DEMO_ADMIN_USERNAME.toLowerCase()) {
        return { success: false, message: 'Incorrect user or password.' };
      }

      const localAccount = readLocalAdminAccounts().find((item) => (
        typeof item?.username === 'string'
        && item.username.trim().toLowerCase() === normalizedUsername
      ));

      if (localAccount && localAccount.enabled === false) {
        return { success: false, message: 'This account is disabled.' };
      }

      if (localAccount && typeof localAccount.password === 'string' && localAccount.password === password) {
        nextUser = buildLocalAccountUser(localAccount);
        recordLocalAccountLogin(localAccount.id);
      } else {
        // Real database accounts are authenticated by the backend. The old frontend never did this,
        // which is why an account could exist in the database and still be rejected by the login page.
        const backendLogin = await authenticateAgainstBackend(cleanUsername, password);
        if (backendLogin.success) {
          nextUser = backendLogin.user;
        } else if (localAccount && (!localAccount.password || typeof localAccount.password !== 'string')) {
          return {
            success: false,
            message: 'This browser-only account has no saved password. Recreate it once from Admin.',
          };
        } else {
          return { success: false, message: backendLogin.message || 'Incorrect user or password.' };
        }
      }
    }

    if (!getFirstAllowedView(nextUser)) {
      return { success: false, message: 'This account has no page access permissions.' };
    }

    try {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    } catch (error) {
      // The in-memory state still allows access for this tab.
    }

    setCurrentUser(nextUser);
    const storedView = readCurrentView();
    setCurrentView(userCanAccessView(nextUser, storedView) ? storedView : (getFirstAllowedView(nextUser) || 'home-view'));
    window.scrollTo({ top: 0 });
    return { success: true };
  };

  const handleLogout = () => {
    try {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      window.sessionStorage.removeItem(VIEW_STORAGE_KEY);
    } catch (error) {
      // Continue with logout even if storage is unavailable.
    }

    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
    setActiveCriticalAlert(null);
    setFocusedAlertId(null);
    setCurrentView('home-view');
    setCurrentUser(null);
    window.scrollTo({ top: 0 });
  };

  // Persist preference
  useEffect(() => {
    try {
      window.localStorage.setItem('sanzi:autoHideNav', JSON.stringify(autoHideNav));
    } catch (e) {
      // ignore
    }
  }, [autoHideNav]);

  // Update orientation state and auto-hide behavior
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e) => setIsLandscape(!!e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);

    // also handle resize fallback
    const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // track mobile viewport so auto-hide is only offered on phones
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width:760px)');
    const handler = (e) => setIsMobile(!!e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);


  useEffect(() => {
    const handleTelemetry = (payload) => {
      const battery = pickTelemetryNumber(payload, [
        'battery',
        'batteryPercent',
        'batteryPercentage',
        'batteryLevel',
      ]);
      const responseMs = pickTelemetryNumber(payload, [
        'responseMs',
        'responseTimeMs',
        'responseTime',
        'response',
        'latencyMs',
        'latency',
        'pingMs',
        'ping',
      ]);

      const fiveGStatusValue = [
        'fiveGConnected',
        'isFiveGConnected',
        'is5GConnected',
        'is5gConnected',
        'cellularConnected',
        'networkConnected',
        'modemConnected',
      ].map((key) => payload?.[key]).find((value) => value !== undefined && value !== null);

      if (fiveGStatusValue !== undefined) {
        const normalizedStatus = typeof fiveGStatusValue === 'string'
          ? fiveGStatusValue.trim().toLowerCase()
          : fiveGStatusValue;
        if ([true, 1, '1', 'true', 'connected', 'online', 'live'].includes(normalizedStatus)) {
          setFiveGConnected(true);
        } else if ([false, 0, '0', 'false', 'disconnected', 'offline', 'down'].includes(normalizedStatus)) {
          setFiveGConnected(false);
        }
      }

      if (battery === null && responseMs === null) return;

      setRoverTelemetry((current) => ({
        battery: battery === null ? current.battery : Math.max(0, Math.min(100, battery)),
        responseMs: responseMs === null ? current.responseMs : Math.max(0, responseMs),
      }));
    };

    globalSignalRConnection.on('ReceiveTelemetry', handleTelemetry);
    return () => globalSignalRConnection.off('ReceiveTelemetry', handleTelemetry);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    document.body.classList.toggle('coquette-theme', theme === 'pink');
    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Keep the in-memory theme if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, currentView);
    } catch (error) {
      // The current tab still keeps the selected view in memory.
    }
  }, [currentView, isAuthenticated]);

  const canAccessView = useCallback((viewId) => userCanAccessView(currentUser, viewId), [currentUser]);

  const changeView = useCallback((viewId) => {
    if (!canAccessView(viewId)) return;

    if (viewId === 'past-alerts-view') {
      browserNotificationRef.current?.close();
      browserNotificationRef.current = null;
      setFocusedAlertId(null);
    }

    setCurrentView(viewId);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [canAccessView]);

  const openAlertInPastAlerts = useCallback((alertId) => {
    if (!alertId || !canAccessView('past-alerts-view')) return;
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
    setFocusedAlertId(alertId);
    setCurrentView('past-alerts-view');
  }, [canAccessView]);

  useEffect(() => {
    if (!currentUser || canAccessView(currentView)) return;
    const fallbackView = getFirstAllowedView(currentUser);
    if (fallbackView) setCurrentView(fallbackView);
  }, [canAccessView, currentUser, currentView]);

  useEffect(() => {
    const matchesCurrentUser = (payload) => {
      if (!payload || !currentUser) return false;
      const payloadAccountId = payload.accountId || payload.userId || payload.id;
      const payloadUsername = payload.username || payload.userName;
      return (payloadAccountId && payloadAccountId === currentUser.id)
        || (payloadUsername && String(payloadUsername).toLowerCase() === currentUser.username.toLowerCase());
    };

    const handlePermissionsUpdated = (payload) => {
      if (!matchesCurrentUser(payload) || !Array.isArray(payload.permissions)) return;
      setCurrentUser((existing) => {
        if (!existing) return existing;
        const updated = { ...existing, permissions: payload.permissions };
        try {
          window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          // Keep the live session usable when storage is unavailable.
        }
        return updated;
      });
    };

    const handleSessionRevoked = (payload) => {
      if (!matchesCurrentUser(payload)) return;
      try {
        window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
        window.sessionStorage.removeItem(VIEW_STORAGE_KEY);
      } catch (error) {
        // In-memory logout still applies.
      }
      setCurrentUser(null);
      setCurrentView('home-view');
    };

    globalSignalRConnection.on('PermissionsUpdated', handlePermissionsUpdated);
    globalSignalRConnection.on('SessionRevoked', handleSessionRevoked);

    return () => {
      globalSignalRConnection.off('PermissionsUpdated', handlePermissionsUpdated);
      globalSignalRConnection.off('SessionRevoked', handleSessionRevoked);
    };
  }, [currentUser]);

  const notifyCriticalAlert = useCallback((alert) => {
    if (!alert || alert.severity !== 'critical') return;
    if (notifiedAlertIdsRef.current.has(alert.id)) return;
    
    notifiedAlertIdsRef.current.add(alert.id);
    setActiveCriticalAlert(alert);

    if (document.visibilityState === 'visible') {
      playCriticalAlertSound();
      return;
    }

    if (!('Notification' in window) || Notification.permission !== 'granted' || !markCriticalAlertAsNotified(alert.id)) {
      return;
    }

    playCriticalAlertSound();

    const notification = new Notification('Critical alert', {
      body: alert.title,
      tag: `sanzi-critical-alert-${alert.id}`,
      renotify: false,
      requireInteraction: true,
      silent: true,
    });

    browserNotificationRef.current = notification;

    notification.onclick = () => {
      window.focus();
      openAlertInPastAlerts(alert.id);
      notification.close();
    };

    notification.onclose = () => {
      if (browserNotificationRef.current === notification) {
        browserNotificationRef.current = null;
      }
    };
  }, [openAlertInPastAlerts]);



  useEffect(() => {
    return () => browserNotificationRef.current?.close();
  }, []);

  useEffect(() => {
    const fetchInitialEvents = async () => {
      try {
        const response = await fetch(`${backendUrl}/events`);
        if (response.ok) {
          const data = await response.json();
          const mappedEvents = sortEventsNewestFirst(data.map(mapBackendEvent));
          setAllEvents(mappedEvents);
          setLiveEvents(mappedEvents.slice(0, 12));
        }
      } catch (error) {
        console.error("Eroare la preluarea evenimentelor inițiale:", error);
      }
    };
    fetchInitialEvents();

    // 3. Just hook up the listener here
    const handleNewAlert = (newEvent) => {
      const mappedEvent = mapBackendEvent(newEvent);
      
      setAllEvents((currentEvents) => {
        if (currentEvents.some((event) => event.id === mappedEvent.id)) return currentEvents;
        return sortEventsNewestFirst([mappedEvent, ...currentEvents]);
      });

      setLiveEvents((currentEvents) => {
        if (currentEvents.some((event) => event.id === mappedEvent.id)) return currentEvents;
        return sortEventsNewestFirst([mappedEvent, ...currentEvents]).slice(0, 12);
      });

      notifyCriticalAlert(mappedEvent);
    };

    globalSignalRConnection.on("ReceiveAlert", handleNewAlert);

    return () => {
      // 4. IMPORTANT: Only remove the listener on cleanup. Do NOT call connection.stop()
      globalSignalRConnection.off("ReceiveAlert", handleNewAlert);
    };
  }, [notifyCriticalAlert]);

  const updateEventStatus = async (eventId, verificationStatus) => {
    if (!hasPermission(currentUser, PERMISSIONS.RESPOND_TO_ALERTS)) return;

    try {
      await fetch(`${backendUrl}/events/${eventId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: verificationStatus })
      });

      const applyStatus = (events) => events.map((event) => (
        event.id === eventId
          ? {
              ...event,
              verificationStatus,
              acknowledged: verificationStatus !== 'unverified',
            }
          : event
      ));

      setAllEvents(applyStatus);
      setLiveEvents(applyStatus);
    } catch (error) {
      console.error("Eroare la salvarea statusului:", error);
    }
  };

  const closeCriticalAlert = () => {
    setActiveCriticalAlert(null);
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
  };

  const cycleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const currentIndex = THEME_ORDER.indexOf(currentTheme);
      return THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
    });
  }, []);

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} theme={theme} onCycleTheme={cycleTheme} />;
  }

  return (
    <div className="app-shell">
      {/* compute whether we should hide the navbar when in landscape */}
      {(() => {})()}
      <nav className={`navbar ${navOpen ? 'nav-open' : ''} ${(autoHideNav && isLandscape && !navOpen) ? 'nav-hidden' : ''}`} aria-label="Primary navigation">
        <button
          type="button"
          className="nav-brand"
          onClick={() => changeView(getFirstAllowedView(currentUser) || 'home-view')}
          aria-label="Open first available Sânzi view"
        >
          <img className="nav-brand__logo" src="/nokia-logo.png" alt="Nokia" />
        </button>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          ☰
        </button>

        <div className="nav-links">
          {hasPermission(currentUser, PERMISSIONS.VIEW_OVERVIEW) && (
            <a
              href="#home"
              className={`nav-item ${currentView === 'home-view' ? 'active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                changeView('home-view');
              }}
            >
              Home
            </a>
          )}

          {hasPermission(currentUser, PERMISSIONS.VIEW_CAMERAS) && (
            <a
              href="#cameras"
              className={`nav-item ${currentView === 'cameras-view' ? 'active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                changeView('cameras-view');
              }}
            >
              Cameras
            </a>
          )}

          {hasPermission(currentUser, PERMISSIONS.VIEW_PAST_ALERTS) && (
            <a
              href="#past-alerts"
              className={`nav-item ${currentView === 'past-alerts-view' ? 'active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                changeView('past-alerts-view');
              }}
            >
              Past alerts
            </a>
          )}

          {hasPermission(currentUser, PERMISSIONS.ACCESS_ADMIN) && (
            <a
              href="#admin"
              className={`nav-item nav-item--admin ${currentView === 'admin-view' ? 'active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                changeView('admin-view');
              }}
            >
              Admin
            </a>
          )}
        </div>

        <div className="nav-actions">
          <ThemeToggle theme={theme} onCycle={cycleTheme} />

          {/* Auto-hide toggle - only show on mobile */}
          {isMobile && (
            <button
              type="button"
              className={`visible-btn visible-btn--autohide ${autoHideNav ? 'active' : ''}`}
              onClick={() => setAutoHideNav((v) => !v)}
              title="Auto-hide navbar in landscape"
            >
              {autoHideNav ? 'Auto-hide ✓' : 'Auto-hide'}
            </button>
          )}

          <button
            id="logout-btn"
            type="button"
            className="visible-btn visible-btn--logout"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Reveal button shown when navbar is auto-hidden in landscape */}
      {isMobile && autoHideNav && isLandscape && !navOpen && (
        <button
          type="button"
          className="nav-reveal"
          aria-label="Show navigation"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
      )}

      <div className="app-content">
        {currentView === 'home-view' && (
          <HomeView
            activeCriticalAlert={activeCriticalAlert}
            closeAlert={closeCriticalAlert}
            onAlertClick={() => openAlertInPastAlerts(activeCriticalAlert?.id)}
            onOpenPastAlert={openAlertInPastAlerts}
            onExploreRover={hasPermission(currentUser, PERMISSIONS.VIEW_CAMERAS) ? () => changeView('cameras-view') : null}
            liveEvents={liveEvents}
            allEvents={allEvents}
            batteryLevel={roverTelemetry.battery}
            responseTimeMs={roverTelemetry.responseMs}
            fiveGConnected={fiveGConnected}
            onUpdateEventStatus={updateEventStatus}
            canRespondToAlerts={hasPermission(currentUser, PERMISSIONS.RESPOND_TO_ALERTS)}
            connection={sharedConnection}
            isCoquetteMode={theme === 'pink'}
          />
        )}

        {currentView === 'cameras-view' && (
          <CamerasView
            connection={sharedConnection}
            canManualControl={hasPermission(currentUser, PERMISSIONS.MANUAL_ROVER_CONTROL)}
            canChangeMode={hasPermission(currentUser, PERMISSIONS.CHANGE_OPERATING_MODE)}
            canMotorPower={hasPermission(currentUser, PERMISSIONS.MOTOR_POWER_CONTROLS)}
          />
        )}

        {currentView === 'past-alerts-view' && (
          <PastAlertsView
            liveEvents={liveEvents}
            archiveEvents={allEvents}
            focusedAlertId={focusedAlertId}
            connection={sharedConnection}
          />
        )}

        {currentView === 'admin-view' && (
          <AdminView currentUser={currentUser} />
        )}
      </div>
    </div>
  );
}