import React, { useMemo, useState } from 'react';

const filters = ['all', 'critical', 'warning', 'info'];

const formatTime = (timestamp) => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}).format(new Date(timestamp));

export default function LiveEventFeed({ events, onAcknowledge }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const visibleEvents = useMemo(() => (
    activeFilter === 'all'
      ? events
      : events.filter((event) => event.severity === activeFilter)
  ), [activeFilter, events]);

  return (
    <section className="widget live-feed-widget" aria-labelledby="live-feed-title">
      <div className="live-feed-header">
        <div>
          <div className="live-feed-title-row">
            <h3 className="widget-title" id="live-feed-title">live event feed</h3>
            <span className="live-status"><span className="live-status-dot"></span>mock live</span>
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
        ) : visibleEvents.map((event) => (
          <article key={event.id} className={`live-event-item severity-${event.severity} ${event.acknowledged ? 'acknowledged' : ''}`}>
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
            </div>
            {event.severity === 'critical' && (
              <button
                type="button"
                className="acknowledge-btn"
                disabled={event.acknowledged}
                onClick={() => onAcknowledge(event.id)}
              >
                {event.acknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
