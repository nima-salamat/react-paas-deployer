import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import apiRequest from "../customHooks/apiRequest";
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef();
  const profileRef = useRef();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/plans', label: 'Plans' },
    { path: '/aboutUs', label: 'About us' },
  ];

  const isActive = (path) => location.pathname === path;

  const closeMenu = () => {
    setIsClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setIsClosing(false);
    }, 300);
  };

  useEffect(() => {
    if (menuOpen) {
      const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
          closeMenu();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (profileMenuOpen) {
      const handleClickOutside = (e) => {
        if (profileRef.current && !profileRef.current.contains(e.target)) {
          setProfileMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileMenuOpen]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await apiRequest({ method: 'GET', url: 'http://127.0.0.1:8000/auth/api/user/' });
        setLoggedIn(true);
      } catch {
        setLoggedIn(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setLoggedIn(false);
    setProfileMenuOpen(false);
  };

  return (
    <>
      <nav className="navbar navbar-dark bg-primary shadow-sm px-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <Link className="navbar-brand fw-bold text-white fs-4 me-3" to="/">PaaS Deployer</Link>
          <div className="d-none d-md-flex gap-2">
            {!checkingAuth && !loggedIn && (
              <>
                <Link
                  to="/login"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => localStorage.setItem("auth_mode", "login")}
                >
                  Login
                </Link>
                <Link
                  to="/login"
                  className="btn btn-light btn-sm text-primary fw-bold"
                  onClick={() => localStorage.setItem("auth_mode", "signup")}
                >
                  Create Account
                </Link>
              </>
            )}

            {!checkingAuth && loggedIn && (
              <div className="position-relative" ref={profileRef}>
                <button
                  className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '36px', height: '36px' }}
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  aria-label="User menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="white"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M12 14c-5 0-7 3-7 5v1h14v-1c0-2-2-5-7-5z" />
                  </svg>
                </button>
                {profileMenuOpen && (
                  <div className="profile-dropdown shadow rounded-3 bg-white text-dark position-absolute end-0 mt-2 p-3" style={{ width: '180px', zIndex: 1050 }}>
                    <Link to="/dashboard" className="dropdown-item" onClick={() => setProfileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <Link to="/profile" className="dropdown-item" onClick={() => setProfileMenuOpen(false)}>
                      Profile
                    </Link>
                    <button className="dropdown-item text-danger" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <button className="navbar-toggler border-0" onClick={() => setMenuOpen(true)}>
          <span className="navbar-toggler-icon"></span>
        </button>
      </nav>

      {(menuOpen || isClosing) && (
        <div className={`menu-overlay ${isClosing ? 'fade-out' : 'fade-in'}`}>
          <div className="menu-box rounded-4 shadow-lg" ref={menuRef}>
            <ul className="nav flex-column text-center">
              <h4 className="text-primary mb-4">Menu</h4>
              {navItems.map(({ path, label }) => (
                <li className="nav-item" key={path}>
                  <Link
                    className={`nav-link ${isActive(path) ? 'active' : ''}`}
                    to={path}
                    onClick={closeMenu}
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li className="nav-item mt-4 d-md-none">
                {!checkingAuth && !loggedIn && (
                  <>
                    <Link
                      to="/login"
                      className="btn btn-outline-primary mb-2 w-100 fw-bold rounded-pill"
                      onClick={() => {
                        localStorage.setItem("auth_mode", "login");
                        closeMenu();
                      }}
                    >
                      Login
                    </Link>

                    <Link
                      to="/login"
                      className="btn btn-primary w-100 fw-bold rounded-pill"
                      onClick={() => {
                        localStorage.setItem("auth_mode", "signup");
                        closeMenu();
                      }}
                    >
                      Create Account
                    </Link>
                  </>
                )}

                {!checkingAuth && loggedIn && (
                  <>
                    <Link
                      to="/dashboard"
                      className="btn btn-outline-primary mb-2 w-100 fw-bold rounded-pill"
                      onClick={closeMenu}
                    >
                      Dashboard
                    </Link>
                    <button
                      className="btn btn-danger w-100 fw-bold rounded-pill"
                      onClick={() => {
                        handleLogout();
                        closeMenu();
                      }}
                    >
                      Logout
                    </button>
                  </>
                )}
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
