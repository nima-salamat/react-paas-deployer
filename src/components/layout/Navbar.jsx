import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef();

  const toggleMenu = () => setMenuOpen(prev => !prev);

  const isActive = (path) => location.pathname === path;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Shared nav items for both sidebar & mobile menu
  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/plans', label: 'Plans' },
    { path: '/categories', label: 'About us' },
  ];

  return (
    <>
      <nav className="navbar navbar-dark bg-primary shadow-sm px-4 d-flex justify-content-between align-items-center">
        <Link className="navbar-brand fw-bold text-white fs-4" to="/">PaaS Deployer</Link>
        <button className="navbar-toggler border-0 d-lg-none" onClick={toggleMenu}>
          <span className="navbar-toggler-icon"></span>
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`modern-menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-box rounded-4 shadow-lg" ref={menuRef}>
          <ul className="nav flex-column text-center">
            {navItems.map(({ path, label }) => (
              <li className="nav-item" key={path}>
                <Link
                  className={`nav-link ${isActive(path) ? 'active' : ''}`}
                  to={path}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="nav-item mt-4">
              <Link to="/login" className="btn btn-outline-light px-4 fw-bold rounded-pill" onClick={() => setMenuOpen(false)}>Login</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Sidebar for large screens */}
      <div className="sidebar d-none d-lg-flex flex-column bg-primary text-white px-3 py-4">
        <h4 className="mb-4">PaaS</h4>
        {navItems.map(({ path, label }) => (
          <Link
            key={path}
            to={path}
            className={`sidebar-link ${isActive(path) ? 'active' : ''}`}
          >
            {label}
          </Link>
        ))}
        <Link to="/login" className="btn btn-light text-primary mt-4 fw-bold rounded-pill">Login</Link>
      </div>
    </>
  );
};

export default Navbar;
