import React, { useEffect, useState, useRef } from 'react';
import { HubConnectionState } from '@microsoft/signalr';

const DEFAULT_SPEED = 50;
const clampSpeed = (value) => Math.max(0, Math.min(100, value));
const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function CamerasView({ connection }) {
  const [mode, setMode] = useState('auto');
  const [speed, setSpeed] = useState(74);
  const [activeDirections, setActiveDirections] = useState(() => new Set());
  
  // Real-time states
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [battery, setBattery] = useState(null);
  const [camera1Connected, setCamera1Connected] = useState(false);
  const [camera2Connected, setCamera2Connected] = useState(false);

  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  const [speedDraft, setSpeedDraft] = useState('');

  const heldKeysRef = useRef(new Set());
  const activeSchemeRef = useRef(null);

  const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };

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

    connection.onreconnecting(() => setConnectionStatus('connecting...'));
    connection.onreconnected(() => setConnectionStatus('live'));
    connection.onclose(() => setConnectionStatus('disconnected'));

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
    if (mode !== 'manual') return;
    
    const track = event.currentTarget;
    
    const updateFromPointer = (pointerEvent) => {
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(pointerEvent.clientX - rect.left, rect.width));
      const percentage = Math.round((x / rect.width) * 100);
      setSpeed(percentage);
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

  const handleFullscreen = (e) => {
    const feed = e.currentTarget;
    if (feed.requestFullscreen) feed.requestFullscreen();
    else if (feed.webkitRequestFullscreen) feed.webkitRequestFullscreen();
    else if (feed.msRequestFullscreen) feed.msRequestFullscreen();
  };
  
  const speedProgress = speed === '' ? 0 : speed;

  const directionButton = (direction, label, iconPath) => (
    <button
      type="button"
      className={`dir-btn ${direction} ${activeDirections.has(direction) ? 'active' : ''}`}
      id={`dir-${direction}`}
      disabled={mode !== 'manual'}
      aria-label={label}
      onPointerDown={(e) => {
        if (mode !== 'manual') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setActiveDirections(prev => {
          const next = new Set(prev);
          next.delete(opposites[direction]); // Remove opposite if pressed
          next.add(direction);
          return next;
        });
      }}
      onPointerUp={(e) => {
        if (mode !== 'manual') return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setActiveDirections(prev => {
          const next = new Set(prev);
          next.delete(direction);
          return next;
        });
      }}
      onPointerCancel={(e) => {
        if (mode !== 'manual') return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setActiveDirections(prev => {
          const next = new Set(prev);
          next.delete(direction);
          return next;
        });
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
    </button>
  );

  return (
    <main className="dashboard view active-view cameras-page cameras-page--focused" id="cameras-view">
      <section className="camera-console camera-control-console page-section" aria-labelledby="camera-console-title">
        <div className="camera-console__heading camera-console__heading--focused">
          <h1 id="camera-console-title">Cameras &amp; Drive control</h1>
        </div>

        <div className="camera-feeds-container">
          <div className="camera-feed" onDoubleClick={handleFullscreen}>
            {camera1Connected ? (
               <img src={`${backendUrl}/stream/cam1`} alt="Camera 1 Live Feed" className="live-video-stream" />
            ) : (
               <div className="camera-feed__offline-state">CAMERA 1 OFFLINE</div>
            )}
            <div className="camera-feed__label">Front chassis</div>
          </div>

          <div className="camera-feed" onDoubleClick={handleFullscreen}>
            {camera2Connected ? (
               <img src={`${backendUrl}/stream/cam2`} alt="Camera 2 Live Feed" className="live-video-stream" />
            ) : (
               <div className="camera-feed__offline-state">CAMERA 2 OFFLINE</div>
            )}
            <div className="camera-feed__label">Rear chassis</div>
          </div>
        </div>

        <div className="bottom-bar">
          <div className="control-grid control-grid--compact" aria-label="Rover drive controls" style={{ marginTop: '32px' }}>
            
            <article className="control-card control-card--mode">
              <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">OPERATING MODE</span><span className={`mode-status mode-status--${mode}`}>{mode === 'auto' ? 'Autonomous route' : 'Operator control'}</span></div>
              <div className="mode-toggle" aria-label="Rover operating mode"><button id="mode-auto" type="button" className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>Auto</button><button id="mode-manual" type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Manual</button></div>
              <p>{mode === 'auto' ? 'Sânzi is following the assigned scan route.' : 'Direct movement is enabled. Hold a direction button or use the arrow keys.'}</p>
            </article>

            <article className={`control-card control-card--direction ${mode === 'auto' ? 'is-locked' : ''}`}>
              <div className="control-card__heading">
                <span className="widget-eyebrow control-title--haas">DIRECTION</span>
                <span>{activeDirections.size > 0 ? `Command: ${Array.from(activeDirections).join(', ')}` : mode === 'manual' ? 'Ready' : 'Locked in Auto'}</span>
              </div>
              <div className="manual-controls" id="manual-controls" style={{ marginTop: '0' }}>
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
                  <input 
                    id="speed-value-input" 
                    className="speed-value-input" 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="1" 
                    inputMode="numeric" 
                    value={speedDraft} 
                    onChange={handleSpeedInput} 
                    onBlur={commitSpeedEdit} 
                    onKeyDown={handleSpeedInputKeyDown} 
                    onFocus={(event) => event.currentTarget.select()} 
                    aria-label="Set rover speed percentage" 
                    autoFocus 
                  />
                ) : (
                  <button 
                    id="speed-value" 
                    type="button" 
                    className="speed-value-button" 
                    onDoubleClick={startSpeedEdit} 
                    title="Double-click to enter a speed" 
                    aria-label={`Current speed ${speed} percent. Double-click to edit.`}
                  >
                    {speed}
                  </button>
                )}
                <span>%</span>
              </div>
              
              <div 
                className={`speed-track ${mode === 'manual' ? 'interactive' : ''}`} 
                aria-hidden="true"
                onPointerDown={handleSliderPointerDown}
                style={{ cursor: mode === 'manual' ? 'pointer' : 'default', touchAction: 'none' }}
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
              <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">POWER RESERVE</span><span>Estimated 14h 26m</span></div>
              <div className="battery-orbit" aria-label="Battery 87 percent"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" className="battery-orbit__base" /><circle cx="60" cy="60" r="50" className="battery-orbit__value" pathLength="100" strokeDasharray="87 100" /></svg><div><strong>87</strong><span>%</span></div></div>
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