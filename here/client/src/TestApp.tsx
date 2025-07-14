import React from 'react';

export default function TestApp() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1a1a2e', 
      color: 'white', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        DGVRP Law Enforcement Database
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
        Application is loading successfully!
      </p>
      <div style={{ padding: '1rem', backgroundColor: '#16213e', borderRadius: '8px' }}>
        <p>React app is working correctly</p>
      </div>
    </div>
  );
}