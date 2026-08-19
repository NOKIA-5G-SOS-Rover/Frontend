import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const filters = ['all', 'critical', 'warning', 'info'];

const statusOptions = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'confirmed-threat', label: 'Confirmed threat' },
  { value: 'false-alarm', label: 'False alarm' },
];

const formatTime = (timestamp) => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}).format(new Date(timestamp));

const getStatusLabel = (status) => (
  statusOptions.find((option) => option.value === status)?.label || 'Unverified'
);

const isInspectableAlarm = (event) => (
  Boolean(event?.imageUrl)
  || event?.severity === 'critical'
  || event?.severity === 'warning'
);

const getDetectionImageUrl = (event) => {
  if (event?.imageUrl) return event.imageUrl;

  const eventText = `${event?.type || ''} ${event?.title || ''}`.toLowerCase();

  if (eventText.includes('thermal') || eventText.includes('heat')) {
    return '/detections/thermal-anomaly.svg';
  }

  if (eventText.includes('movement') || eventText.includes('motion')) {
    return '/detections/movement-detected.svg';
  }

  if (eventText.includes('sos')) {
    return '/detections/sos-signal.svg';
  }

  return event?.severity === 'critical'
    ? '/detections/person-detected.svg'
    : '/detections/thermal-anomaly.svg';
};

