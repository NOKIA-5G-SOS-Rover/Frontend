import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';


const RoverContext = createContext(null);

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const CONTROL_HEARTBEAT_MS = 150; // re-send control state periodically while in manual mode

export function RoverProvider({ url, children }) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | open | closed | error
  const [battery, setBattery] = useState(null);
  const [cameraFrames, setCameraFrames] = useState({}); // { cam1: {url,status}, cam2: {url,status} }
  const [events, setEvents] = useState([]);
  const [pastAlerts, setPastAlerts] = useState([]);
  const [mode, setModeState] = useState('auto');
  const [alertImages, setAlertImages] = useState({}); // { [alertId]: url }

  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const modeRef = useRef(mode);
  const lastControlRef = useRef({ up: false, down: false, left: false, right: false, speed: 0 });
  const controlIntervalRef = useRef(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setConnectionStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionStatus('open');
        // Re-sync mode with the server as soon as we (re)connect
        send({ type: 'mode', value: modeRef.current });
        send({ type: 'request_past_alerts' });
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'battery':
            setBattery(msg.value);
            break;

          case 'camera_frame':
            setCameraFrames((current) => ({
              ...current,
              [msg.cameraId]: { url: msg.url, status: msg.status || 'ok' },
            }));
            break;

          case 'event':
            setEvents((current) => {
              if (current.some((e) => e.id === msg.event.id)) return current;
              return [msg.event, ...current];
            });
            break;

          case 'alert_image':
            setAlertImages((current) => ({ ...current, [msg.id]: msg.url }));
            break;

          case 'mode_ack':
            setModeState(msg.value);
            break;

          case 'past_alerts':
            setPastAlerts(Array.isArray(msg.alerts) ? msg.alerts : []);
            break;

          case 'past_alert':
            setPastAlerts((current) => {
              if (current.some((a) => a.id === msg.alert.id)) return current;
              return [msg.alert, ...current];
            });
            break;

          default:
            break;
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        setConnectionStatus('closed');
        const delay = Math.min(
          RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttemptRef.current,
          RECONNECT_MAX_DELAY_MS
        );
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimerRef.current);
      window.clearInterval(controlIntervalRef.current);
      wsRef.current?.close();
    };
  }, [url, send]);

  const setMode = useCallback((value) => {
    setModeState(value);
    send({ type: 'mode', value });
  }, [send]);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'auto' ? 'manual' : 'auto';
      send({ type: 'mode', value: next });
      return next;
    });
  }, [send]);

  // Called by CamerasView whenever directions/speed change. Also kept alive
  // via a heartbeat so a dropped packet doesn't leave the rover mid-command.
  const sendControl = useCallback((control) => {
    lastControlRef.current = control;
    send({ type: 'control', ...control });

    window.clearInterval(controlIntervalRef.current);
    if (control.up || control.down || control.left || control.right) {
      controlIntervalRef.current = window.setInterval(() => {
        send({ type: 'control', ...lastControlRef.current });
      }, CONTROL_HEARTBEAT_MS);
    }
  }, [send]);

  const requestAlertImage = useCallback((id) => {
    if (!id) return;
    setAlertImages((current) => {
      if (current[id]) return current; // already have it, don't re-request
      send({ type: 'request_alert_image', id });
      return current;
    });
  }, [send]);

  const setVerificationStatus = useCallback((id, status) => {
    setEvents((current) => current.map((e) => (
      e.id === id ? { ...e, verificationStatus: status } : e
    )));
    send({ type: 'verification_status', id, status });
  }, [send]);

  const requestPastAlerts = useCallback(() => {
    send({ type: 'request_past_alerts' });
  }, [send]);

  const value = {
    connectionStatus,
    battery,
    cameraFrames,
    events,
    pastAlerts,
    requestPastAlerts,
    mode,
    setMode,
    toggleMode,
    sendControl,
    alertImages,
    requestAlertImage,
    setVerificationStatus,
  };

  return <RoverContext.Provider value={value}>{children}</RoverContext.Provider>;
}

export function useRover() {
  const ctx = useContext(RoverContext);
  if (!ctx) throw new Error('useRover must be used within a <RoverProvider>');
  return ctx;
}