import React, { useState, useEffect, useRef, useMemo } from 'react';

const getAlertKey = (alert) =>
  alert.sourceId || `${alert.date}-${alert.text}`;

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

export default function PastAlertsView({
  liveEvents = [],
  focusedAlertId = null,
  connection,
}) {
  const [pastAlerts, setPastAlerts] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [dateFilter, setDateFilter] = useState({
    month: '',
    day: '',
    year: '',
  });
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [transformOrigin, setTransformOrigin] = useState({
    x: '50%',
    y: '50%',
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const detailImgRef = useRef(null);
  const fsImgRef = useRef(null);

  const backendUrl =
    process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const formatEvent = (event) => {
    const date = new Date(event.timestamp);

    return {
      date: date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      text:
        `${event.alertType} - ${event.source} - ` +
        `Confidence ${event.confidenceScore}% - ` +
        `Location: X:${event.locationX} Y:${event.locationY}`,
      tags: ['confidence', 'location'],
      month: date.toLocaleDateString('en-US', {
        month: 'long',
      }),
      day: `${date.getDate()}`,
      year: `${date.getFullYear()}`,
      imageUrl: event.imageUrl
        ? `${backendUrl}${event.imageUrl}`
        : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 800 600%22%3E%3Crect fill=%22%23000%22 width=%22800%22 height=%22600%22/%3E%3Ctext x=%22400%22 y=%22310%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2220%22%3ENo Image Provided%3C/text%3E%3C/svg%3E',
      confidence: event.confidenceScore,
      sourceId: event.id,
    };
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setTransformOrigin({
      x: '50%',
      y: '50%',
    });
  };

  const openAlert = (alert) => {
    setSelectedAlert(alert);
    resetZoom();
    setIsFullscreen(false);
  };

  const closeDetail = () => {
    setSelectedAlert(null);
    resetZoom();
    setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((current) => {
      if (!current) {
        resetZoom();
      }

      return !current;
    });
  };

  const handleMouseWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const delta = event.deltaY > 0 ? -0.2 : 0.2;

    setZoomLevel((previous) => {
      const next = Math.max(1, Math.min(3, previous + delta));

      let image = isFullscreen
        ? fsImgRef.current
        : detailImgRef.current;

      if (!image && event.target) {
        image =
          event.target.closest &&
          event.target.closest('img');
      }

      if (image) {
        const rect = image.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        const originX = Math.max(
          0,
          Math.min(100, (offsetX / rect.width) * 100)
        );

        const originY = Math.max(
          0,
          Math.min(100, (offsetY / rect.height) * 100)
        );

        setTransformOrigin({
          x: `${originX}%`,
          y: `${originY}%`,
        });
      }

      if (next === 1) {
        setTransformOrigin({
          x: '50%',
          y: '50%',
        });
      }

      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (selectedAlert) {
          closeDetail();
        }
      }

      if (
        selectedAlert &&
        event.key.toLowerCase() === 'r'
      ) {
        resetZoom();
      }

      if (
        selectedAlert &&
        event.key.toLowerCase() === 'f'
      ) {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
  }, [isFullscreen, selectedAlert]);

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isFullscreen]);

  // Initial fetch of Past Alerts
  useEffect(() => {
    const fetchPastAlerts = async () => {
      try {
        const response = await fetch(
          `${backendUrl}/events`
        );

        if (response.ok) {
          const data = await response.json();

          setPastAlerts(
            data.map(formatEvent)
          );
        }
      } catch (error) {
        console.error(
          'Error fetching past alerts:',
          error
        );
      }
    };

    fetchPastAlerts();
  }, [backendUrl]);

  // Hook into the shared SignalR connection for real-time appends
  useEffect(() => {
    if (!connection) {
      return undefined;
    }

    const handleNewAlert = (alert) => {
      if (alert) {
        setPastAlerts((previous) => [
          formatEvent(alert),
          ...previous,
        ]);
      }
    };

    connection.on(
      'ReceiveAlert',
      handleNewAlert
    );

    return () => {
      connection.off(
        'ReceiveAlert',
        handleNewAlert
      );
    };
  }, [connection]);

  const liveCriticalAlerts = useMemo(() => {
    return liveEvents
      .filter(
        (event) =>
          event.severity === 'critical'
      )
      .map((event) => {
        const date = new Date(
          event.timestamp
        );

        return {
          date: date.toLocaleDateString(
            'en-GB',
            {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }
          ),
          text:
            `${event.title} - ${event.description}` +
            `${
              event.confidence !== null &&
              event.confidence !== undefined
                ? ` - Confidence ${event.confidence}%`
                : ''
            }` +
            `${
              event.location
                ? ` - Location: ${event.location}`
                : ''
            }`,
          tags: [
            'confidence',
            ...(event.location
              ? ['location']
              : []),
          ],
          month: date.toLocaleDateString(
            'en-US',
            {
              month: 'long',
            }
          ),
          day: `${date.getDate()}`,
          year: `${date.getFullYear()}`,
          imageUrl:
            event.imageUrl ||
            '/detections/thermal-anomaly.svg',
          confidence:
            event.confidence ?? 100,
          sourceId: event.id,
          severity: event.severity,
          location:
            event.location ||
            'Rover perimeter',
          cameraId: event.cameraId,
          verificationStatus:
            event.verificationStatus,
          timestamp: event.timestamp,
        };
      });
  }, [liveEvents]);

  const allAlerts = useMemo(
    () => [
      ...liveCriticalAlerts,
      ...pastAlerts,
    ],
    [liveCriticalAlerts, pastAlerts]
  );

  const getDaysInMonth = (
    month,
    year
  ) => {
    if (!month) {
      return 31;
    }

    if (month === 'February') {
      const yearNumber = Number(year);

      const isLeap =
        yearNumber &&
        ((yearNumber % 4 === 0 &&
          yearNumber % 100 !== 0) ||
          yearNumber % 400 === 0);

      return isLeap ? 29 : 28;
    }

    return monthDayCounts[month] || 31;
  };

  useEffect(() => {
    if (!focusedAlertId) {
      return;
    }

    const matchingAlert = allAlerts.find(
      (alert) =>
        alert.sourceId === focusedAlertId
    );

    if (!matchingAlert) {
      return;
    }

    openAlert(matchingAlert);

    window.setTimeout(() => {
      document
        .getElementById(
          `past-alert-${focusedAlertId}`
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
    }, 0);
  }, [focusedAlertId, allAlerts]);

  const filteredAlerts = allAlerts.filter(
    (alert) => {
      const matchesCategoryFilters =
        activeFilters.every((filter) =>
          alert.tags.includes(filter)
        );

      const matchesConfidence =
        confidenceFilter === 'all' ||
        (confidenceFilter === 'high' &&
          alert.confidence >= 80) ||
        (confidenceFilter === 'medium' &&
          alert.confidence >= 50 &&
          alert.confidence < 80) ||
        (confidenceFilter === 'low' &&
          alert.confidence < 50);

      const matchesDateFilters = [
        !dateFilter.month ||
          alert.month ===
            dateFilter.month,
        !dateFilter.day ||
          alert.day === dateFilter.day,
        !dateFilter.year ||
          alert.year === dateFilter.year,
      ].every(Boolean);

      return (
        matchesCategoryFilters &&
        matchesConfidence &&
        matchesDateFilters
      );
    }
  );

  const toggleFilter = (filter) => {
    setActiveFilters(
      (currentFilters) =>
        currentFilters.includes(filter)
          ? currentFilters.filter(
              (item) => item !== filter
            )
          : [
              ...currentFilters,
              filter,
            ]
    );
  };

  const handleDateChange = (
    field,
    value
  ) => {
    setDateFilter((current) => {
      const nextFilter = {
        ...current,
        [field]: value,
      };

      if (
        field === 'month' ||
        field === 'year'
      ) {
        const maxDay = getDaysInMonth(
          nextFilter.month,
          nextFilter.year
        );

        if (
          nextFilter.day &&
          Number(nextFilter.day) > maxDay
        ) {
          nextFilter.day = '';
        }
      }

      return nextFilter;
    });
  };

  const activeFilterCount =
    activeFilters.length +
    (confidenceFilter === 'all' ? 0 : 1) +
    Object.values(dateFilter).filter(
      Boolean
    ).length;

  const archiveTotal = pastAlerts.length;

  const criticalTotal =
    pastAlerts.filter(
      (alert) =>
        alert.severity === 'critical'
    ).length;

  const averageConfidence =
    pastAlerts.length
      ? Math.round(
          pastAlerts.reduce(
            (sum, alert) =>
              sum + alert.confidence,
            0
          ) / pastAlerts.length
        )
      : 0;

  return (
    <main
      className="dashboard view active-view alerts-page"
      id="past-alerts-view"
    >
      <header className="alerts-page-header page-section">
        <h1>Past alerts</h1>

        <div
          className="archive-summary archive-summary--header"
          aria-label="Alert archive summary"
        >
          <span>
            <strong>{archiveTotal}</strong>{' '}
            archived
          </span>

          <span className="archive-summary__critical">
            <strong>{criticalTotal}</strong>{' '}
            critical
          </span>

          <span>
            <strong>
              {averageConfidence}%
            </strong>{' '}
            avg. confidence
          </span>
        </div>
      </header>

      <section className="alerts-workspace page-section">
        <div className="alerts-toolbar alerts-toolbar--filters-only">
          <div className="filter-container">
            <button
              type="button"
              className={`filter-btn ${
                isFilterOpen
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                setIsFilterOpen(
                  (current) => !current
                )
              }
              aria-expanded={isFilterOpen}
              aria-controls="past-alert-filters"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="icon-filter"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
                />
              </svg>

              <span>Filter archive</span>

              {activeFilterCount > 0 && (
                <strong>
                  {activeFilterCount}
                </strong>
              )}
            </button>

            <div
              id="past-alert-filters"
              className={`filter-dropdown ${
                isFilterOpen
                  ? ''
                  : 'hidden'
              }`}
            >
              <div className="filter-dropdown__heading">
                <span>Refine results</span>
                <small>
                  {filteredAlerts.length}{' '}
                  visible
                </small>
              </div>

              <div className="filter-checks">
                <label className="filter-option filter-option--select">
                  <span>Confidence</span>

                  <select
                    value={confidenceFilter}
                    onChange={(event) =>
                      setConfidenceFilter(
                        event.target.value
                      )
                    }
                    aria-label="Filter alerts by confidence range"
                  >
                    <option value="all">
                      Any range
                    </option>

                    <option value="high">
                      High · 80–100%
                    </option>

                    <option value="medium">
                      Medium · 50–79%
                    </option>

                    <option value="low">
                      Low · 0–49%
                    </option>
                  </select>
                </label>

                <label className="filter-option">
                  <span>Has location</span>

                  <input
                    type="checkbox"
                    name="filter"
                    value="location"
                    checked={activeFilters.includes(
                      'location'
                    )}
                    onChange={() =>
                      toggleFilter(
                        'location'
                      )
                    }
                  />
                </label>
              </div>

              <div className="filter-option date-filter-group">
                <span>Date</span>

                <div className="date-filter-controls">
                  <label className="date-select-wrapper">
                    <span className="date-select-label">
                      Month
                    </span>

                    <select
                      value={dateFilter.month}
                      onChange={(event) =>
                        handleDateChange(
                          'month',
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Any
                      </option>

                      {Object.keys(
                        monthDayCounts
                      ).map((month) => (
                        <option
                          key={month}
                          value={month}
                        >
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="date-select-wrapper">
                    <span className="date-select-label">
                      Day
                    </span>

                    <select
                      value={dateFilter.day}
                      onChange={(event) =>
                        handleDateChange(
                          'day',
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Any
                      </option>

                      {Array.from(
                        { length: 31 },
                        (_, index) => {
                          const day =
                            index + 1;

                          const isDisabled =
                            day >
                            getDaysInMonth(
                              dateFilter.month,
                              dateFilter.year
                            );

                          return (
                            <option
                              key={day}
                              value={`${day}`}
                              disabled={
                                isDisabled
                              }
                            >
                              {day}
                            </option>
                          );
                        }
                      )}
                    </select>
                  </label>

                  <label className="date-select-wrapper">
                    <span className="date-select-label">
                      Year
                    </span>

                    <select
                      value={dateFilter.year}
                      onChange={(event) =>
                        handleDateChange(
                          'year',
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Any
                      </option>

                      <option value="2025">
                        2025
                      </option>

                      <option value="2026">
                        2026
                      </option>
                    </select>
                  </label>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="date-clear-btn"
                  onClick={() => {
                    setActiveFilters([]);
                    setConfidenceFilter(
                      'all'
                    );
                    setDateFilter({
                      month: '',
                      day: '',
                      year: '',
                    });
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className={`alerts-content-wrapper ${
            selectedAlert
              ? 'with-panel'
              : ''
          }`}
        >
          <div
            className={`alerts-list-container ${
              selectedAlert
                ? 'with-panel'
                : ''
            }`}
          >
            <div
              className="alerts-list-header"
              aria-hidden="true"
            >
              <span>Event</span>
              <span>Confidence</span>
              <span>Status</span>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="live-feed-empty">
                {allAlerts.length === 0
                  ? 'No alerts found in the database.'
                  : 'No alerts match this filter.'}
              </div>
            ) : (
              <ul className="alerts-list">
                {filteredAlerts.map(
                  (alert) => {
                    const alertKey =
                      getAlertKey(alert);

                    return (
                      <li
                        key={alertKey}
                        id={
                          alert.sourceId
                            ? `past-alert-${alert.sourceId}`
                            : undefined
                        }
                        className={`alert-item ${
                          selectedAlert &&
                          getAlertKey(
                            selectedAlert
                          ) === alertKey
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          openAlert(alert)
                        }
                      >
                        <div className="alert-dot" />

                        <div className="alert-content-wrapper">
                          <div className="alert-date">
                            {alert.date}
                          </div>

                          <div className="alert-text">
                            {alert.text}
                          </div>
                        </div>
                      </li>
                    );
                  }
                )}
              </ul>
            )}
          </div>

          {selectedAlert && (
            <aside
              className="event-detail-panel"
              aria-label="Selected alert details"
            >
              <div className="detail-header">
                <div>
                  <h3>
                    Event details
                  </h3>
                </div>

                <button
                  type="button"
                  className="close-detail-btn"
                  onClick={closeDetail}
                  aria-label="Close event details"
                >
                  ×
                </button>
              </div>

              <div className="detail-body">
                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">
                      Date
                    </span>

                    <span className="info-value">
                      {selectedAlert.date}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">
                      Location
                    </span>

                    <span className="info-value">
                      {selectedAlert.location ||
                        'Unavailable'}
                    </span>
                  </div>

                  <div className="info-row info-row--confidence">
                    <span className="info-label">
                      Confidence
                    </span>

                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${selectedAlert.confidence}%`,
                        }}
                      />

                      <span className="confidence-text">
                        {
                          selectedAlert.confidence
                        }
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <div className="image-viewer-container">
                  <div className="image-controls">
                    <span className="zoom-level">
                      {Math.round(
                        zoomLevel * 100
                      )}
                      %
                    </span>

                    <button
                      type="button"
                      className="zoom-btn reset"
                      onClick={resetZoom}
                      title="Reset zoom (R)"
                      aria-label="Reset zoom"
                    >
                      ↻
                    </button>

                    <button
                      type="button"
                      className="zoom-btn fullscreen-btn"
                      onClick={
                        toggleFullscreen
                      }
                      title="Toggle fullscreen (F)"
                      aria-label="Open image fullscreen"
                    >
                      ⛶
                    </button>
                  </div>

                  <div
                    className="image-viewport"
                    onWheel={
                      handleMouseWheel
                    }
                    onClick={
                      toggleFullscreen
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          'Enter' ||
                        event.key === ' '
                      ) {
                        event.preventDefault();
                        toggleFullscreen();
                      }
                    }}
                    role="button"
                    tabIndex="0"
                    aria-label="Open alert evidence fullscreen"
                  >
                    <img
                      key={getAlertKey(
                        selectedAlert
                      )}
                      src={
                        selectedAlert.imageUrl
                      }
                      alt={`Alert evidence from ${selectedAlert.date}`}
                      className="detail-image"
                      ref={detailImgRef}
                      style={{
                        position:
                          'absolute',
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) scale(${zoomLevel})`,
                        transformOrigin: `${transformOrigin.x} ${transformOrigin.y}`,
                      }}
                    />

                    <span
                      className="image-viewport__reticle"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className="detail-footer">
                  <span
                    className={`alert-severity alert-severity--${selectedAlert.severity}`}
                  >
                    {selectedAlert.severity}
                  </span>

                  <p className="detail-description">
                    {selectedAlert.text}
                  </p>

                  <small>
                    Scroll over the image to
                    zoom. Press R to reset or
                    F for fullscreen.
                  </small>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>

      {selectedAlert &&
        isFullscreen && (
          <div
            className="fullscreen-image-viewer"
            onWheel={handleMouseWheel}
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen alert evidence"
          >
            <div className="fullscreen-viewer-header">
              <div>
                <span>
                  {selectedAlert.date}
                </span>

                <strong>
                  {
                    selectedAlert.text.split(
                      ' - '
                    )[0]
                  }
                </strong>
              </div>

              <button
                type="button"
                onClick={
                  toggleFullscreen
                }
                aria-label="Exit fullscreen"
              >
                ×
              </button>
            </div>

            <div className="fullscreen-controls">
              <span className="zoom-level">
                {Math.round(
                  zoomLevel * 100
                )}
                %
              </span>

              <button
                type="button"
                className="zoom-btn reset"
                onClick={resetZoom}
                title="Reset zoom (R)"
              >
                ↻
              </button>

              <button
                type="button"
                className="zoom-btn fullscreen-btn"
                onClick={
                  toggleFullscreen
                }
                title="Exit fullscreen (ESC)"
              >
                ⛶
              </button>
            </div>

            <div
              className="fullscreen-viewport"
              onWheel={handleMouseWheel}
            >
              <img
                src={
                  selectedAlert.imageUrl
                }
                alt={`Alert evidence fullscreen from ${selectedAlert.date}`}
                ref={fsImgRef}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: `${transformOrigin.x} ${transformOrigin.y}`,
                }}
              />
            </div>
          </div>
        )}

      <footer className="site-footer site-footer--light">
        <span>
          NOKIA · 5G SOS ROVER
        </span>

        <span>
          SÂNZI CONTROL INTERFACE /
          2026
        </span>
      </footer>
    </main>
  );
}