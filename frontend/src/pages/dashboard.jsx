import React from "react";
import "./dashboard.css";
import Navbar from "../components/Navbar";

const Dashboard = () => {
  const isAuth = Boolean(localStorage.getItem("token"));

  return (
    <>
      <Navbar isAuth={isAuth} />
      
      <div className="content">
        <h2>Dashboard</h2>

        <div className="cards">
          <div className="dashboard-card">
            <div className="icon">⚠️</div>
            <h3>1</h3>
            <p>Total Issues</p>
          </div>

          <div className="dashboard-card">
            <div className="icon">🕒</div>
            <h3>1</h3>
            <p>Pending</p>
          </div>

          <div className="dashboard-card">
            <div className="icon">⚙️</div>
            <h3>0</h3>
            <p>In Progress</p>
          </div>

          <div className="dashboard-card">
            <div className="icon">✔️</div>
            <h3>0</h3>
            <p>Resolved</p>
          </div>
        </div>

        <div className="lower-grid">
          <div className="activity">
            <h4>Recent Activity</h4>
            <div className="activity-item">
              Pothole on Main Street resolved
              <span>2 hours ago</span>
            </div>
          </div>

          <div className="actions">
            <h4>Quick Actions</h4>
            <button className="primary">+ Report New Issue</button>
            <button className="secondary">View All Complaints</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
