import React, { useEffect, useState } from 'react';
import './App.css';
import './fullscreen-viewer.css';
import './fullscreen-zoom-styles.css';
import HomeView from './components/HomeView';
import CamerasView from './components/CamerasView';
import PastAlertsView from './components/PastAlertsView';
import { createMockEvent, createSOSEvent, initialMockEvents } from './data/mockEvents';

export default function App() {
  const [currentView, setCurrentView] = useState('home-view');
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [liveEvents, setLiveEvents] = useState(initialMockEvents);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveEvents((currentEvents) => [createMockEvent(), ...currentEvents].slice(0, 12));
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, []);

  const acknowledgeEvent = (eventId) => {
    setLiveEvents((currentEvents) => currentEvents.map((event) => (
      event.id === eventId ? { ...event, acknowledged: true } : event
    )));
  };

  const simulateSOS = () => {
    setCurrentView('home-view');
    setIsAlertVisible(true);
    setLiveEvents((currentEvents) => [createSOSEvent(), ...currentEvents].slice(0, 12));
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  return (
    <div>
      <nav className="navbar">
        <div className="nav-links">
          <a href="#" 
             className={`nav-item ${currentView === 'home-view' ? 'active' : ''}`} 
             onClick={(e) => { e.preventDefault(); setCurrentView('home-view'); }}>home</a>
          <div className="nav-divider"></div>
          
          <a href="#" 
             className={`nav-item ${currentView === 'cameras-view' ? 'active' : ''}`} 
             onClick={(e) => { e.preventDefault(); setCurrentView('cameras-view'); }}>cameras</a>
          <div className="nav-divider"></div>
          
          <a href="#" 
             className={`nav-item ${currentView === 'past-alerts-view' ? 'active' : ''}`} 
             onClick={(e) => { e.preventDefault(); setCurrentView('past-alerts-view'); }}>past alerts</a>
        </div>
        <button id="simulate-sos-btn" className="visible-btn" onClick={simulateSOS}>
          Simulate SOS
        </button>
      </nav>

      {/* Conditionally render the views based on state */}
      {currentView === 'home-view' && (
        <HomeView 
          isAlertVisible={isAlertVisible} 
          closeAlert={() => setIsAlertVisible(false)}
          onAlertClick={() => setCurrentView('past-alerts-view')}
          liveEvents={liveEvents}
          onAcknowledgeEvent={acknowledgeEvent}
        />
      )}
      {currentView === 'cameras-view' && <CamerasView />}
      {currentView === 'past-alerts-view' && <PastAlertsView liveEvents={liveEvents} />}
    </div>
  );
}