import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import './App.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/navigation.css';
import './styles/login.css';
import './styles/home.css';
import './styles/cameras.css';
import './styles/events.css';
import './styles/alerts.css';
import './styles/responsive.css';
import './fullscreen-viewer.css';
import './fullscreen-zoom-styles.css';
import HomeView from './components/HomeView';
import CamerasView from './components/CamerasView';
import PastAlertsView from './components/PastAlertsView';
import LoginView from './components/LoginView';
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
const DEMO_USERNAME = process.env.REACT_APP_DEMO_USERNAME || 'operator';
const DEMO_PASSWORD = process.env.REACT_APP_DEMO_PASSWORD || 'sanzi2026';

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
    return window.sessionStorage.getItem(AUTH_STORAGE_KEY) === 'authenticated';
  } catch (error) {
    return false;
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
  const [isAuthenticated, setIsAuthenticated] = useState(readAuthSession);
  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [roverTelemetry, setRoverTelemetry] = useState({ battery: null, responseMs: null });
  
  // New state to control dark mode toggle
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Mobile nav open state
  const [navOpen, setNavOpen] = useState(false);
  
  // 2. Just pass the global connection to state so views can use it
  const [sharedConnection] = useState(globalSignalRConnection);
  
  const notifiedAlertIdsRef = useRef(new Set());
  const browserNotificationRef = useRef(null);


  const handleLogin = async ({ username, password }) => {
    const validUsername = username.trim().toLowerCase() === DEMO_USERNAME.toLowerCase();
    const validPassword = password === DEMO_PASSWORD;

    if (!validUsername || !validPassword) {
      return {
        success: false,
        message: 'Incorrect user or password.',
      };
    }

    try {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, 'authenticated');
    } catch (error) {
      // The in-memory state still allows access for this tab.
    }

    setIsAuthenticated(true);
    setCurrentView('home-view');
    window.scrollTo({ top: 0 });
    return { success: true };
  };

  const handleLogout = () => {
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
    setIsAuthenticated(false);
    window.scrollTo({ top: 0 });
  };


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

  const changeView = useCallback((viewId) => {
    if (viewId === 'past-alerts-view') {
      browserNotificationRef.current?.close();
      browserNotificationRef.current = null;
      setFocusedAlertId(null);
    }

    setCurrentView(viewId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openAlertInPastAlerts = useCallback((alertId) => {
    if (!alertId) return;
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
    setFocusedAlertId(alertId);
    setCurrentView('past-alerts-view');
  }, []);

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

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <nav className={`navbar ${navOpen ? 'nav-open' : ''}`} aria-label="Primary navigation">
        <button
          type="button"
          className="nav-brand"
          onClick={() => changeView('home-view')}
          aria-label="Open Sânzi overview"
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
          <a
            href="#"
            className={`nav-item ${currentView === 'home-view' ? 'active' : ''}`}
            style={{ textTransform: 'uppercase' }}
            onClick={(event) => {
              event.preventDefault();
                setCurrentView('home-view');
                setNavOpen(false);
            }}
          >
            home
          </a>

          <div className="nav-divider"></div>

          <a
            href="#"
            className={`nav-item ${currentView === 'cameras-view' ? 'active' : ''}`}
            style={{ textTransform: 'uppercase' }}
            onClick={(event) => {
              event.preventDefault();
                setCurrentView('cameras-view');
                setNavOpen(false);
            }}
          >
            cameras
          </a>

          <div className="nav-divider"></div>

          <a
            href="#"
            className={`nav-item ${currentView === 'past-alerts-view' ? 'active' : ''}`}
            style={{ textTransform: 'uppercase' }}
            onClick={(event) => {
              event.preventDefault();
              browserNotificationRef.current?.close();
              browserNotificationRef.current = null;
              setFocusedAlertId(null);
                setCurrentView('past-alerts-view');
                setNavOpen(false);
            }}
          >
            past alerts
          </a>
        </div>

        <div className="nav-actions">
          {/* Dark Mode Toggle Button */}
          <button 
            type="button" 
            className="visible-btn"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <span className="network-badge" aria-label="5G network connected">
            <span className="network-badge__dot" aria-hidden="true" />
            5G connected
          </span>
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

      <div className="app-content">
        {currentView === 'home-view' && (
          <HomeView
            activeCriticalAlert={activeCriticalAlert}
            closeAlert={closeCriticalAlert}
            onAlertClick={() => openAlertInPastAlerts(activeCriticalAlert?.id)}
            onOpenPastAlert={openAlertInPastAlerts}
            onExploreRover={() => changeView('cameras-view')}
            liveEvents={liveEvents}
            allEvents={allEvents}
            batteryLevel={roverTelemetry.battery}
            responseTimeMs={roverTelemetry.responseMs}
            onUpdateEventStatus={updateEventStatus}
            connection={sharedConnection}
          />
        )}

        {currentView === 'cameras-view' && (
          <CamerasView connection={sharedConnection} />
        )}

        {currentView === 'past-alerts-view' && (
          <PastAlertsView
            liveEvents={liveEvents}
            archiveEvents={allEvents}
            focusedAlertId={focusedAlertId}
            connection={sharedConnection}
          />
        )}
      </div>
    </div>
  );
}