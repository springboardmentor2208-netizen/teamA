import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import { Toaster } from "react-hot-toast";

import LandingPage    from "./pages/LandingPage";
import Login          from "./pages/login";
import Register       from "./pages/register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard      from "./pages/dashboard";
import Profile        from "./pages/profile";
import OAuthSuccess   from "./pages/OAuthSuccess";
import ReportIssue    from "./pages/reportissue";
import Complaints     from "./pages/Complaints";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers     from "./pages/AdminUsers";
import AdminReports   from "./pages/AdminReports";

/* ================= AUTH CHECK ================= */

const RequireAuth = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

/* ================= ADMIN ROUTE ================= */

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

/* ================= CITIZEN ROUTE ================= */

const CitizenRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return children;
};

/* ================= AUTH REDIRECT ================= */

const AuthRedirect = ({ children }) => {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return children;
  return role === "admin"
    ? <Navigate to="/admin"     replace />
    : <Navigate to="/dashboard" replace />;
};

/* ================= APP ================= */

function App() {

  // Persists across page refreshes — reads token from localStorage on mount
  const [isAuth,      setIsAuth]      = useState(!!localStorage.getItem("token"));
  const [userProfile, setUserProfile] = useState(null);

  // Fetch profile once on app load if a token already exists (e.g. after page refresh)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const API_URL = import.meta.env.VITE_API_URL;

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then(data => {
        if (data?._id) {
          setUserProfile(data);
          setIsAuth(true);
        }
      })
      .catch(() => {
        // Token invalid / expired — clear storage and force re-login
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("userId");
        setIsAuth(false);
        setUserProfile(null);
      });
  }, []);

  return (
    <Router>

      <Toaster position="top-right" />

      <Routes>

        {/* ================= PUBLIC ================= */}

        <Route path="/" element={<LandingPage isAuth={isAuth} userProfile={userProfile} />} />

        {/* ================= AUTH ================= */}

        <Route
          path="/login"
          element={
            <AuthRedirect>
              <Login setIsAuth={setIsAuth} setUserProfile={setUserProfile} />
            </AuthRedirect>
          }
        />

        <Route
          path="/register"
          element={
            <AuthRedirect>
              <Register setIsAuth={setIsAuth} setUserProfile={setUserProfile} />
            </AuthRedirect>
          }
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/oauth-success"
          element={<OAuthSuccess setIsAuth={setIsAuth} setUserProfile={setUserProfile} />}
        />

        {/* ================= CITIZEN ================= */}

        <Route
          path="/dashboard"
          element={
            <CitizenRoute>
              <Dashboard isAuth={isAuth} userProfile={userProfile} />
            </CitizenRoute>
          }
        />

        <Route
          path="/reportissue"
          element={
            <CitizenRoute>
              <ReportIssue isAuth={isAuth} userProfile={userProfile} />
            </CitizenRoute>
          }
        />

        {/* ================= BOTH ADMIN + CITIZEN ================= */}

        <Route
          path="/complaints"
          element={
            <RequireAuth>
              <Complaints isAuth={isAuth} userProfile={userProfile} />
            </RequireAuth>
          }
        />

        {/* ================= COMMON AUTH ================= */}

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile
                isAuth={isAuth}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
              />
            </RequireAuth>
          }
        />

        {/* ================= ADMIN ================= */}

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard isAuth={isAuth} userProfile={userProfile} />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsers isAuth={isAuth} userProfile={userProfile} />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <AdminRoute>
              <AdminReports isAuth={isAuth} userProfile={userProfile} />
            </AdminRoute>
          }
        />

        {/* ================= FALLBACK ================= */}

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

    </Router>
  );
}

export default App;