import { useState } from "react";
import "./login.css";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import axios from "axios";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      toast.error("Email/Username and password required");
      return;
    }

    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          identifier,
          password,
        }
      );

      localStorage.setItem("token", res.data.token);
      toast.success("Login successful");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.msg || "Login failed");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  return (
    <>
      <Navbar isAuth={false} />

      <div className="login-wrapper">
        <div className="login-card">
          <h2>Welcome Back</h2>
          <p className="subtitle">Login to continue to CleanStreet</p>

          {/* SAME UI */}
          <input
            type="text"
            placeholder="Email or Username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M7.4 7.4C5.2 8.7 3.5 10.5 2 12c2.5 3 6.1 6 10 6 1.4 0 2.8-.4 4-1M14.5 9.5A4 4 0 019 14.5M12 6c4 0 7.5 3 10 6-1 1.2-2.2 2.4-3.5 3.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M12 5c4.5 0 8.3 3.2 10 7-1.7 3.8-5.5 7-10 7s-8.3-3.2-10-7c1.7-3.8 5.5-7 10-7zm0 3a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>

          </div>

          <button className="login-btn" onClick={handleLogin}>
            Login
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button className="google-btn" onClick={handleGoogleLogin}>
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google"
            />
            Continue with Google
          </button>

          <p className="register-text">
            Don’t have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default Login;
