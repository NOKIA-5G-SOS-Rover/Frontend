import React, { useState } from 'react';

export default function PastAlertsView() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const mockAlerts = [
    { date: 'May 1st', text: 'SOS Signal sent - Person detected - Confidence 87% - Location: Sector A' },
    { date: 'May 2nd', text: 'High thermal anomaly detected - Heat signature matches human - Confidence 92%' },
    { date: 'May 3rd', text: 'Movement detected at grid Alpha - Visual confirmation failed - Confidence 45%' },
    { date: 'May 4th', text: 'SOS Signal sent - Multiple targets detected - Confidence 95%' },
    { date: 'May 7th', text: 'Proximity sensor triggered - Manual override requested' },
  ];

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
            <label className="filter-option"><input type="checkbox" name="filter" value="confidence" /> filter by confidence</label>
            <label className="filter-option"><input type="checkbox" name="filter" value="location" /> filter by location</label>
            <label className="filter-option"><input type="checkbox" name="filter" value="date" /> filter by date</label>
          </div>
        </div>
      </div>

      <div className="alerts-list-container">
        <ul className="alerts-list">
          {mockAlerts.map((alert, index) => (
            <li key={index} className="alert-item">
              <div className="alert-dot"></div>
              <div className="alert-content-wrapper">
                <div className="alert-date">{alert.date}</div>
                <div className="alert-text">{alert.text}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}