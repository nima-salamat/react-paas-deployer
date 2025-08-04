import React, { useState, useEffect, useRef, use } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const location = useLocation();
  const menuRef = useRef();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/plans', label: 'Plans' },
    { path: '/categories', label: 'About us' },
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
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <>
      <nav className="navbar navbar-dark bg-primary shadow-sm px-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <Link className="navbar-brand fw-bold text-white fs-4 me-3" to="/">PaaS Deployer</Link>
          <div className="d-none d-md-flex gap-2">
            <Link to="/login" className="btn btn-outline-light btn-sm">Login</Link>
            <Link to="/register" className="btn btn-light btn-sm text-primary fw-bold">Create Account</Link>
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
                <Link
                  to="/login"
                  className="btn btn-outline-primary mb-2 w-100 fw-bold rounded-pill"
                  onClick={closeMenu}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn btn-primary w-100 fw-bold rounded-pill"
                  onClick={closeMenu}
                >
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
