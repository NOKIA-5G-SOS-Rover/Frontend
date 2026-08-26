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
import { ALL_PERMISSIONS, PERMISSIONS, getFirstAllowedView, hasPermission } from './auth/permissions';
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
const BACKEND_PERMISSIONS = {
  ViewDashboard: PERMISSIONS.VIEW_OVERVIEW,
  ViewCamera: PERMISSIONS.VIEW_CAMERAS,
  ViewEvents: PERMISSIONS.VIEW_PAST_ALERTS,
  UpdateEvents: PERMISSIONS.RESPOND_TO_ALERTS,
  ControlRover: PERMISSIONS.MANUAL_ROVER_CONTROL,
  EmergencyStop: PERMISSIONS.MOTOR_POWER_CONTROLS,
};

const toFrontendPermissions = (permissions = []) => permissions
  .map((permission) => BACKEND_PERMISSIONS[permission] || permission)
  .filter((permission) => ALL_PERMISSIONS.includes(permission));

const authHeaders = (session) => (session?.sessionId
  ? { 'X-Session-Id': session.sessionId }
  : {});

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
  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [roverTelemetry, setRoverTelemetry] = useState({ battery: null, responseMs: null });
  const [fiveGConnected, setFiveGConnected] = useState(null);
  
  // New state to control dark mode toggle
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCoquetteMode, setIsCoquetteMode] = useState(false);
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
    try {
      const response = await fetch(`${backendUrl}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.sessionId || !payload.user) {
        return {
          success: false,
          message: payload.message || 'Incorrect user or password.',
        };
      }

      const nextUser = {
        ...payload.user,
        permissions: payload.user.role === 'Admin'
          ? [...ALL_PERMISSIONS]
          : toFrontendPermissions(payload.user.permissions),
        sessionId: payload.sessionId,
        expiresAt: payload.expiresAt,
      };

      window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
      setCurrentUser(nextUser);
      setCurrentView(getFirstAllowedView(nextUser) || 'home-view');
      window.scrollTo({ top: 0 });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: 'The authentication service is unavailable.',
      };
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${backendUrl}/api/Auth/logout`, {
        method: 'POST',
        headers: authHeaders(currentUser),
      });
    } catch (error) {
      // Clear the local session even when the backend is unavailable.
    }
    try {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      // Continue with logout even if storage is unavailable.
    }

    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
    setActiveCriticalAlert(null);
    setFocusedAlertId(null);
    setCurrentView('home-view');
    setCurrentUser(null);
    setIsCoquetteMode(false);
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

  // Add this effect to apply the theme to the entire HTML document
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  useEffect(() => {
    document.body.classList.toggle('coquette-theme', isCoquetteMode);
    return () => document.body.classList.remove('coquette-theme');
  }, [isCoquetteMode]);

  const canAccessView = useCallback((viewId) => {
    if (!currentUser) return false;
    if (viewId === 'home-view') return hasPermission(currentUser, PERMISSIONS.VIEW_OVERVIEW);
    if (viewId === 'cameras-view') return hasPermission(currentUser, PERMISSIONS.VIEW_CAMERAS);
    if (viewId === 'past-alerts-view') return hasPermission(currentUser, PERMISSIONS.VIEW_PAST_ALERTS);
    if (viewId === 'admin-view') return hasPermission(currentUser, PERMISSIONS.ACCESS_ADMIN);
    return false;
  }, [currentUser]);

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
        headers: { 'Content-Type': 'application/json', ...authHeaders(currentUser) },
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

  const toggleCoquetteMode = () => {
    setIsCoquetteMode((current) => {
      const next = !current;
      if (next) setIsDarkMode(false);
      return next;
    });
  };

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
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
          <button
            type="button"
            className={`theme-toggle ${isDarkMode ? 'is-active' : ''}`}
            onClick={() => {
              setIsCoquetteMode(false);
              setIsDarkMode((current) => !current);
            }}
            aria-label={isDarkMode ? 'Disable dark mode' : 'Enable dark mode'}
            aria-pressed={isDarkMode}
            title={isDarkMode ? 'Dark mode on' : 'Dark mode off'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8a8.5 8.5 0 1 0 11.6 11.6Z" />
            </svg>
          </button>

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
            isCoquetteMode={isCoquetteMode}
            onToggleCoquetteMode={toggleCoquetteMode}
          />
        )}

        {currentView === 'cameras-view' && (
          <CamerasView
            connection={sharedConnection}
            sessionId={currentUser.sessionId}
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