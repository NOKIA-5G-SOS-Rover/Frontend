import React, { useEffect, useState, useRef } from 'react';
import { HubConnectionState } from '@microsoft/signalr';

export default function CamerasView({ connection }) {
  const [mode, setMode] = useState('auto');
  const [speed, setSpeed] = useState(74);
  const [activeDirections, setActiveDirections] = useState(() => new Set());
  
  // Real-time states
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [battery, setBattery] = useState(null);
  const [camera1Connected, setCamera1Connected] = useState(false);
  const [camera2Connected, setCamera2Connected] = useState(false);

  const heldKeysRef = useRef(new Set());
  const activeSchemeRef = useRef(null);

  const toggleMode = () => {
    setMode(prev => (prev === 'auto' ? 'manual' : 'auto'));
  };

  // Global shortcut: Shift+S toggles Auto/Manual
  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.shiftKey && (event.key === 'S' || event.key === 's')) {
        event.preventDefault();
        toggleMode();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Track Connection Status & Listen for Telemetry
  useEffect(() => {
    if (!connection) return;

    // 1. Check current connection state
    const updateStatus = () => {
      if (connection.state === HubConnectionState.Connected) {
        setConnectionStatus('live');
      } else if (connection.state === HubConnectionState.Connecting || connection.state === HubConnectionState.Reconnecting) {
        setConnectionStatus('connecting...');
      } else {
        setConnectionStatus('disconnected');
      }
    };
    updateStatus();

    // 2. Bind connection lifecycle events
    connection.onreconnecting(() => setConnectionStatus('connecting...'));
    connection.onreconnected(() => setConnectionStatus('live'));
    connection.onclose(() => setConnectionStatus('disconnected'));

    // 3. Bind Telemetry & Camera status events
    const handleTelemetry = (data) => {
      if (data && data.battery !== undefined) {
        setBattery(data.battery);
      }
      if (data && data.camera1Active !== undefined) setCamera1Connected(data.camera1Active);
      if (data && data.camera2Active !== undefined) setCamera2Connected(data.camera2Active);
    };

    const handleCameraStatus = (status) => {
      if (status.cameraId === 'Camera1') setCamera1Connected(status.isConnected);
      if (status.cameraId === 'Camera2') setCamera2Connected(status.isConnected);
    };

    connection.on('ReceiveTelemetry', handleTelemetry);
    connection.on('CameraStatusUpdate', handleCameraStatus);

    return () => {
      connection.off('ReceiveTelemetry', handleTelemetry);
      connection.off('CameraStatusUpdate', handleCameraStatus);
      // We don't remove lifecycle events because they affect the global connection,
      // but we do clean up our specific data listeners.
    };
  }, [connection]);

  // Keyboard movement controls
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
        if (!nextActive.has(opposites[dir])) {
          nextActive.add(dir);
        }
      }
      setActiveDirections(nextActive);
    };

    const handleKeyDown = (event) => {
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
      const dir = directionMap[event.key];
      if (!dir) return;

      const scheme = schemeMap[event.key];
      if (activeSchemeRef.current !== scheme) return;

      heldKeysRef.current.delete(event.key);
      if (heldKeysRef.current.size === 0) {
        activeSchemeRef.current = null;
      }
      recalculateDirections();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode]);

  // Sending commands to backend via SignalR
  useEffect(() => {
    if (mode !== 'manual') return;

    const sendCommand = async () => {
      if (connection && connection.state === HubConnectionState.Connected) {
        try {
          await connection.send('SendCommand', {
            directions: Array.from(activeDirections),
            speed: speed === '' || speed === '-' ? 0 : parseInt(speed, 10)
          });
        } catch (error) {
          console.error("Failed to send rover command via SignalR:", error);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      sendCommand();
    }, 50); 

    return () => clearTimeout(timeoutId);
  }, [activeDirections, speed, mode, connection]);

  // Stop the rover the moment we leave manual mode via SignalR
  useEffect(() => {
    if (mode === 'auto') {
      const stopRover = async () => {
        if (connection && connection.state === HubConnectionState.Connected) {
          try {
            await connection.send('SendCommand', { directions: [], speed: 0 });
          } catch (error) {
            console.error("Failed to halt rover upon exiting manual mode:", error);
          }
        }
      };
      stopRover();
    }
  }, [mode, connection]);

  const updateSpeed = (adjustment) => {
    setSpeed(prevSpeed => {
      const current = (prevSpeed === '' || prevSpeed === '-') ? 0 : parseInt(prevSpeed, 10);
      let newSpeed = current + adjustment;
      if (newSpeed > 255) newSpeed = 255;
      if (newSpeed < -255) newSpeed = -255;
      return newSpeed;
    });
  };

  const handleSpeedInput = (event) => {
    const raw = event.target.value;
    if (raw === '' || raw === '-') {
      setSpeed(raw);
      return;
    }
    let parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    if (parsed > 255) parsed = 255;
    if (parsed < -255) parsed = -255;
    setSpeed(parsed);
  };

  const handleSpeedBlur = () => {
    if (speed === '' || speed === '-' || Number.isNaN(speed)) {
      setSpeed(0);
    }
  };

  const handleFullscreen = (e) => {
    const feed = e.currentTarget;
    if (feed.requestFullscreen) feed.requestFullscreen();
    else if (feed.webkitRequestFullscreen) feed.webkitRequestFullscreen();
    else if (feed.msRequestFullscreen) feed.msRequestFullscreen();
  };

  return (
    <main className="dashboard view active-view" id="cameras-view">
      {/* Updated top section to show layout and connection status */}
      <div className="top-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="title-container">
          <h1 className="main-title">Cameras</h1>
        </div>
        
        {/* Live Status Badge */}
        <span className="live-status">
          <span className={`live-status-dot ${connectionStatus === 'live' ? 'active' : ''}`}></span>
          {connectionStatus}
        </span>
      </div>

      <div className="cameras-layout">
        <div className="cameras-grid">
          
          {/* CAMERA 1 FEED */}
          <div className={`camera-feed ${!camera1Connected ? 'broken' : 'active-feed'}`} onClick={handleFullscreen}>
            {!camera1Connected ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="icon-broken">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
                <span className="camera-label">Camera 1 (Disconnected)</span>
              </>
            ) : (
              <span className="camera-label">Camera 1</span>
            )}
          </div>
          
          {/* CAMERA 2 FEED */}
          <div className={`camera-feed ${!camera2Connected ? 'broken' : 'active-feed'}`} onClick={handleFullscreen}>
            {!camera2Connected ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="icon-broken">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
                <span className="camera-label">Camera 2 (Disconnected)</span>
              </>
            ) : (
              <span className="camera-label">Camera 2</span>
            )}
          </div>

        </div>

        <div className={`manual-controls ${mode === 'auto' ? 'hidden' : ''}`} id="manual-controls">
          <div className="directional-arrows">
            <button className={`dir-btn up ${activeDirections.has('up') ? 'active' : ''}`} id="dir-up">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
            </button>
            <div className="mid-row">
              <button className={`dir-btn left ${activeDirections.has('left') ? 'active' : ''}`} id="dir-left">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <button className={`dir-btn down ${activeDirections.has('down') ? 'active' : ''}`} id="dir-down">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </button>
              <button className={`dir-btn right ${activeDirections.has('right') ? 'active' : ''}`} id="dir-right">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5 15.75 12l-7.5 7.5" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="bar-section mode-section">
          <span className="bar-label">Mode</span>
          <button
            id="mode-toggle"
            className={`mode-switch ${mode}`}
            onClick={toggleMode}
            role="switch"
            aria-checked={mode === 'manual'}
            title="Toggle Auto/Manual (Shift+S)"
          >
            <span className="mode-switch-track">
              <span className="mode-switch-thumb" />
            </span>
            <span className="mode-switch-text">{mode === 'auto' ? 'Auto' : 'Manual'}</span>
          </button>
        </div>

        <div className="bar-section speed-section">
          <span className="bar-label">Speed</span>
          <div className="speed-adjuster">
            <button id="speed-down" className="speed-btn" onClick={() => updateSpeed(-25)}>−</button>
            <input
              id="speed-value"
              className="speed-input"
              type="text"
              min="-255"
              max="255"
              step="1"
              value={speed}
              onChange={handleSpeedInput}
              onBlur={handleSpeedBlur}
            />
            <button id="speed-up" className="speed-btn" onClick={() => updateSpeed(25)}>+</button>
            <button id="speed-reset" className="speed-reset-btn" onClick={() => setSpeed(74)} title="Reset Speed">&#x21bb;</button>
          </div>
        </div>

        <div className="bar-section battery-section">
          <span className="bar-label">Battery</span>
          <span className="battery-value">{battery !== null ? `${battery}%` : '--'}</span>
        </div>
      </div>
    </main>
  );
}