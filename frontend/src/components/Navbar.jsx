import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

const Navbar = ({ isAuth }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <>
      <header className="navbar">
        <div className="logo">
          <img src="/logo-icon.png" alt="Clean Street" className="logo-img" />
        </div>

        <nav className="nav-center desktop-only">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/">Report Issue</Link>
          <Link to="/">View Complaints</Link>
        </nav>

        <div className="nav-links desktop-only">
          {isAuth ? (
            <>
              <Link to="/profile" className="nav-btn primary">
                Profile
              </Link>
              <button className="nav-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/" className="nav-btn">
                Login
              </Link>
              <Link to="/register" className="nav-btn primary">
                Register
              </Link>
            </>
          )}
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(true)}>
          <span />
          <span />
          <span />
        </button>
      </header>

      <div
        className={`overlay ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`side-drawer ${menuOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-logo">
            <img src="/logo-icon.png" alt="Clean Street" className="logo-img" />
          </div>

          <button className="close-btn" onClick={() => setMenuOpen(false)}>
            ✕
          </button>
        </div>

        <nav className="drawer-links">
          <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
            Dashboard
          </Link>
          <Link to="/" onClick={() => setMenuOpen(false)}>
            Report Issue
          </Link>
          <Link to="/" onClick={() => setMenuOpen(false)}>
            View Complaints
          </Link>

          <div className="drawer-divider" />

          {isAuth ? (
            <>
              <Link to="/profile" onClick={() => setMenuOpen(false)}>
                Profile
              </Link>
              <button className="drawer-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)}>
                Register
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Navbar;