function EventStatusSelector({ event, onStatusChange, inModal = false }) {
  return (
    <div
      className={`event-status-selector ${inModal ? 'event-status-selector--modal' : ''}`}
      aria-label={`Verification status for ${event.title}`}
      onClick={(clickEvent) => clickEvent.stopPropagation()}
    >
      {statusOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={[
            'event-status-btn',
            `event-status-btn--${option.value}`,
            event.verificationStatus === option.value ? 'active' : '',
          ].filter(Boolean).join(' ')}
          aria-pressed={event.verificationStatus === option.value}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            onStatusChange(event.id, option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function LiveEventFeed({ events, onStatusChange, connectionStatus = 'live', canRespondToAlerts = true }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);

  // Keep the live stream defensively capped at the 12 newest events supplied by App.
  const retainedEvents = useMemo(() => events.slice(0, 12), [events]);

  const visibleEvents = useMemo(() => (
    activeFilter === 'all'
      ? retainedEvents
      : retainedEvents.filter((event) => event.severity === activeFilter)
  ), [activeFilter, retainedEvents]);

  const selectedEvent = useMemo(
    () => retainedEvents.find((event) => event.id === selectedEventId) || null,
    [retainedEvents, selectedEventId]
  );

  const severityCounts = useMemo(() => ({
    all: retainedEvents.length,
    critical: retainedEvents.filter((event) => event.severity === 'critical').length,
    warning: retainedEvents.filter((event) => event.severity === 'warning').length,
    info: retainedEvents.filter((event) => event.severity === 'info').length,
  }), [retainedEvents]);

  useEffect(() => {
    if (!selectedEvent) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        setSelectedEventId(null);
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedEvent]);

  const openDetection = (event) => {
    if (!isInspectableAlarm(event)) return;
    setImageFailed(false);
    setSelectedEventId(event.id);
  };

  const closeDetection = () => {
    setSelectedEventId(null);
    setImageFailed(false);
  };

  const handleEventKeyDown = (keyboardEvent, event) => {
    if (
      keyboardEvent.target !== keyboardEvent.currentTarget
      || !isInspectableAlarm(event)
    ) return;

    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault();
      openDetection(event);
    }
  };

  return (
    <>
      <section className="widget live-feed-widget" aria-labelledby="live-feed-title">
        <div className="live-feed-header">
          <div className="live-feed-heading-copy">
            <div className="live-feed-title-row">
              <h3 className="widget-title" id="live-feed-title">Live event feed</h3>
              <span className="live-status">
                <span className="live-status-dot"></span>
                {connectionStatus}
              </span>
            </div>
            <p className="live-feed-subtitle">Rover, camera, and AI/ML events</p>
          </div>

          <div className="live-feed-filters" aria-label="Filter events by severity">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`live-filter-btn live-filter-btn--${filter} ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
                aria-pressed={activeFilter === filter}
              >
                <span>{filter}</span>
                <strong>{severityCounts[filter]}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="live-events-list" aria-live="polite">
          {visibleEvents.length === 0 ? (
            <div className="live-feed-empty">
              <span className="live-feed-empty__icon" aria-hidden="true">◎</span>
              <strong>No events match this filter.</strong>
              <span>Choose another severity to return to the active stream.</span>
            </div>
          ) : visibleEvents.map((event, index) => {
            const isReviewable = event.verificationStatus !== null;
            const hasDetection = isInspectableAlarm(event);

            return (
              <article
                key={event.id}
                className={[
                  'live-event-item',
                  `severity-${event.severity}`,
                  isReviewable ? `verification-${event.verificationStatus}` : '',
                  hasDetection ? 'has-detection' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => openDetection(event)}
                onKeyDown={(keyboardEvent) => handleEventKeyDown(keyboardEvent, event)}
                role={hasDetection ? 'button' : undefined}
                tabIndex={hasDetection ? 0 : undefined}
                aria-label={hasDetection ? `Inspect detected frame: ${event.title}` : undefined}
              >
                <div className="live-event-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
                <div className="live-event-severity-marker" aria-hidden="true" />

                <div className="live-event-main">
                  <div className="live-event-topline">
                    <strong>{event.title}</strong>
                    <time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time>
                  </div>

                  <p>{event.description}</p>

                  <div className="live-event-meta">
                    <span className={`severity-label ${event.severity}`}>{event.severity}</span>
                    {event.cameraId && <span>{event.cameraId}</span>}
                    {event.location && <span>{event.location}</span>}
                    {event.confidence !== null && event.confidence !== undefined && (
                      <span>{event.confidence}% confidence</span>
                    )}
                  </div>

                  {event.confidence !== null && (
                    <div className="live-event-confidence" aria-label={`Confidence ${event.confidence} percent`}>
                      <span style={{ width: `${event.confidence}%` }} />
                    </div>
                  )}

                  {hasDetection && (
                    <span className="inspect-detection-hint">Inspect detected frame <i aria-hidden="true">↗</i></span>
                  )}
                </div>

                <div className="live-event-actions">
                  {isReviewable ? (
                    <>
                      <span className={`current-verification-status status-${event.verificationStatus}`}>
                        {getStatusLabel(event.verificationStatus)}
                      </span>
                      {canRespondToAlerts && (
                        <EventStatusSelector
                          event={event}
                          onStatusChange={onStatusChange}
                        />
                      )}
                    </>
                  ) : (
                    <span className="system-event-label">System event</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {selectedEvent && createPortal(
        <div
          className="detection-modal-backdrop"
          role="presentation"
          onMouseDown={closeDetection}
        >
          <section
            className="detection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detection-modal-title"
            onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <button
              type="button"
              className="detection-modal-close"
              onClick={closeDetection}
              aria-label="Close detected frame"
            >
              &times;
            </button>

            <div className="detection-modal-media">
              <div className="detection-modal-image-area">
                {!imageFailed ? (
                <img
                  src={getDetectionImageUrl(selectedEvent)}
                  alt={`Detected frame for ${selectedEvent.title}`}
                  className="detection-modal-image"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="detection-image-fallback">
                  <span>Detection frame unavailable</span>
                  <small>Add the image in public/detections or use a backend image URL.</small>
                </div>
              )}
                <div className="detection-modal-image-overlay" aria-hidden="true">
                  <span>{selectedEvent.cameraId || 'ROVER SENSOR'}</span>
                  <span>{formatTime(selectedEvent.timestamp)}</span>
                </div>
              </div>
            </div>

            <div className="detection-modal-content">
              <div className="detection-modal-details">
                <div className="detection-modal-heading">
                <div>
                  <span className="detection-modal-eyebrow">Detected frame</span>
                  <h2 id="detection-modal-title">{selectedEvent.title}</h2>
                </div>

                <span className={`current-verification-status status-${selectedEvent.verificationStatus}`}>
                  {getStatusLabel(selectedEvent.verificationStatus)}
                </span>
                </div>

              <p className="detection-modal-description">{selectedEvent.description}</p>

              <div className="detection-modal-meta">
                <span>{selectedEvent.cameraId}</span>
                <span>{selectedEvent.location}</span>
                {selectedEvent.confidence !== null && selectedEvent.confidence !== undefined && (
                  <span>{selectedEvent.confidence}% confidence</span>
                )}
                  <span>{formatTime(selectedEvent.timestamp)}</span>
                </div>
              </div>

              {selectedEvent.verificationStatus !== null && canRespondToAlerts && (
                <div className="detection-modal-review">
                  <span className="detection-modal-review-label">Operator assessment</span>
                  <EventStatusSelector
                    event={selectedEvent}
                    onStatusChange={onStatusChange}
                    inModal
                  />
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}