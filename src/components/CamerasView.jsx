import React, { useEffect, useState } from 'react';

const cameraKeyHandler = (event, callback) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback(event);
  }
};

const DEFAULT_SPEED = 50;

export default function CamerasView() {
  const [mode, setMode] = useState('auto');
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  const [speedDraft, setSpeedDraft] = useState(String(DEFAULT_SPEED));
  const [pressedDirection, setPressedDirection] = useState(null);

  useEffect(() => {
    if (mode !== 'manual') {
      setPressedDirection(null);
      return undefined;
    }

    const directionMap = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const handleKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable;
      if (isTyping) return;

      const direction = directionMap[event.key];
      if (direction) {
        event.preventDefault();
        setPressedDirection(direction);
      }
    };

    const handleKeyUp = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable;
      if (isTyping) return;

      const direction = directionMap[event.key];
      if (direction) {
        setPressedDirection((currentDirection) => (
          currentDirection === direction ? null : currentDirection
        ));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode]);

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

  const handleFullscreen = (event) => {
    const feed = event.currentTarget;
    if (feed.requestFullscreen) {
      feed.requestFullscreen();
    } else if (feed.webkitRequestFullscreen) {
      feed.webkitRequestFullscreen();
    } else if (feed.msRequestFullscreen) {
      feed.msRequestFullscreen();
    }
  };

  const setDirection = (direction) => {
    if (mode === 'manual') setPressedDirection(direction);
  };

  const clearDirection = () => setPressedDirection(null);
  const speedProgress = speed;

  const directionButton = (direction, label, iconPath) => (
    <button
      type="button"
      className={`dir-btn ${direction} ${pressedDirection === direction ? 'active' : ''}`}
      id={`dir-${direction}`}
      disabled={mode !== 'manual'}
      aria-label={label}
      onPointerDown={() => setDirection(direction)}
      onPointerUp={clearDirection}
      onPointerCancel={clearDirection}
      onPointerLeave={clearDirection}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
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

        <div className="cameras-grid cameras-grid--wide">
          <div className="camera-feed broken" onClick={handleFullscreen} onKeyDown={(event) => cameraKeyHandler(event, handleFullscreen)} role="button" tabIndex="0" aria-label="Open Camera 1 fullscreen. Camera unavailable.">
            <div className="camera-feed__topbar camera-text--haas"><span>CAM 01</span><span className="camera-state camera-state--offline">Signal lost</span></div>
            <div className="camera-offline-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.35" stroke="currentColor" className="icon-broken" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
              <strong>Camera unavailable</strong><span>Automatic reconnection in progress</span>
            </div>
            <div className="camera-feed__footer camera-text--haas"><span>Last frame 00:42 ago</span></div>
          </div>

          <div className="camera-feed active-feed" onClick={handleFullscreen} onKeyDown={(event) => cameraKeyHandler(event, handleFullscreen)} role="button" tabIndex="0" aria-label="Open Camera 2 live feed fullscreen">
            <div className="camera-feed__visual" aria-hidden="true"><span className="camera-grid-line camera-grid-line--one" /><span className="camera-grid-line camera-grid-line--two" /><span className="camera-horizon" /><span className="camera-route" /><span className="camera-target-box"><i />PERSON / 97%</span><span className="camera-crosshair" /></div>
            <div className="camera-feed__topbar camera-text--haas"><span>CAM 02</span><span className="camera-state camera-state--live">Live</span></div>
            <div className="camera-feed__footer camera-text--haas"><span>18 ms latency</span></div>
          </div>
        </div>

        <div className="control-grid control-grid--compact" aria-label="Rover drive controls">
          <article className="control-card control-card--mode">
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">OPERATING MODE</span><span className={`mode-status mode-status--${mode}`}>{mode === 'auto' ? 'Autonomous route' : 'Operator control'}</span></div>
            <div className="mode-toggle" aria-label="Rover operating mode"><button id="mode-auto" type="button" className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>Auto</button><button id="mode-manual" type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Manual</button></div>
            <p>{mode === 'auto' ? 'Sânzi is following the assigned scan route.' : 'Direct movement is enabled. Hold a direction button or use the arrow keys.'}</p>
          </article>

          <article className={`control-card control-card--direction ${mode === 'auto' ? 'is-locked' : ''}`}>
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">DIRECTION</span><span>{pressedDirection ? `Command: ${pressedDirection}` : mode === 'manual' ? 'Ready' : 'Locked in Auto'}</span></div>
            <div className="manual-controls" id="manual-controls"><div className="directional-arrows">{directionButton('up', 'Move rover forward', 'm4.5 15.75 7.5-7.5 7.5 7.5')}<div className="mid-row">{directionButton('left', 'Turn rover left', 'M15.75 19.5 8.25 12l7.5-7.5')}{directionButton('down', 'Move rover backward', 'm19.5 8.25-7.5 7.5-7.5-7.5')}{directionButton('right', 'Turn rover right', 'M8.25 4.5 15.75 12l-7.5 7.5')}</div></div></div>
          </article>

          <article className="control-card control-card--speed">
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">MOTOR SPEED</span><span>Range 0 / 100%</span></div>
            <div className={`speed-display ${isEditingSpeed ? 'is-editing' : ''}`}>
              {isEditingSpeed ? <input id="speed-value-input" className="speed-value-input" type="number" min="0" max="100" step="1" inputMode="numeric" value={speedDraft} onChange={(event) => setSpeedDraft(event.target.value)} onBlur={commitSpeedEdit} onKeyDown={handleSpeedInputKeyDown} onFocus={(event) => event.currentTarget.select()} aria-label="Set rover speed percentage" autoFocus /> : <button id="speed-value" type="button" className="speed-value-button" onDoubleClick={startSpeedEdit} title="Double-click to enter a speed" aria-label={`Current speed ${speed} percent. Double-click to edit.`}>{speed}</button>}<span>%</span>
            </div>
            <div className="speed-track" aria-hidden="true"><span style={{ width: `${speedProgress}%` }} /><i style={{ left: `${speedProgress}%` }} /></div>
            <div className="speed-adjuster"><button id="speed-down" type="button" className="speed-btn" onClick={() => updateSpeed(-10)} aria-label="Decrease speed by 10 percent">−10%</button><button id="speed-reset" type="button" className="speed-reset-btn" onClick={() => setSpeed(DEFAULT_SPEED)} title="Reset speed to 50 percent">Reset</button><button id="speed-up" type="button" className="speed-btn" onClick={() => updateSpeed(10)} aria-label="Increase speed by 10 percent">+10%</button></div>
          </article>

          <article className="control-card control-card--battery">
            <div className="control-card__heading"><span className="widget-eyebrow control-title--haas">POWER RESERVE</span><span>Estimated 14h 26m</span></div>
            <div className="battery-orbit" aria-label="Battery 87 percent"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" className="battery-orbit__base" /><circle cx="60" cy="60" r="50" className="battery-orbit__value" pathLength="100" strokeDasharray="87 100" /></svg><div><strong>87</strong><span>%</span></div></div>
          </article>
        </div>
      </section>
      <footer className="site-footer site-footer--light">
        <span>NOKIA · 5G SOS ROVER</span>
        <span>SÂNZI CONTROL INTERFACE / 2026</span>
      </footer>
    </main>
  );
}
