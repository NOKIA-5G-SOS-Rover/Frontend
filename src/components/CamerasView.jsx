import React, { useEffect, useState, useRef, useCallback } from 'react';
import { HubConnectionState } from '@microsoft/signalr';

const cameraKeyHandler = (event, callback) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback(event);
  }
};
const DEFAULT_SPEED = 50;
const AUTO_SPEED_PUSH_INTERVAL_MS = 500; // how often we re-push speed while in auto mode
const CAMERA_STATUS_POLL_INTERVAL_MS = 5000;

// --- Backend wiring -------------------------------------------------------
const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

console.log('[CamerasView] Backend URL for camera streams:', BACKEND_URL);

if (!process.env.REACT_APP_API_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    `[CamerasView] REACT_APP_API_URL is not set at build time. Falling back to ${BACKEND_URL}. ` +
    `If this is wrong, rebuild with REACT_APP_API_URL set correctly.`
  );
}

// TODO CONFIRM: this must exactly match the ROBOT_GROUP_ID the robot passes
// to RegisterRobot() in main.py, or SendCommandToRobot will silently do
// nothing (wrong SignalR group, no error). Currently assumed "" both sides.
const ROVER_ID = '';

// TODO CONFIRM WITH ROBOT SIDE: these strings must exactly match whatever
// handle_command() in main.py switches on. Placeholder names used here.
const COMMANDS = {
  FORWARD: 'forward',
  BACKWARD: 'backward',
  TURN_LEFT: 'turn-left',
  TURN_RIGHT: 'turn-right',
  ARC_LEFT: 'arc-left',
  ARC_RIGHT: 'arc-right',
  REVERSE_ARC_LEFT: 'reverse-arc-left',
  REVERSE_ARC_RIGHT: 'reverse-arc-right',
  STOP: 'stop',
  MODE_MANUAL: 'set-mode-manual',
  MODE_AUTO: 'set-mode-autonomous',
  SET_SPEED: 'set-speed',
};

// TODO CONFIRM: the exact hub method name the backend exposes for relaying
// a command into the rover's SignalR group. The code will attempt a few
// likely method names and both object / positional payload forms.
const HUB_SEND_COMMAND_METHODS = [
  'SendCommandToRobot',
  'SendCommand',
  'SendRobotCommand',
  'SendCommandToRover',
  'SendRobot',
];

function directionsToCommand(dirs) {
  const up = dirs.has('up');
  const down = dirs.has('down');
  const left = dirs.has('left');
  const right = dirs.has('right');

  if (up && left) return COMMANDS.ARC_LEFT;
  if (up && right) return COMMANDS.ARC_RIGHT;
  if (down && left) return COMMANDS.REVERSE_ARC_LEFT;
  if (down && right) return COMMANDS.REVERSE_ARC_RIGHT;
  if (up) return COMMANDS.FORWARD;
  if (down) return COMMANDS.BACKWARD;
  if (left) return COMMANDS.TURN_LEFT;
  if (right) return COMMANDS.TURN_RIGHT;
  return COMMANDS.STOP;
}

