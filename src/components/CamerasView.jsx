import React, { useEffect, useState, useRef } from 'react';

export default function CamerasView() {
  const [mode, setMode] = useState('auto');
  const [speed, setSpeed] = useState(74);
  const [activeDirections, setActiveDirections] = useState(() => new Set());
  
  // Track physical keys held AND the current active scheme ('arrows' or 'wasd')
  const heldKeysRef = useRef(new Set());
  const activeSchemeRef = useRef(null);

  const toggleMode = () => {
    setMode(prev => (prev === 'auto' ? 'manual' : 'auto'));
  };

  // Global shortcut: Shift+S toggles Auto/Manual, regardless of current mode
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
      
      // If a scheme is active and it's NOT the one we just pressed, ignore the key entirely
      if (activeSchemeRef.current && activeSchemeRef.current !== scheme) return;

      event.preventDefault();

      // Lock in the current scheme and add the key
      activeSchemeRef.current = scheme;
      heldKeysRef.current.add(event.key);
      recalculateDirections();
    };

    const handleKeyUp = (event) => {
      const dir = directionMap[event.key];
      if (!dir) return;

      const scheme = schemeMap[event.key];
      
      // Ignore keyups from the opposite scheme just in case
      if (activeSchemeRef.current !== scheme) return;

      heldKeysRef.current.delete(event.key);
      
      // If we released all keys, unlock the scheme so the user can switch
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

  // Speed controls
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

  // Fullscreen handler
  const handleFullscreen = (e) => {
    const feed = e.currentTarget;
    if (feed.requestFullscreen) {
      feed.requestFullscreen();
    } else if (feed.webkitRequestFullscreen) {
      feed.webkitRequestFullscreen();
    } else if (feed.msRequestFullscreen) {
      feed.msRequestFullscreen();
    }
  };

  return (
    <main className="dashboard view active-view" id="cameras-view">
      <div className="top-section">
        <div className="title-container">
          <h1 className="main-title">Cameras</h1>
        </div>
      </div>

      <div className="cameras-layout">
        <div className="cameras-grid">
          <div className="camera-feed broken" onClick={handleFullscreen}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="icon-broken">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            <span className="camera-label">Camera 1</span>
          </div>
          <div className="camera-feed active-feed" onClick={handleFullscreen}>
            <span className="camera-label">Camera 2</span>
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
          <span className="battery-value">87%</span>
        </div>
      </div>
    </main>
  );
}