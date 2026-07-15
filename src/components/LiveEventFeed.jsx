import React, { useEffect, useMemo, useState } from 'react';

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

export default function LiveEventFeed({ events, onStatusChange }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);

  const visibleEvents = useMemo(() => (
    activeFilter === 'all'
      ? events
      : events.filter((event) => event.severity === activeFilter)
  ), [activeFilter, events]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

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
    if (!event.imageUrl) return;
    setImageFailed(false);
    setSelectedEventId(event.id);
  };

  const closeDetection = () => {
    setSelectedEventId(null);
    setImageFailed(false);
  };

  const handleEventKeyDown = (keyboardEvent, event) => {
    if (keyboardEvent.target !== keyboardEvent.currentTarget || !event.imageUrl) return;

    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault();
      openDetection(event);
    }
  };

  return (
    <>
      <section className="widget live-feed-widget" aria-labelledby="live-feed-title">
        <div className="live-feed-header">
          <div>
            <div className="live-feed-title-row">
              <h3 className="widget-title" id="live-feed-title">live event feed</h3>
              <span className="live-status">
                <span className="live-status-dot"></span>
                mock live
              </span>
            </div>
            <p className="live-feed-subtitle">Simulated rover, camera, and AI/ML events</p>
          </div>

          <div className="live-feed-filters" aria-label="Filter events by severity">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`live-filter-btn ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="live-events-list" aria-live="polite">
          {visibleEvents.length === 0 ? (
            <div className="live-feed-empty">No events match this filter.</div>
          ) : visibleEvents.map((event) => {
            const isReviewable = event.verificationStatus !== null;
            const hasDetection = Boolean(event.imageUrl);

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
                <div className="live-event-severity-marker" aria-hidden="true"></div>

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
                    {event.confidence !== null && <span>{event.confidence}% confidence</span>}
                  </div>

                  {hasDetection && (
                    <span className="inspect-detection-hint">Click to inspect detected frame</span>
                  )}
                </div>

                <div className="live-event-actions">
                  {isReviewable ? (
                    <>
                      <span className={`current-verification-status status-${event.verificationStatus}`}>
                        {getStatusLabel(event.verificationStatus)}
                      </span>
                      <EventStatusSelector
                        event={event}
                        onStatusChange={onStatusChange}
                      />
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

      {selectedEvent && (
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

            <div className="detection-modal-image-area">
              {!imageFailed ? (
                <img
                  src={selectedEvent.imageUrl}
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
            </div>

            <div className="detection-modal-content">
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
                {selectedEvent.confidence !== null && (
                  <span>{selectedEvent.confidence}% confidence</span>
                )}
                <span>{formatTime(selectedEvent.timestamp)}</span>
              </div>

              {selectedEvent.verificationStatus !== null && (
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
        </div>
      )}
    </>
  );
}
