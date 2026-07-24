import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import './fullscreen-viewer.css';
import './fullscreen-zoom-styles.css';
import HomeView from './components/HomeView';
import CamerasView from './components/CamerasView';
import PastAlertsView from './components/PastAlertsView';
import { createSOSEvent } from './data/mockEvents';
import { RoverProvider, useRover } from './components/RoverContext';

// TODO: point this at your real rover WebSocket endpoint
const ROVER_WS_URL = 'wss://your-rover-server/ws';

const NOTIFIED_CRITICAL_ALERTS_KEY = 'sanzi-notified-critical-alert-ids';
const MAX_STORED_ALERT_IDS = 100;

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
    // The in-memory React ref still prevents duplicates in this tab.
  }

  return true;
};

function AppContent() {
  const rover = useRover();

  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);

  const notifiedAlertIdsRef = useRef(new Set());
  const browserNotificationRef = useRef(null);
  const previousEventIdsRef = useRef(new Set());

  const openAlertInPastAlerts = useCallback((alertId) => {
    if (!alertId) return;

    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;

    setFocusedAlertId(alertId);
    setCurrentView('past-alerts-view');
  }, []);

  const notifyCriticalAlert = useCallback((alert) => {
    // Only critical alarms are allowed to trigger the popup, sound or
    // browser/Windows notification.
    if (!alert || alert.severity !== 'critical') return;

    // The same alarm ID can never notify twice.
    if (notifiedAlertIdsRef.current.has(alert.id)) return;
    notifiedAlertIdsRef.current.add(alert.id);

    setActiveCriticalAlert(alert);

    // While the application is visible, use only the in-app popup and sound.
    if (document.visibilityState === 'visible') {
      playCriticalAlertSound();
      return;
    }

    // While the application is hidden, send exactly one system notification
    // for each distinct critical event.
    if (
      !('Notification' in window)
      || Notification.permission !== 'granted'
      || !markCriticalAlertAsNotified(alert.id)
    ) {
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

    // Closing this notification does not remove the event ID from storage,
    // so the same critical event cannot notify again.
    notification.onclose = () => {
      if (browserNotificationRef.current === notification) {
        browserNotificationRef.current = null;
      }
    };
  }, [openAlertInPastAlerts]);

  useEffect(() => () => {
    browserNotificationRef.current?.close();
  }, []);

  // Watch the rover's live event stream for newly-arrived events and fire
  // the same popup/sound/notification pipeline that used to run off the
  // local mock-event interval.
  useEffect(() => {
    const previousIds = previousEventIdsRef.current;
    const newlyArrived = rover.events.filter((event) => !previousIds.has(event.id));

    newlyArrived.forEach((event) => notifyCriticalAlert(event));

    previousEventIdsRef.current = new Set(rover.events.map((event) => event.id));
  }, [rover.events, notifyCriticalAlert]);

  const updateEventStatus = (eventId, verificationStatus) => {
    rover.setVerificationStatus(eventId, verificationStatus);
  };

  const closeCriticalAlert = () => {
    setActiveCriticalAlert(null);
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
  };

  // NOTE: this button is a local-only demo trigger — it pops the in-app
  // critical alert UI/sound but does NOT add anything to the live feed or
  // past alerts, since that data now comes exclusively from the rover.
  // If you want "Simulate SOS" to actually exercise the rover, replace this
  // with something like rover.sendControl(...) or a dedicated socket message.
  const simulateSOS = () => {
    const sosEvent = createSOSEvent();

    setCurrentView('home-view');
    setActiveCriticalAlert(sosEvent);
    playCriticalAlertSound();

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  };

  const liveEventsForHome = rover.events.map((event) => ({
    ...event,
    acknowledged: event.verificationStatus !== 'unverified',
  }));

  return (
    <div>
      <nav className="navbar">
        <div className="nav-links">
          <a
            href="#"
            className={`nav-item ${currentView === 'home-view' ? 'active' : ''}`}
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

        <button
          id="simulate-sos-btn"
          className="visible-btn"
          onClick={simulateSOS}
        >
          Simulate SOS
        </button>
      </nav>

      {currentView === 'home-view' && (
        <HomeView
          activeCriticalAlert={activeCriticalAlert}
          closeAlert={closeCriticalAlert}
          onAlertClick={() => openAlertInPastAlerts(activeCriticalAlert?.id)}
          liveEvents={liveEventsForHome}
          onUpdateEventStatus={updateEventStatus}
        />
      )}

      {currentView === 'cameras-view' && <CamerasView />}

      {currentView === 'past-alerts-view' && (
        <PastAlertsView focusedAlertId={focusedAlertId} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <RoverProvider url={ROVER_WS_URL}>
      <AppContent />
    </RoverProvider>
  );
}