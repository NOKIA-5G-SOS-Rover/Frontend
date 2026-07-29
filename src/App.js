import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const navigationItems = [
  { id: 'home-view', label: 'Overview' },
  { id: 'cameras-view', label: 'Cameras' },
  { id: 'past-alerts-view', label: 'Past alerts' },
];

export default function App() {
  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState(initialMockEvents);
  const [archiveReferenceDate, setArchiveReferenceDate] = useState(() => new Date());

  const notifiedAlertIdsRef = useRef(new Set());
  const browserNotificationRef = useRef(null);

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
    let rolloverTimeoutId;

    const scheduleArchiveRollover = () => {
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 1, 0);

      rolloverTimeoutId = window.setTimeout(() => {
        setArchiveReferenceDate(new Date());
        scheduleArchiveRollover();
      }, nextDay.getTime() - now.getTime());
    };

    scheduleArchiveRollover();
    return () => window.clearTimeout(rolloverTimeoutId);
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
          {navigationItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => changeView(item.id)}
              aria-current={currentView === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="nav-actions">
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
          />
        )}

        {currentView === 'cameras-view' && <CamerasView />}

        {currentView === 'past-alerts-view' && (
          <PastAlertsView
            liveEvents={liveEvents}
            focusedAlertId={focusedAlertId}
            archiveReferenceDate={archiveReferenceDate}
          />
        )}
      </div>
    </div>
  );
}
