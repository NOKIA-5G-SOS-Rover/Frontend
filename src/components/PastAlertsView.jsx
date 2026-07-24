import React, { useState, useEffect, useRef } from 'react';
import { useRover } from './RoverContext';

const getAlertKey = (alert) => (
  alert.sourceId || `${alert.date}-${alert.text}`
);

export default function PastAlertsView({ focusedAlertId = null }) {
  const { pastAlerts, requestPastAlerts, alertImages, requestAlertImage } = useRover();

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

  const openAlert = (alert) => {
    setSelectedAlert(alert);
    setZoomLevel(1);
    setTransformOrigin({ x: '50%', y: '50%' });
    if (alert.sourceId) {
      requestAlertImage(alert.sourceId);
    }
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

  // Ask the rover for the history again if the socket reconnected after this
  // view was already mounted (RoverProvider also requests it on every open).
  useEffect(() => {
    requestPastAlerts();
  }, [requestPastAlerts]);

  const allAlerts = pastAlerts.map((alert) => {
    const date = new Date(alert.timestamp);
    return {
      date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      text: `${alert.title} - ${alert.description}${alert.confidence !== null && alert.confidence !== undefined ? ` - Confidence ${alert.confidence}%` : ''}${alert.location ? ` - Location: ${alert.location}` : ''}`,
      tags: ['confidence', ...(alert.location ? ['location'] : [])],
      month: date.toLocaleDateString('en-US', { month: 'long' }),
      day: `${date.getDate()}`,
      year: `${date.getFullYear()}`,
      // Fallback placeholder shown only until the real photo arrives from the rover
      imageUrl: alert.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Ccircle cx=%22400%22 cy=%22300%22 r=%22120%22 fill=%22%23ff2a2a%22 opacity=%220.35%22/%3E%3Ctext x=%22400%22 y=%22310%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2224%22%3ENo Snapshot Yet%3C/text%3E%3C/svg%3E',
      confidence: alert.confidence ?? 100,
      sourceId: alert.id,
    };
  });

  useEffect(() => {
    if (!focusedAlertId) return;

    const matchingAlert = allAlerts.find((alert) => alert.sourceId === focusedAlertId);
    if (!matchingAlert) return;

    openAlert(matchingAlert);

    window.setTimeout(() => {
      document.getElementById(`past-alert-${focusedAlertId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 0);
    // The alert list is already populated before this view is mounted.
    // Re-running on each mock event would unnecessarily reset the open panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedAlertId]);

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

  // Prefer the photo pushed by the rover over whatever placeholder the alert shipped with
  const getDisplayImage = (alert) => {
    if (!alert) return null;
    if (alert.sourceId) {
      return {
        url: alertImages[alert.sourceId] || alert.imageUrl,
        isLoading: !alertImages[alert.sourceId],
      };
    }
    return { url: alert.imageUrl, isLoading: false };
  };

  const displayImage = getDisplayImage(selectedAlert);

  return (
    <main className="dashboard view active-view">
      <div className="top-section row-space">
        <div className="title-with-filter">
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
                  <div className="date-select-wrapper">
                    <label className="date-select-label">Month</label>
                    <select value={dateFilter.month} onChange={(e) => handleDateChange('month', e.target.value)}>
                      <option value="">Any</option>
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
                  </div>
                  <div className="date-select-wrapper">
                    <label className="date-select-label">Day</label>
                    <select value={dateFilter.day} onChange={(e) => handleDateChange('day', e.target.value)}>
                      <option value="">Any</option>
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
                  </div>
                  <div className="date-select-wrapper">
                    <label className="date-select-label">Year</label>
                    <select value={dateFilter.year} onChange={(e) => handleDateChange('year', e.target.value)}>
                      <option value="">Any</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                  </div>
                  {(dateFilter.month || dateFilter.day || dateFilter.year) && (
                    <button
                      type="button"
                      className="date-clear-btn"
                      onClick={() => setDateFilter({ month: '', day: '', year: '' })}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="alerts-content-wrapper">
        <div className={`alerts-list-container ${selectedAlert ? 'with-panel' : ''}`}>
          {filteredAlerts.length === 0 ? (
            <div className="live-feed-empty">
              {pastAlerts.length === 0 ? 'No past alerts received from the rover yet.' : 'No alerts match this filter.'}
            </div>
          ) : (
          <ul className="alerts-list">
            {filteredAlerts.map((alert) => {
              const alertKey = getAlertKey(alert);

              return (
              <li
                key={alertKey}
                id={alert.sourceId ? `past-alert-${alert.sourceId}` : undefined}
                className={`alert-item ${selectedAlert && getAlertKey(selectedAlert) === alertKey ? 'selected' : ''}`}
                onClick={() => openAlert(alert)}
              >
                <div className="alert-dot"></div>
                <div className="alert-content-wrapper">
                  <div className="alert-date">{alert.date}</div>
                  <div className="alert-text">{alert.text}</div>
                </div>
              </li>
              );
            })}
          </ul>
          )}
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
                  {displayImage?.isLoading && <span className="image-loading-badge">Fetching from rover…</span>}
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
                    key={getAlertKey(selectedAlert)}
                    src={displayImage.url}
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
              src={displayImage.url}
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