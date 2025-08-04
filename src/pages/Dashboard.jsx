import React from 'react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-card shadow-sm">
        <h5>Deployments</h5>
        <p>Manage your active and past deployments</p>
      </div>
      <div className="dashboard-card shadow-sm">
        <h5>Usage</h5>
        <p>View CPU, memory, and bandwidth stats</p>
      </div>
      <div className="dashboard-card shadow-sm">
        <h5>Environments</h5>
        <p>Create and manage staging/production environments</p>
      </div>
    </div>
  );
};

export default Dashboard;
