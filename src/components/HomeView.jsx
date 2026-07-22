import React, { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import LiveEventFeed from './LiveEventFeed';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function HomeView({ isAlertVisible, closeAlert, onAlertClick, liveEvents, onUpdateEventStatus }) {
  const [isSpecsVisible, setIsSpecsVisible] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [intervalStart, setIntervalStart] = useState(null);
  const [intervalEnd, setIntervalEnd] = useState(null);

  const [chartData, setChartData] = useState({
    labels: ['May 1st', 'May 2nd', 'May 3rd', 'May 4th', 'May 5th', 'May 6th', 'May 7th'],
    datasets: [{
      label: 'Past Alerts',
      data: [12, 35, 8, 28, 38, 15, 6],
      backgroundColor: '#ff2a2a',
      borderRadius: 4,
      borderWidth: 0,
      barThickness: 20
    }]


  });

  const formatDateForLabel = (date) => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate();
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";
    return `${monthNames[date.getMonth()]} ${day}${suffix}`;
  };

  const updateChartInterval = (startState, endState) => {
    if (!startState || !endState) return;

    const start = startState < endState ? startState : endState;
    const end = startState > endState ? startState : endState;

    const newLabels = [];
    const newData = [];

    let curr = new Date(start);
    while (curr <= end) {
      newLabels.push(formatDateForLabel(curr));
      newData.push(Math.floor(Math.random() * 50) + 5);
      curr.setDate(curr.getDate() + 1);
    }

    setChartData({
      labels: newLabels,
      datasets: [{
        label: 'Past Alerts',
        data: newData,
        backgroundColor: '#ff2a2a',
        borderRadius: 4,
        borderWidth: 0,
        barThickness: 20
      }]
    });
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#ff2a2a', bodyColor: '#fff', padding: 10, cornerRadius: 8 }
    },
    scales: {
      y: { display: false, beginAtZero: true },
      x: { grid: { display: false, drawBorder: false }, ticks: { color: '#8c93a1', font: { family: "'Inter', sans-serif", size: 11 } } }
    }
  };

  // Toggle the specs section open/closed.
  // Opening scrolls the specs section into view; closing scrolls back up to the prompt.
  const handleToggleSpecs = () => {
    if (!isSpecsVisible) {
      setIsSpecsVisible(true);
      setTimeout(() => {
        document.getElementById('specs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setIsSpecsVisible(false);
      document.querySelector('.scroll-prompt')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const isCurrentMonth =
    currentViewDate.getFullYear() === currentMonthStart.getFullYear() &&
    currentViewDate.getMonth() === currentMonthStart.getMonth();

  const changeMonth = (offset) => {
    setCurrentViewDate(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      // Don't allow navigating past the current month
      return next > currentMonthStart ? prev : next;
    });
  };

  const handleDayClick = (cellDate) => {
    if (cellDate > today) return; // block selecting future dates
    if (intervalStart === null || (intervalStart !== null && intervalEnd !== null)) {
      setIntervalStart(cellDate);
      setIntervalEnd(null);
    } else {
      setIntervalEnd(cellDate);
      updateChartInterval(intervalStart, cellDate);
    }
  };

  const renderCalendarDays = () => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const cellDate = new Date(year, month, i);
      cellDate.setHours(0,0,0,0);
      const tCell = cellDate.getTime();
      const tStart = intervalStart ? intervalStart.getTime() : null;
      const tEnd = intervalEnd ? intervalEnd.getTime() : null;

      const isFuture = tCell > today.getTime();

      let classNames = "calendar-day";
      if (isFuture) {
        classNames += " disabled";
      } else if (tStart !== null && tEnd === null && tCell === tStart) {
        classNames += " interval-start";
      } else if (tStart !== null && tEnd !== null) {
        const actualStart = Math.min(tStart, tEnd);
        const actualEnd = Math.max(tStart, tEnd);
        if (tCell === actualStart) classNames += " interval-start";
        else if (tCell === actualEnd) classNames += " interval-end";
        else if (tCell > actualStart && tCell < actualEnd) classNames += " interval-in-between";
      }

      days.push(
        <div
          key={i}
          className={classNames}
          onClick={isFuture ? undefined : () => handleDayClick(cellDate)}
          aria-disabled={isFuture}
        >
          {i}
        </div>
      );
    }
    return days;
  };

  const monthNamesFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <main className="dashboard view active-view" id="home-view">
      <div className="top-section">
        <div className="title-container">
          <h2 className="brand">Nokia</h2>
          <h1 className="main-title">Sânzi</h1>
        </div>

        <div className="alert-container">
          <button
            type="button"
            className={`alert-content ${isAlertVisible ? '' : 'hidden'}`}
            onClick={onAlertClick}
            aria-label="View past alerts"
          >
            <span className="pulse-ring"></span>
            <span className="alert-text">SOS Signal</span>
            <span className="close-alert" onClick={(event) => {
              event.stopPropagation();
              closeAlert();
            }} aria-label="Close Alert">&times;</span>
          </button>
        </div>
      </div>

      <div className="widgets-section">
        <div className="widget stats-widget">
          <h3 className="widget-title">Past alerts stats</h3>
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="widget calendar-widget">
          <div className="calendar-header">
            <button className="cal-nav" onClick={() => changeMonth(-1)} aria-label="Previous Month">&lt;</button>
            <h3 className="widget-title">{`${monthNamesFull[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`}</h3>
            <button
              className="cal-nav"
              onClick={() => changeMonth(1)}
              disabled={isCurrentMonth}
              aria-label="Next Month"
            >
              &gt;
            </button>
          </div>
          <div className="calendar-grid-header">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div className="calendar-grid">
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      <LiveEventFeed events={liveEvents} onStatusChange={onUpdateEventStatus} />

      <div className="scroll-prompt" onClick={handleToggleSpecs}>
        <span>{isSpecsVisible ? '↑ Hide specs' : '↓ View specs'}</span>
      </div>

      <section id="specs" className={`specs-section ${isSpecsVisible ? 'visible-specs' : 'hidden-specs'}`}>
        <h2 className="specs-title">Rover Specifications</h2>
        <div className="specs-grid">
          <div className="spec-card">
            <h4>Connectivity</h4>
            <p>Ultra-low latency 5G, Fallback LTE, Satellite Link, Mesh Network Support</p>
          </div>
          <div className="spec-card">
            <h4>Sensors & Cameras</h4>
            <p>360° LiDAR, 4K Thermal Imaging, Infrared Night Vision, Object Detection</p>
          </div>
          <div className="spec-card">
            <h4>Chassis & Mobility</h4>
            <p>Military-grade titanium alloy, All-terrain continuous tracks, IP68 Waterproof</p>
          </div>
          <div className="spec-card">
            <h4>Power & Battery</h4>
            <p>72h continuous operation, Solar auxiliary panels, Fast induction charging</p>
          </div>
        </div>
      </section>
    </main>
  );
}