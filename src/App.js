import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import './fullscreen-viewer.css';
import './fullscreen-zoom-styles.css';
import HomeView from './components/HomeView';
import CamerasView from './components/CamerasView';
import PastAlertsView from './components/PastAlertsView';
import { createMockEvent, createSOSEvent, initialMockEvents } from './data/mockEvents';

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

export default function App() {
  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState(initialMockEvents);

  const notifiedAlertIdsRef = useRef(new Set());
  const browserNotificationRef = useRef(null);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const newEvent = createMockEvent();

      setLiveEvents((currentEvents) => [
        newEvent,
        ...currentEvents,
      ].slice(0, 12));

      notifyCriticalAlert(newEvent);
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [notifyCriticalAlert]);

  const updateEventStatus = (eventId, verificationStatus) => {
    setLiveEvents((currentEvents) => currentEvents.map((event) => (
      event.id === eventId
        ? {
            ...event,
            verificationStatus,
            acknowledged: verificationStatus !== 'unverified',
          }
        : event
    )));
  };

  const closeCriticalAlert = () => {
    setActiveCriticalAlert(null);
    browserNotificationRef.current?.close();
    browserNotificationRef.current = null;
  };

  const simulateSOS = () => {
    const sosEvent = createSOSEvent();

    setCurrentView('home-view');
    setLiveEvents((currentEvents) => [
      sosEvent,
      ...currentEvents,
    ].slice(0, 12));

    notifyCriticalAlert(sosEvent);

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  };

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
          liveEvents={liveEvents}
          onUpdateEventStatus={updateEventStatus}
        />
      )}

      {currentView === 'cameras-view' && <CamerasView />}

      {currentView === 'past-alerts-view' && (
        <PastAlertsView
          liveEvents={liveEvents}
          focusedAlertId={focusedAlertId}
        />
      )}
    </div>
  );
}
