import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
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
    // Silent fail
  }
  return true;
};

function AppContent() {
  const rover = useRover();

  const [currentView, setCurrentView] = useState('home-view');
  const [activeCriticalAlert, setActiveCriticalAlert] = useState(null);
  const [focusedAlertId, setFocusedAlertId] = useState(null);
  const [liveEvents, setLiveEvents] = useState(initialMockEvents);

  const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
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
    // Cleanup notifications
    return () => browserNotificationRef.current?.close();
  }, []);

  // Watch the rover's live event stream for newly-arrived events and fire
  // the same popup/sound/notification pipeline that used to run off the
  // local mock-event interval.
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
