import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { HubConnectionState } from '@microsoft/signalr';
import LiveEventFeed from './LiveEventFeed';
import AmbientSignalField from './AmbientSignalField';
import { formatChartDate, toLocalDateKey } from '../data/archiveAlerts';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const getDateRange = (startDate, endDate) => {
  const start = new Date(Math.min(startDate.getTime(), endDate.getTime()));
  const end = new Date(Math.max(startDate.getTime(), endDate.getTime()));
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.slice(-31);
};

const getRecentDates = (count = 7, referenceDate = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return date;
  });
};

export default function HomeView({ 
  activeCriticalAlert, 
  closeAlert, 
  onAlertClick, 
  onOpenPastAlert, 
  onExploreRover, 
  liveEvents,
  allEvents = [],
  batteryLevel = null,
  responseTimeMs = null,
  onUpdateEventStatus,
  connection // Added connection prop
}) {
  const [todayReference, setTodayReference] = useState(() => new Date());
  const recentDates = useMemo(() => getRecentDates(7, todayReference), [todayReference]);
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setTodayReference((previous) => (
        toLocalDateKey(previous) === toLocalDateKey(now) ? previous : now
      ));
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const [intervalStart, setIntervalStart] = useState(() => recentDates[0]);
  const [intervalEnd, setIntervalEnd] = useState(() => recentDates[6]);
  const [chartDates, setChartDates] = useState(() => recentDates);
  const [selectedChartDate, setSelectedChartDate] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); // Added missing state

  useEffect(() => {
    setIntervalStart(recentDates[0]);
    setIntervalEnd(recentDates[recentDates.length - 1]);
    setChartDates(recentDates);
    setSelectedChartDate(null);
  }, [recentDates]);

  const actualAlertEvents = useMemo(() => (
    allEvents.filter((event) => (
      event?.timestamp
      && (event.severity === 'critical' || event.severity === 'warning')
    ))
  ), [allEvents]);

  const alertsByDate = useMemo(() => actualAlertEvents.reduce((map, alert) => {
    const alertDate = new Date(alert.timestamp);
    if (Number.isNaN(alertDate.getTime())) return map;

    const dateKey = toLocalDateKey(alertDate);
    const current = map.get(dateKey) || [];
    current.push(alert);
    map.set(dateKey, current);
    return map;
  }, new Map()), [actualAlertEvents]);

  const chartData = useMemo(() => ({
    labels: chartDates.map(formatChartDate),
    datasets: [{
      label: 'Past Alerts',
      data: chartDates.map((date) => (alertsByDate.get(toLocalDateKey(date)) || []).length),
      backgroundColor: '#5f8fff',
      hoverBackgroundColor: '#FFA500',
      borderRadius: 999,
      borderSkipped: false,
      borderWidth: 0,
      barThickness: 20
    }]
  }), [chartDates, alertsByDate]);

  // Handle local SignalR connection state tracking
  useEffect(() => {
    if (!connection) return;

    const updateStatus = () => {
      if (connection.state === HubConnectionState.Connected) {
        setWsStatus('live');
      } else if (connection.state === HubConnectionState.Connecting || connection.state === HubConnectionState.Reconnecting) {
        setWsStatus('connecting...');
      } else {
        setWsStatus('disconnected');
      }
    };

    // Call initially
    updateStatus();

    // Setup reconnect handlers on the connection instance
    connection.onreconnecting(() => setWsStatus('connecting...'));
    connection.onreconnected(() => setWsStatus('live'));
    connection.onclose(() => setWsStatus('disconnected'));

    // Example of handling custom events locally (if you wanted to do local charting logic, etc)
    const handleReceiveAlert = (alert) => {
      // You can put local component logic here, App.js handles the main state
    };
    connection.on('ReceiveAlert', handleReceiveAlert);

    return () => {
      connection.off('ReceiveAlert', handleReceiveAlert);
    };
  }, [connection]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutQuart' },
    onClick: (_event, elements) => {
      if (elements.length) setSelectedChartDate(chartDates[elements[0].index]);
    },
    onHover: (event, elements) => {
      if (event.native?.target) event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#111722', titleColor: '#f7f4ee', bodyColor: '#cdd5df', padding: 12, cornerRadius: 10, displayColors: false },
    },
    scales: {
      y: { display: false, beginAtZero: true, grace: '12%' },
      x: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: { color: '#7f8995', font: { family: "'Inter Tight', 'Neue Haas Grotesk Text Pro', 'Helvetica Neue', Arial, sans-serif", size: 11, weight: 700 } },
      },
    },
  };

  const today = new Date(todayReference);
  today.setHours(0, 0, 0, 0);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const isCurrentMonth = currentViewDate.getFullYear() === currentMonthStart.getFullYear() && currentViewDate.getMonth() === currentMonthStart.getMonth();

  const changeMonth = (offset) => {
    setCurrentViewDate((previousDate) => {
      const next = new Date(previousDate.getFullYear(), previousDate.getMonth() + offset, 1);
      return next > currentMonthStart ? previousDate : next;
    });
  };

  const handleDayClick = (cellDate) => {
    if (cellDate > today) return; 
    if (intervalStart === null || (intervalStart !== null && intervalEnd !== null)) {
      setIntervalStart(cellDate);
      setIntervalEnd(null);
      return;
    }
    setIntervalEnd(cellDate);
    setChartDates(getDateRange(intervalStart, cellDate));
    setSelectedChartDate(null);
  };

  const renderCalendarDays = () => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let index = 0; index < firstDay; index += 1) days.push(<div key={`empty-${index}`} className="calendar-day empty" />);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = new Date(year, month, day);
      cellDate.setHours(0, 0, 0, 0);
      const cellTime = cellDate.getTime();
      const startTime = intervalStart ? intervalStart.getTime() : null;
      const endTime = intervalEnd ? intervalEnd.getTime() : null;
      const isFuture = cellTime > today.getTime();
      let classNames = 'calendar-day';
      if (isFuture) classNames += ' disabled';
      else if (startTime !== null && endTime === null && cellTime === startTime) classNames += ' interval-start';
      else if (startTime !== null && endTime !== null) {
        const actualStart = Math.min(startTime, endTime);
        const actualEnd = Math.max(startTime, endTime);
        if (cellTime === actualStart) classNames += ' interval-start';
        else if (cellTime === actualEnd) classNames += ' interval-end';
        else if (cellTime > actualStart && cellTime < actualEnd) classNames += ' interval-in-between';
      }
      days.push(<button type="button" key={day} className={classNames} onClick={isFuture ? undefined : () => handleDayClick(cellDate)} disabled={isFuture} aria-label={`${formatChartDate(cellDate)}${isFuture ? ', unavailable' : ''}`}>{day}</button>);
    }
    return days;
  };

  const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const criticalCount = liveEvents.filter((event) => event.severity === 'critical').length;
  const awaitingReviewCount = liveEvents.filter((event) => event.verificationStatus === 'unverified').length;
  const reviewedCount = liveEvents.filter((event) => (
    event.verificationStatus && event.verificationStatus !== 'unverified'
  )).length;

  const formatTelemetryMetric = (value, suffix) => {
    if (!Number.isFinite(value)) return '—';
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}${suffix}`;
  };

  const selectedDateAlerts = selectedChartDate
    ? [...(alertsByDate.get(toLocalDateKey(selectedChartDate)) || [])]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    : [];

  return (
    <main className="dashboard view active-view" id="home-view">
      <section className="hero-section" aria-labelledby="hero-title">
        <AmbientSignalField />
        <div className="hero-section__grid page-inner">
          <div className="hero-copy hero-copy--simplified">
            <div className="hero-title-wrap"><h1 id="hero-title" className="hero-title"><span>Meet Sânzi</span><em>the 5G SOS Rover</em></h1></div>
            <div className="hero-actions">
              <a className="hero-link hero-link--primary" href="#live-feed-title">Open live operations<span aria-hidden="true">↘</span></a>
              <button type="button" className="hero-link" onClick={onExploreRover}>Explore the rover<span aria-hidden="true">↗</span></button>
            </div>
            <dl className="hero-metrics" aria-label="Current rover status">
              <div><dt>Link</dt><dd><span className="metric-dot" aria-hidden="true" />5G / {wsStatus}</dd></div>
              <div><dt>Battery</dt><dd>{formatTelemetryMetric(batteryLevel, '%')}</dd></div>
              <div><dt>Response</dt><dd>{formatTelemetryMetric(responseTimeMs, ' ms')}</dd></div>
            </dl>
          </div>
        </div>
        <div className="alert-container" aria-live="assertive">
          {activeCriticalAlert ? (
            <div className="alert-content" role="alert">
              <button type="button" className="critical-alert-main" onClick={onAlertClick} aria-label={`Open alert: ${activeCriticalAlert.title}`}><span className="critical-alert-copy"><small>Critical event</small><span className="critical-alert-title">{activeCriticalAlert.title}</span></span><span className="critical-alert-open" aria-hidden="true">Open event ↗</span></button>
              <button type="button" className="close-alert" onClick={closeAlert} aria-label="Close alert">&times;</button>
            </div>
          ) : (
            <div className="alert-standby" role="status"><span className="alert-standby__marker" aria-hidden="true" /><span>Emergency channel clear</span><span>Monitoring all sectors</span></div>
          )}
        </div>
      </section>

      <section className="operations-section page-section">
        <div className="page-inner">
        <header className="section-heading section-heading--clean section-heading--minimal"><h2 id="operations-title">Data navigation</h2></header>
        <div className="operations-summary" aria-label="Event summary">
          <div className="summary-item"><span className="summary-item__label">Events in stream</span><strong>{liveEvents.length.toString().padStart(2, '0')}</strong><small>Most recent 12 retained</small></div>
          <div className="summary-item summary-item--critical"><span className="summary-item__label">Critical</span><strong>{criticalCount.toString().padStart(2, '0')}</strong><small>Highest operator priority</small></div>
          <div className="summary-item"><span className="summary-item__label">Awaiting review</span><strong>{awaitingReviewCount.toString().padStart(2, '0')}</strong><small>{reviewedCount} of {liveEvents.length} reviewed</small></div>
        </div>
        <div className="widgets-section">
          <article className="widget stats-widget">
            <div className="widget-heading">
              <div><span className="widget-eyebrow widget-eyebrow--haas">ALERT FREQUENCY</span><h3 className="widget-title">Past alerts stats</h3></div>
              {selectedChartDate ? <button type="button" className="chart-return-btn" onClick={() => setSelectedChartDate(null)}>Back to chart</button> : <span className="widget-meta">Latest 7 days</span>}
            </div>
            {selectedChartDate ? (
              <div className="hourly-alerts" aria-label={`Alerts from ${formatChartDate(selectedChartDate)}`}>
                <div className="hourly-alerts__date"><strong>{formatChartDate(selectedChartDate)}</strong><span>Filtered by hour</span></div>
                {selectedDateAlerts.length ? selectedDateAlerts.map((alert) => (
                  <button key={alert.id || alert.sourceId} type="button" className="hourly-alert-row" onClick={() => onOpenPastAlert(alert.id || alert.sourceId)}>
                    <time dateTime={alert.timestamp}>{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(alert.timestamp))}</time><span>{alert.title}</span><strong>{alert.confidence !== null && alert.confidence !== undefined ? `${alert.confidence}%` : '—'}</strong><i aria-hidden="true">↗</i>
                  </button>
                )) : <div className="hourly-alerts__empty">No archived AI detections for this day.</div>}
              </div>
            ) : <div className="chart-container"><Bar data={chartData} options={chartOptions} /></div>}
          </article>
          <article className="widget calendar-widget">
            <div className="calendar-header">
              <div><span className="widget-eyebrow widget-eyebrow--haas">REPORTING PERIOD</span><h3 className="widget-title">{`${monthNamesFull[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`}</h3></div>
              <div className="calendar-navigation"><button className="cal-nav" type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">←</button><button className="cal-nav" type="button" onClick={() => changeMonth(1)} disabled={isCurrentMonth} aria-label="Next month">→</button></div>
            </div>
            <div className="calendar-grid-header" aria-hidden="true"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
            <div className="calendar-grid">{renderCalendarDays()}</div>
          </article>
        </div>
        </div>
      </section>
      <section className="event-stream-section page-section"><LiveEventFeed events={liveEvents} onStatusChange={onUpdateEventStatus} /></section>
      <footer className="site-footer site-footer--light"><span>NOKIA · 5G SOS ROVER</span><span>SÂNZI CONTROL INTERFACE / 2026</span></footer>
    </main>
  );
}