// `connection` is the single shared SignalR connection created once in
// App.js (globalSignalRConnection) and passed down as a prop, the same way
// PastAlertsView consumes it. This component must NOT build, start, or
// stop its own connection - doing that per-mount was exactly what caused
// a "connect then disconnect a few seconds later" cycle every time you
// navigated away from this page, since the private connection's cleanup
// ran connection.stop() on unmount and killed a socket nothing else was
// using anyway.
export default function CamerasView({ connection }) {
  const [mode, setMode] = useState('manual');
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  const [speedDraft, setSpeedDraft] = useState(String(DEFAULT_SPEED));
  const [activeDirections, setActiveDirections] = useState(() => new Set());
  const [connectionState, setConnectionState] = useState(
    connection ? connection.state.toLowerCase() : 'connecting'
  );

  const [battery, setBattery] = useState(null);
  const [camera1Connected, setCamera1Connected] = useState(false);
  const [camera2Connected, setCamera2Connected] = useState(false);
  const [streamNonce, setStreamNonce] = useState(0);

  // NEW: surface command-send failures in the UI, not just console.error,
  // since "did my command actually go out" was invisible before.
  const [lastCommandError, setLastCommandError] = useState(null);

  const heldKeysRef = useRef(new Set());
  const activeSchemeRef = useRef(null);
  const lastCommandRef = useRef(null);

  // The backend identifies a camera by its stream id ("cam1") and by a display id
  // ("Camera1") depending on the message, so accept either spelling.
  const applyCameraStatus = useCallback((status) => {
    if (!status) return;

    const id = String(status.streamId || status.cameraId || '').toLowerCase();
    const connected = Boolean(status.isConnected);

    if (id === 'cam1' || id === 'camera1') setCamera1Connected(connected);
    if (id === 'cam2' || id === 'camera2') setCamera2Connected(connected);
  }, []);

  // Subscribe to telemetry/camera events on the shared connection. Only
  // .on/.off here - never .start() or .stop(), that lifecycle belongs to
  // App.js alone.
  useEffect(() => {
    if (!connection) return undefined;

    const handleTelemetry = (data) => {
      if (data && data.battery !== undefined) setBattery(data.battery);
      if (data && data.camera1Active !== undefined) setCamera1Connected(data.camera1Active);
      if (data && data.camera2Active !== undefined) setCamera2Connected(data.camera2Active);
    };

    const handleCameraStatus = applyCameraStatus;

    const handleAlert = (alert) => {
      console.warn('Hazard alert from robot:', alert);
    };

    const handleReconnecting = () => setConnectionState('connecting');
    const handleReconnected = () => {
      setConnectionState('connected');
      setStreamNonce((n) => n + 1);
    };
    const handleClose = () => {
      setConnectionState('disconnected');
      setCamera1Connected(false);
      setCamera2Connected(false);
    };

    connection.on('ReceiveAlert', handleAlert);
    connection.on('ReceiveTelemetry', handleTelemetry);
    connection.on('CameraStatusUpdate', handleCameraStatus);
    connection.onreconnecting(handleReconnecting);
    connection.onreconnected(handleReconnected);
    connection.onclose(handleClose);

    // The global connection may already be connected (or still connecting)
    // by the time this component mounts, so sync state immediately rather
    // than assuming 'connecting'.
    setConnectionState(connection.state.toLowerCase());

    return () => {
      connection.off('ReceiveAlert', handleAlert);
      connection.off('ReceiveTelemetry', handleTelemetry);
      connection.off('CameraStatusUpdate', handleCameraStatus);
      // Note: HubConnection doesn't provide an "off" for onreconnecting/
      // onreconnected/onclose handlers individually - these accumulate for
      // the lifetime of the shared connection. Harmless here since App.js
      // never remounts, but worth knowing if this component is ever
      // rendered more than once concurrently.
    };
  }, [connection, applyCameraStatus]);

  // Video availability must not hang off SignalR. The hub only announces a camera
  // when it changes state, so a page opened while a camera is already streaming
  // would otherwise sit on "Signal lost" indefinitely. Polling also recovers a feed
  // after the <img> errors out, without needing the operator to reload.
  useEffect(() => {
    let cancelled = false;

    const pollCameraStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/stream/status`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const statuses = await response.json();
        if (cancelled || !Array.isArray(statuses)) return;

        statuses.forEach(applyCameraStatus);
      } catch (error) {
        if (!cancelled) {
          console.warn('[CamerasView] Camera status request failed:', error);
        }
      }
    };

    pollCameraStatus();
    const intervalId = setInterval(pollCameraStatus, CAMERA_STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [applyCameraStatus]);

  // --- Command channel: SignalR invoke, not HTTP -----------------------
  // Movement/mode/speed commands must go over the same SignalR hub the
  // rover registers itself into (RegisterRobot -> group ROVER_ID). A plain
  // REST POST to the backend has no guaranteed path into that group unless
  // the backend explicitly bridges it, which is exactly the "I get pings,
  // not packets" symptom: the socket is alive, but nothing is being pushed
  // through it toward the robot.
  const sendCommand = useCallback((command, speedValue, degrees) => {
    const signature = `${command}|${speedValue}|${degrees ?? ''}`;
    if (lastCommandRef.current === signature) return;
    lastCommandRef.current = signature;

    if (!connection || connection.state !== HubConnectionState.Connected) {
      console.warn('Cannot send command, SignalR not connected:', command);
      setLastCommandError('Not connected to rover — command not sent.');
      return;
    }

    const payload = {
      roverId: ROVER_ID || 'ROVER-Q1',
      command,
      speed: speedValue,
      degrees: degrees ?? null,
    };

    const attemptInvoke = (index, usePositional = false) => {
      const methodName = HUB_SEND_COMMAND_METHODS[index];
      const args = usePositional
        ? [payload.roverId, payload.command, payload.speed, payload.degrees]
        : [payload];

      return connection.invoke(methodName, ...args)
        .then(() => {
          setLastCommandError(null);
        })
        .catch((err) => {
          const message = err?.message || err?.toString?.() || '';
          const isMissingMethod = message.includes('Method does not exist');
          const isBadSignature = message.includes('No method') || message.includes('parameter');

          if (!usePositional) {
            // Try the same method with positional args if object payload did not match.
            console.warn(`SignalR method '${methodName}' invoked with object payload failed. Trying positional args.`);
            return attemptInvoke(index, true);
          }

          if ((isMissingMethod || isBadSignature) && index + 1 < HUB_SEND_COMMAND_METHODS.length) {
            console.warn(`SignalR method '${methodName}' not found or signature mismatch. Trying fallback '${HUB_SEND_COMMAND_METHODS[index + 1]}'.`);
            return attemptInvoke(index + 1, false);
          }

          console.error('SendCommand SignalR invoke failed:', err);
          setLastCommandError(`Command failed: ${message || 'unknown error'}`);
          return Promise.reject(err);
        });
    };

    attemptInvoke(0);
  }, [connection]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'auto' ? 'manual' : 'auto';
      sendCommand(next === 'manual' ? COMMANDS.MODE_MANUAL : COMMANDS.MODE_AUTO, speed);
      return next;
    });
  }, [sendCommand, speed]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.shiftKey && (event.key === 'S' || event.key === 's')) {
        event.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleMode]);

  useEffect(() => {
    if (mode !== 'manual') {
      setActiveDirections(new Set());
      heldKeysRef.current.clear();
      activeSchemeRef.current = null;
      return undefined;
    }

    const directionMap = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
    };
    const schemeMap = {
      ArrowUp: 'arrows', ArrowDown: 'arrows', ArrowLeft: 'arrows', ArrowRight: 'arrows',
      w: 'wasd', W: 'wasd', s: 'wasd', S: 'wasd', a: 'wasd', A: 'wasd', d: 'wasd', D: 'wasd',
    };
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };

    const recalculateDirections = () => {
      const nextActive = new Set();
      for (const key of heldKeysRef.current) {
        const dir = directionMap[key];
        if (!nextActive.has(opposites[dir])) nextActive.add(dir);
      }
      setActiveDirections(nextActive);
    };

    const isTyping = (target) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

    const handleKeyDown = (event) => {
      if (isTyping(event.target)) return;
      const dir = directionMap[event.key];
      if (!dir) return;
      const scheme = schemeMap[event.key];
      if (activeSchemeRef.current && activeSchemeRef.current !== scheme) return;

      event.preventDefault();
      activeSchemeRef.current = scheme;
      heldKeysRef.current.add(event.key);
      recalculateDirections();
    };

    const handleKeyUp = (event) => {
      if (isTyping(event.target)) return;
      const dir = directionMap[event.key];
      if (!dir) return;
      const scheme = schemeMap[event.key];
      if (activeSchemeRef.current !== scheme) return;

      heldKeysRef.current.delete(event.key);
      if (heldKeysRef.current.size === 0) activeSchemeRef.current = null;
      recalculateDirections();
    };

    const handleBlur = () => {
      heldKeysRef.current.clear();
      activeSchemeRef.current = null;
      setActiveDirections(new Set());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'manual') return undefined;

    const timeoutId = setTimeout(() => {
      const command = directionsToCommand(activeDirections);
      sendCommand(command, speed);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [activeDirections, speed, mode, sendCommand]);

  useEffect(() => {
    if (mode !== 'auto') return undefined;

    sendCommand(COMMANDS.STOP, 0);
    sendCommand(COMMANDS.SET_SPEED, speed);

    const intervalId = setInterval(() => {
      sendCommand(COMMANDS.SET_SPEED, speed);
    }, AUTO_SPEED_PUSH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [mode, speed, sendCommand]);

  const clampSpeed = (value) => Math.min(100, Math.max(0, value));

  const updateSpeed = (adjustment) => {
    setSpeed((previousSpeed) => clampSpeed(previousSpeed + adjustment));
  };

  const startSpeedEdit = () => {
    setSpeedDraft(String(speed));
    setIsEditingSpeed(true);
  };

  const commitSpeedEdit = () => {
    const parsedValue = Number.parseFloat(speedDraft);
    if (Number.isFinite(parsedValue)) {
      const nextSpeed = clampSpeed(Math.round(parsedValue));
      setSpeed(nextSpeed);
      setSpeedDraft(String(nextSpeed));
    } else {
      setSpeedDraft(String(speed));
    }
    setIsEditingSpeed(false);
  };

  const handleSpeedInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitSpeedEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSpeedDraft(String(speed));
      setIsEditingSpeed(false);
    }
  };

  const handleSpeedInput = (event) => {
    const raw = event.target.value;
    if (raw === '' || raw === '-') {
      setSpeedDraft(raw);
      return;
    }
    let parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    if (parsed > 100) parsed = 100;
    if (parsed < 0) parsed = 0;
    setSpeedDraft(String(parsed));
  };

  const handleSliderPointerDown = (event) => {
    const track = event.currentTarget;

    const updateFromPointer = (pointerEvent) => {
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(pointerEvent.clientX - rect.left, rect.width));
      const percentage = Math.round((x / rect.width) * 100);
      setSpeed(clampSpeed(percentage));
    };

    updateFromPointer(event);

    const handlePointerMove = (moveEvent) => updateFromPointer(moveEvent);
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleFullscreen = (event) => {
    const feed = event.currentTarget;
    if (feed.requestFullscreen) feed.requestFullscreen();
    else if (feed.webkitRequestFullscreen) feed.webkitRequestFullscreen();
    else if (feed.msRequestFullscreen) feed.msRequestFullscreen();
  };

  const setDirection = (direction) => {
    if (mode !== 'manual') return;
    setActiveDirections((prev) => new Set(prev).add(direction));
  };

  const clearDirection = (direction) => {
    setActiveDirections((prev) => {
      const next = new Set(prev);
      next.delete(direction);
      return next;
    });
  };

  const speedProgress = speed;

  const directionButton = (direction, label, iconPath) => (
    <button
      type="button"
      className={`dir-btn ${direction} ${activeDirections.has(direction) ? 'active' : ''}`}
      id={`dir-${direction}`}
      disabled={mode !== 'manual'}
      aria-label={label}
      onPointerDown={() => setDirection(direction)}
      onPointerUp={() => clearDirection(direction)}
      onPointerCancel={() => clearDirection(direction)}
      onPointerLeave={() => clearDirection(direction)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
    </button>
  );

  const cameraFeed = (label, connected, streamPath) => (
    <div
      className={`camera-feed ${connected ? 'active-feed' : 'broken'}`}
      onClick={handleFullscreen}
      onKeyDown={(event) => cameraKeyHandler(event, handleFullscreen)}
      role="button"
      tabIndex="0"
      aria-label={connected ? `Open ${label} live feed fullscreen` : `${label} unavailable`}
    >
      <div className="camera-feed__topbar camera-text--haas">
        <span>{label}</span>
        <span className={`camera-state camera-state--${connected ? 'live' : 'offline'}`}>
          {connected ? 'Live' : 'Signal lost'}
        </span>
      </div>

      {connected ? (
        <img
          key={streamNonce}
          src={`${BACKEND_URL}${streamPath}?t=${streamNonce}`}
          alt={`${label} live feed`}
          className="live-video-stream"
          onError={() => {
            if (label === 'CAM 01') setCamera1Connected(false);
            if (label === 'CAM 02') setCamera2Connected(false);
          }}
        />
      ) : (
        <div className="camera-offline-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.35" stroke="currentColor" className="icon-broken" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
          <strong>Camera unavailable</strong>
          <span>Automatic reconnection in progress</span>
        </div>
      )}
    </div>
  );

  return (
    <main className="dashboard view active-view cameras-page cameras-page--focused" id="cameras-view">
      <section className="camera-console camera-control-console page-section" aria-labelledby="camera-console-title">
        <div className="page-inner">
          <div className="camera-console__heading camera-console__heading--focused">
          <h1 id="camera-console-title">Cameras &amp; Drive control</h1>
          <span className={`connection-status connection-status--${connectionState}`}>
            {connectionState === 'connected' ? 'Connected to rover' : connectionState === 'connecting' ? 'Connecting…' : 'Disconnected'}
          </span>
        </div>

        {lastCommandError && (
          <div className="command-error-banner" role="alert">
            {lastCommandError}
          </div>
        )}

        <div className="cameras-grid cameras-grid--wide">
          {cameraFeed('CAM 01', camera1Connected, '/stream/cam1')}
          {cameraFeed('CAM 02', camera2Connected, '/stream/cam2')}
        </div>

        <div className="control-grid control-grid--compact" aria-label="Rover drive controls">
          <article className="control-card control-card--mode">
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">OPERATING MODE</span><span className={`mode-status mode-status--${mode}`}>{mode === 'auto' ? 'Autonomous route' : 'Operator control'}</span></div>
            <div className="mode-toggle" aria-label="Rover operating mode">
              <button id="mode-auto" type="button" className={mode === 'auto' ? 'active' : ''} onClick={() => { if (mode !== 'auto') toggleMode(); }}>Auto</button>
              <button id="mode-manual" type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => { if (mode !== 'manual') toggleMode(); }}>Manual</button>
            </div>
            <p>{mode === 'auto' ? 'Sânzi is following the assigned scan route.' : 'Direct movement is enabled. Hold a direction button or use the arrow keys.'}</p>
          </article>

          <article className={`control-card control-card--direction ${mode === 'auto' ? 'is-locked' : ''}`}>
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">DIRECTION</span><span>{activeDirections.size > 0 ? `Command: ${directionsToCommand(activeDirections)}` : mode === 'manual' ? 'Ready' : 'Locked in Auto'}</span></div>
            <div className="manual-controls" id="manual-controls">
              <div className="directional-arrows">
                {directionButton('up', 'Move rover forward', 'm4.5 15.75 7.5-7.5 7.5 7.5')}
                <div className="mid-row">
                  {directionButton('left', 'Turn rover left', 'M15.75 19.5 8.25 12l7.5-7.5')}
                  {directionButton('down', 'Move rover backward', 'm19.5 8.25-7.5 7.5-7.5-7.5')}
                  {directionButton('right', 'Turn rover right', 'M8.25 4.5 15.75 12l-7.5 7.5')}
                </div>
              </div>
            </div>
          </article>

          <article className="control-card control-card--speed">
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">MOTOR SPEED</span><span>Range 0 / 100%</span></div>
            <div className={`speed-display ${isEditingSpeed ? 'is-editing' : ''}`}>
              {isEditingSpeed ? (
                <input id="speed-value-input" className="speed-value-input" type="number" min="0" max="100" step="1" inputMode="numeric" value={speedDraft} onChange={handleSpeedInput} onBlur={commitSpeedEdit} onKeyDown={handleSpeedInputKeyDown} onFocus={(event) => event.currentTarget.select()} aria-label="Set rover speed percentage" autoFocus />
              ) : (
                <button id="speed-value" type="button" className="speed-value-button" onDoubleClick={startSpeedEdit} title="Double-click to enter a speed" aria-label={`Current speed ${speed} percent. Double-click to edit.`}>{speed}</button>
              )}
              <span>%</span>
            </div>
            <div
              className="speed-track interactive"
              aria-hidden="true"
              onPointerDown={handleSliderPointerDown}
              style={{ cursor: 'pointer', touchAction: 'none' }}
            >
              <span style={{ width: `${speedProgress}%`, pointerEvents: 'none' }} />
              <i style={{ left: `${speedProgress}%`, pointerEvents: 'none' }} />
            </div>
            <div className="speed-adjuster">
              <button id="speed-down" type="button" className="speed-btn" onClick={() => updateSpeed(-10)} aria-label="Decrease speed by 10 percent">−10%</button>
              <button id="speed-reset" type="button" className="speed-reset-btn" onClick={() => setSpeed(DEFAULT_SPEED)} title="Reset speed to 50 percent">Reset</button>
              <button id="speed-up" type="button" className="speed-btn" onClick={() => updateSpeed(10)} aria-label="Increase speed by 10 percent">+10%</button>
            </div>
          </article>

          <article className="control-card control-card--battery">
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">POWER RESERVE</span><span>{battery !== null ? 'Live reading' : 'Awaiting telemetry'}</span></div>
            <div className="battery-orbit" aria-label={`Battery ${battery ?? '--'} percent`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" className="battery-orbit__base" />
                <circle cx="60" cy="60" r="50" className="battery-orbit__value" pathLength="100" strokeDasharray={`${battery ?? 0} 100`} />
              </svg>
              <div><strong>{battery ?? '--'}</strong><span>%</span></div>
            </div>
          </article>
        </div>
        </div>
      </section>
      <footer className="site-footer site-footer--light">
        <span>NOKIA · 5G SOS ROVER</span>
        <span>SÂNZI CONTROL INTERFACE / 2026</span>
      </footer>
    </main>
  );
}
