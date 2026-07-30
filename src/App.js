import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import './App.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/navigation.css';
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

const NOTIFIED_CRITICAL_ALERTS_KEY = 'sanzi-notified-critical-alert-ids';
const MAX_STORED_ALERT_IDS = 100;
const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// 1. CREATE THE CONNECTION OUTSIDE THE COMPONENT (True Singleton)
const globalSignalRConnection = new HubConnectionBuilder()
  .withUrl(`${backendUrl}/dashboardHub`)
  .withAutomaticReconnect()
  .build();

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

const navigationItems = [
  { id: 'home-view', label: 'Overview' },
  { id: 'cameras-view', label: 'Cameras' },
  { id: 'past-alerts-view', label: 'Past alerts' },
];

export default function App() {
  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]); 
  
  // New state to control dark mode toggle
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 2. Just pass the global connection to state so views can use it
  const [sharedConnection] = useState(globalSignalRConnection);
  
  // Define the missing archiveReferenceDate 
  const archiveReferenceDate = new Date('2026-07-29');

  const notifiedAlertIdsRef = useRef(new Set());
  const browserNotificationRef = useRef(null);

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

  const mapBackendEvent = (backendEvent) => ({
    id: backendEvent.id,
    title: backendEvent.alertType || 'System Alert',
    description: `Detected via ${backendEvent.source}. Injury Class: ${backendEvent.injuryClass || 'N/A'}`,
    severity: backendEvent.status === 'critical' ? 'critical' : 'warning',
    timestamp: backendEvent.timestamp,
    location: `X:${backendEvent.locationX} Y:${backendEvent.locationY}`,
    cameraId: backendEvent.cameraId,
    confidence: backendEvent.confidenceScore,
    verificationStatus: backendEvent.status || 'unverified',
    imageUrl: backendEvent.imageUrl ? `${backendUrl}${backendEvent.imageUrl}` : null
  });

  useEffect(() => {
    return () => browserNotificationRef.current?.close();
  }, []);

  useEffect(() => {
    const fetchInitialEvents = async () => {
      try {
        const response = await fetch(`${backendUrl}/events`);
        if (response.ok) {
          const data = await response.json();
          setLiveEvents(data.map(mapBackendEvent).slice(0, 12));
        }
      } catch (error) {
        console.error("Eroare la preluarea evenimentelor inițiale:", error);
      }
    };
    fetchInitialEvents();

    // 3. Just hook up the listener here
    const handleNewAlert = (newEvent) => {
      const mappedEvent = mapBackendEvent(newEvent);
      
      setLiveEvents((currentEvents) => {
        if (currentEvents.some(e => e.id === mappedEvent.id)) return currentEvents;
        return [mappedEvent, ...currentEvents].slice(0, 50); 
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

      setLiveEvents((currentEvents) => currentEvents.map((event) => (
        event.id === eventId
          ? {
              ...event,
              verificationStatus,
              acknowledged: verificationStatus !== 'unverified',
            }
          : event
      )));
    } catch (error) {
      console.error("Eroare la salvarea statusului:", error);
    }
  };

  const closeCriticalAlert = () => {
    setActiveCriticalAlert(null);
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
  };

  const simulateSOS = async () => {
    try {
      await fetch(`${backendUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roverId: "ROVER-SIM",
          sessionId: "Session-X",
          alertType: "SOS Signal sent",
          source: "Manual simulation",
          detectedAt: new Date().toISOString(),
          locationX: 45.7,
          locationY: 21.2,
          boundingBoxWidth: 10,
          boundingBoxHeight: 10,
          confidenceScore: 0.99,
          motorHaltRequested: true,
          injuryClass: "none",
          cameraId: "sim-cam",
          status: "critical"
        })
      });

      setCurrentView('home-view');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }
    } catch (error) {
      console.error("Error simulating SOS:", error);
    }
  };
  
  return (
    <div className="app-shell">
      <nav className="navbar" aria-label="Primary navigation">
        <button
          type="button"
          className="nav-brand"
          onClick={() => changeView('home-view')}
          aria-label="Open Sânzi overview"
        >
          <img className="nav-brand__logo" src="/nokia-logo.png" alt="Nokia" />
        </button>

        <div className="nav-links">
          <a
            href="#"
            className={`nav-item ${currentView === 'home-view' ? 'active' : ''}`}
            style={{ textTransform: 'uppercase' }}
            onClick={(event) => {
              event.preventDefault();
              setCurrentView('home-view');
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
            style={{ marginRight: '16px' }}
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <span className="network-badge" aria-label="5G network connected">
            <span className="network-badge__dot" aria-hidden="true" />
            5G connected
          </span>
          <button
            id="simulate-sos-btn"
            className="visible-btn"
            onClick={simulateSOS}
          >
            <span className="visible-btn__pulse" aria-hidden="true" />
            Simulate SOS
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
            onUpdateEventStatus={updateEventStatus}
            archiveReferenceDate={archiveReferenceDate}
            connection={sharedConnection}
          />
        )}

        {currentView === 'cameras-view' && (
          <CamerasView connection={sharedConnection} />
        )}

        {currentView === 'past-alerts-view' && (
          <PastAlertsView
            liveEvents={liveEvents}
            focusedAlertId={focusedAlertId}
            archiveReferenceDate={archiveReferenceDate}
            connection={sharedConnection}
          />
        )}
      </div>
    </div>
  );
}