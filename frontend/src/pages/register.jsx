import { useEffect, useRef, useState } from "react";
import "./register.css";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const getPasswordStrength = (password) => {
  if (!password) return "";
  if (password.length < 6) return "weak";
  if (/[A-Z]/.test(password) && /\d/.test(password) && password.length >= 8)
    return "strong";
  return "medium";
};

function Register() {
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleSignup = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  /* CHECK USERNAME */
  const checkUsername = async (username) => {
    if (!username) return;
    setUsernameStatus("loading");
    try {
      const res = await fetch(
        `http://localhost:5000/api/auth/check-username?username=${username}`
      );
      const data = await res.json();
      setUsernameStatus(data.exists ? "taken" : "available");
    } catch {
      setUsernameStatus("");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    const updated =
      name === "username" ? value.toLowerCase().trim() : value.trimStart();

    setForm((prev) => ({ ...prev, [name]: updated }));

    if (name === "password") {
      setPasswordStrength(getPasswordStrength(updated));
    }

    if (name === "username") {
      setUsernameStatus("");
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => checkUsername(updated),
        400
      );
    }
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (usernameStatus === "taken") {
      toast.error("Username already exists");
      return;
    }

    if (passwordStrength === "weak") {
      toast.error("Password too weak");
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading("Creating account...");

    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg);


      localStorage.setItem("token", data.token);

      toast.success("Account created successfully", { id: loadingToast });
      navigate("/profile");
    } catch (err) {
      toast.error(err.message || "Registration failed", {
        id: loadingToast,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar isAuth={false} />

      <div className="login-wrapper">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Create Account</h2>
          <p className="subtitle">Join CleanStreet. Make your city better.</p>

          <input
            name="name"
            placeholder="Full name"
            onChange={handleChange}
            required
          />

          <div className="username-field">
            <input
              name="username"
              placeholder="Username"
              onChange={handleChange}
              required
            />
            {usernameStatus === "available" && (
              <span className="status available">✓</span>
            )}
            {usernameStatus === "taken" && (
              <span className="status taken">✕</span>
            )}
          </div>

          <input
            name="email"
            type="email"
            placeholder="Email"
            onChange={handleChange}
            required
          />


          <div className="password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              onChange={handleChange}
              required
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

          {form.password && (
            <p className={`strength ${passwordStrength}`}>
              Password strength: <b>{passwordStrength}</b>
            </p>
          )}

          <button className="login-btn" disabled={submitting}>
            {submitting ? "Registering..." : "Register"}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleSignup}
          >
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google"
            />
            Continue with Google
          </button>

          <p className="register-text">
            Already have an account? <Link to="/">Login</Link>
          </p>
        </form>
      </div>
    </>
  );
}

export default Register;
