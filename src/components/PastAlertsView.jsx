import React, { useState, useEffect, useRef } from 'react';

export default function PastAlertsView({ liveEvents = [] }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [dateFilter, setDateFilter] = useState({ month: '', day: '', year: '' });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [transformOrigin, setTransformOrigin] = useState({ x: '50%', y: '50%' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const detailImgRef = useRef(null);
  const fsImgRef = useRef(null);

  const handleMouseWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoomLevel((prev) => {
      const next = Math.max(1, Math.min(3, prev + delta));

        // Compute transform-origin based on cursor position so zoom focuses at cursor
        // Prefer the image ref for the active viewer, fall back to nearest <img>
        let img = isFullscreen ? fsImgRef.current : detailImgRef.current;
        if (!img && e.target) {
          img = e.target.closest && e.target.closest('img');
        }
        if (img) {
          const rect = img.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const offsetY = e.clientY - rect.top;
          const originX = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
          const originY = Math.max(0, Math.min(100, (offsetY / rect.height) * 100));
          setTransformOrigin({ x: `${originX}%`, y: `${originY}%` });
        }

      // If resetting to 1x, center the origin
      if (next === 1) {
        setTransformOrigin({ x: '50%', y: '50%' });
      }

      return next;
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const closeDetail = () => {
    setSelectedAlert(null);
    setZoomLevel(1);
    setTransformOrigin({ x: '50%', y: '50%' });
    setIsFullscreen(false);
  };

  // Handle ESC key: exit fullscreen first, then close the panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (selectedAlert) {
          closeDetail();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, selectedAlert]);

  const mockAlerts = [
    { date: 'May 1st', text: 'SOS Signal sent - Person detected - Confidence 87% - Location: Sector A', tags: ['confidence','location'], month: 'May', day: '1', year: '2025', imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Crect x=%22300%22 y=%22200%22 width=%22200%22 height=%22200%22 fill=%22%23ff6600%22 opacity=%220.7%22/%3E%3Ctext x=%22400%22 y=%22310%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2220%22%3EThermal Signature%3C/text%3E%3C/svg%3E', confidence: 87 },
    { date: 'May 2nd', text: 'High thermal anomaly detected - Heat signature matches human - Confidence 92%', tags: ['confidence'], month: 'May', day: '2', year: '2025', imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Crect x=%22300%22 y=%22200%22 width=%22200%22 height=%22200%22 fill=%22%23ff6600%22 opacity=%220.7%22/%3E%3Ctext x=%22400%22 y=%22310%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2220%22%3EThermal Signature%3C/text%3E%3C/svg%3E', confidence: 92 },
    { date: 'May 3rd', text: 'Movement detected at grid Alpha - Visual confirmation failed - Confidence 45%', tags: ['confidence'], month: 'May', day: '3', year: '2025', imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Cpolyline points=%22100,100 300,150 250,400 400,380%22 stroke=%22%233aa6d4%22 fill=%22none%22 stroke-width=%222%22/%3E%3Ctext x=%22400%22 y=%22310%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2220%22%3EMovement Pattern%3C/text%3E%3C/svg%3E', confidence: 45 },
    { date: 'May 4th', text: 'SOS Signal sent - Multiple targets detected - Confidence 95%', tags: ['confidence'], month: 'May', day: '4', year: '2025', imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Ccircle cx=%22250%22 cy=%22200%22 r=%2240%22 fill=%22%23ff2a2a%22 opacity=%220.8%22/%3E%3Ccircle cx=%22550%22 cy=%22250%22 r=%2235%22 fill=%22%23ff2a2a%22 opacity=%220.8%22/%3E%3Ccircle cx=%22400%22 cy=%22450%22 r=%2238%22 fill=%22%23ff2a2a%22 opacity=%220.8%22/%3E%3Ctext x=%22400%22 y=%22530%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2218%22%3EMultiple Targets%3C/text%3E%3C/svg%3E', confidence: 95 },
    { date: 'May 7th', text: 'Proximity sensor triggered - Manual override requested', tags: ['confidence'], month: 'May', day: '7', year: '2025', imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Ccircle cx=%22250%22 cy=%22200%22 r=%2240%22 fill=%22%23ff2a2a%22 opacity=%220.8%22/%3E%3Ccircle cx=%22550%22 cy=%22250%22 r=%2235%22 fill=%22%23ff2a2a%22 opacity=%220.8%22/%3E%3Ccircle cx=%22400%22 cy=%22450%22 r=%2238%22 fill=%22%23ff2a2a%22 opacity=%220.8%22/%3E%3Ctext x=%22400%22 y=%22530%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2218%22%3EMultiple Targets%3C/text%3E%3C/svg%3E', confidence: 70 },
  ];


  const liveCriticalAlerts = liveEvents
    .filter((event) => event.severity === 'critical')
    .map((event) => {
      const date = new Date(event.timestamp);
      return {
        date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        text: `${event.title} - ${event.description}${event.confidence !== null ? ` - Confidence ${event.confidence}%` : ''}${event.location ? ` - Location: ${event.location}` : ''}`,
        tags: ['confidence', ...(event.location ? ['location'] : [])],
        month: date.toLocaleDateString('en-US', { month: 'long' }),
        day: `${date.getDate()}`,
        year: `${date.getFullYear()}`,
        imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Ccircle cx=%22400%22 cy=%22300%22 r=%22120%22 fill=%22%23ff2a2a%22 opacity=%220.35%22/%3E%3Ctext x=%22400%22 y=%22310%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2224%22%3ELive Event Snapshot%3C/text%3E%3C/svg%3E',
        confidence: event.confidence || 100,
        sourceId: event.id,
      };
    });

  const allAlerts = [...liveCriticalAlerts, ...mockAlerts];

  const filteredAlerts = allAlerts.filter((alert) => {
    const matchesCategoryFilters = activeFilters.every((filter) => alert.tags.includes(filter));
    const matchesDateFilters = [
      !dateFilter.month || alert.month === dateFilter.month,
      !dateFilter.day || alert.day === dateFilter.day,
      !dateFilter.year || alert.year === dateFilter.year,
    ].every(Boolean);

    return matchesCategoryFilters && matchesDateFilters;
  });

  const monthDayCounts = {
    January: 31,
    February: 28,
    March: 31,
    April: 30,
    May: 31,
    June: 30,
    July: 31,
    August: 31,
    September: 30,
    October: 31,
    November: 30,
    December: 31,
  };

  const getDaysInMonth = (month, year) => {
    if (!month) return 31;
    if (month === 'February') {
      const yearNumber = Number(year);
      const isLeap = yearNumber && ((yearNumber % 4 === 0 && yearNumber % 100 !== 0) || yearNumber % 400 === 0);
      return isLeap ? 29 : 28;
    }
    return monthDayCounts[month] || 31;
  };

  const toggleFilter = (filter) => {
    setActiveFilters((currentFilters) =>
      currentFilters.includes(filter)
        ? currentFilters.filter((item) => item !== filter)
        : [...currentFilters, filter]
    );
  };

  const handleDateChange = (field, value) => {
    setDateFilter((current) => {
      const nextFilter = { ...current, [field]: value };
      if (field === 'month' || field === 'year') {
        const maxDay = getDaysInMonth(nextFilter.month, nextFilter.year);
        if (nextFilter.day && Number(nextFilter.day) > maxDay) {
          nextFilter.day = '';
        }
      }
      return nextFilter;
    });
  };

  return (
    <main className="dashboard view active-view">
      <div className="top-section row-space">
        <h1 className="main-title">Past Alerts</h1>
        <div className="filter-container">
          <button
            className="filter-btn"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="icon-filter">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
          </button>

          <div className={`filter-dropdown ${isFilterOpen ? '' : 'hidden'}`}>
            <label className="filter-option">
              <span>Confidence</span>
              <input type="checkbox" name="filter" value="confidence" checked={activeFilters.includes('confidence')} onChange={() => toggleFilter('confidence')} />
            </label>
            <label className="filter-option">
              <span>Location</span>
              <input type="checkbox" name="filter" value="location" checked={activeFilters.includes('location')} onChange={() => toggleFilter('location')} />
            </label>
            <div className="filter-option date-filter-group">
              <span>Date</span>
              <div className="date-filter-controls">
                <select value={dateFilter.month} onChange={(e) => handleDateChange('month', e.target.value)}>
                  <option value="">Month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
                <select value={dateFilter.day} onChange={(e) => handleDateChange('day', e.target.value)}>
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => {
                    const day = i + 1;
                    const isDisabled = day > getDaysInMonth(dateFilter.month, dateFilter.year);
                    return (
                      <option key={day} value={`${day}`} disabled={isDisabled}>
                        {day}
                      </option>
                    );
                  })}
                </select>
                <select value={dateFilter.year} onChange={(e) => handleDateChange('year', e.target.value)}>
                  <option value="">Year</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="alerts-content-wrapper">
        <div className={`alerts-list-container ${selectedAlert ? 'with-panel' : ''}`}>
          <ul className="alerts-list">
            {filteredAlerts.map((alert, index) => (
              <li
                key={index}
                className={`alert-item ${selectedAlert?.index === index ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedAlert({ ...alert, index });
                  setZoomLevel(1);
                  setTransformOrigin({ x: '50%', y: '50%' });
                }}
              >
                <div className="alert-dot"></div>
                <div className="alert-content-wrapper">
                  <div className="alert-date">{alert.date}</div>
                  <div className="alert-text">{alert.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Inline right-side panel — part of the normal page flow, no backdrop/overlay */}
        {selectedAlert && (
          <div className="event-detail-panel">
            <div className="detail-header">
              <h3>Event Details</h3>
              <button className="close-detail-btn" onClick={closeDetail}>×</button>
            </div>

            <div className="detail-body">
              <div className="detail-info">
                <div className="info-row">
                  <span className="info-label">Date</span>
                  <span className="info-value">{selectedAlert.date}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Confidence</span>
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${selectedAlert.confidence}%` }}></div>
                    <span className="confidence-text">{selectedAlert.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="image-viewer-container">
                <div className="image-controls">
                  <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                  <button className="zoom-btn reset" onClick={() => { setZoomLevel(1); setTransformOrigin({ x: '50%', y: '50%' }); }} title="Reset zoom (R)">↻</button>
                  <button className="zoom-btn fullscreen-btn" onClick={toggleFullscreen} title="Toggle fullscreen (F)">⛶</button>
                </div>

                <div
                  className="image-viewport"
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMouseWheel(e);
                  }}
                >
                  <img
                    key={selectedAlert.index}
                    src={selectedAlert.imageUrl}
                    alt="Alert"
                    className="detail-image"
                    ref={detailImgRef}
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${zoomLevel})`, transformOrigin: `${transformOrigin.x} ${transformOrigin.y}` }}
                  />
                </div>
              </div>

              <div className="detail-footer">
                <p className="detail-description">{selectedAlert.text}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedAlert && isFullscreen && (
        <div className="fullscreen-image-viewer" onWheel={handleMouseWheel}>
          <div className="fullscreen-controls">
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button className="zoom-btn reset" onClick={() => { setZoomLevel(1); setTransformOrigin({ x: '50%', y: '50%' }); }} title="Reset zoom (R)">↻</button>
            <button className="zoom-btn fullscreen-btn" onClick={toggleFullscreen} title="Exit fullscreen (ESC)">⛶</button>
          </div>
          <div className="fullscreen-viewport" onWheel={handleMouseWheel} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
            <img
              src={selectedAlert.imageUrl}
              alt="Alert fullscreen"
              ref={fsImgRef}
              style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${zoomLevel})`, transformOrigin: `${transformOrigin.x} ${transformOrigin.y}` }}
            />
          </div>
        </div>
      )}
    </main>
  );
}