import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Navbar.css';
import defaultUserIcon from '../../assets/icons/user.svg';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userImage, setUserImage] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/services', label: 'Services' },
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
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (location.pathname === '/login') {
      setCheckingAuth(false);
      setLoggedIn(false);
      return;
    }

    const checkAuth = async () => {
      setCheckingAuth(true);
      const accessToken = localStorage.getItem('access');

      if (!accessToken) {
        setLoggedIn(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const validateRes = await fetch('http://localhost:8000/auth/api/validateToken/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!validateRes.ok) {
          setLoggedIn(false);
          setCheckingAuth(false);
          return;
        }

        setLoggedIn(true);

        const profileRes = await fetch('http://localhost:8000/users/api/profile/list/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (profileRes.ok) {
          const data = await profileRes.json();
          if (Array.isArray(data) && data.length > 0 && data[0].image_url) {
            setUserImage(data[0].image_url);
          } else {
            setUserImage(null);
          }
        } else {
          setUserImage(null);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setLoggedIn(false);
        setUserImage(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setLoggedIn(false);
    setUserImage(null);
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar navbar-dark bg-primary shadow-sm px-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <Link className="navbar-brand fw-bold text-white fs-4 me-3" to="/">PaaS Deployer</Link>

          <div className="d-none d-md-flex">
            {!checkingAuth && !loggedIn && (
              <button
                className="btn btn-light btn-sm text-primary fw-bold"
                onClick={() => {
                  localStorage.setItem("auth_mode", "login");
                  navigate('/login');
                }}
              >
                Sign In / Create Account
              </button>
            )}

            {!checkingAuth && loggedIn && (
              <button
                className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center p-0 overflow-hidden"
                style={{ width: '36px', height: '36px' }}
                onClick={() => navigate('/profile')}
                aria-label="User profile"
              >
                <img
                  src={userImage || defaultUserIcon}
                  alt="User"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </button>
            )}
          </div>
        </div>

        <button className="navbar-toggler border-0" onClick={() => setMenuOpen(true)}>
          <span className="navbar-toggler-icon"></span>
        </button>
      </nav>

      {(menuOpen || isClosing) && (
        <div className={`menu-overlay ${isClosing ? 'fade-out' : 'fade-in'}`}>
          <div className="menu-box rounded-4 shadow-lg position-relative" ref={menuRef}>
            
            {/* 🆕 دکمه ضربدر */}
            <button
              className="btn btn-light position-absolute top-0 end-0 m-2"
              onClick={closeMenu}
              aria-label="Close menu"
            >
              ✕
            </button>

            <ul className="nav flex-column text-center mt-4">
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
                  <button
                    className="btn btn-primary w-100 fw-bold rounded-pill"
                    onClick={() => {
                      localStorage.setItem("auth_mode", "login");
                      closeMenu();
                      navigate('/login');
                    }}
                  >
                    Sign In / Create Account
                  </button>
                )}

                {!checkingAuth && loggedIn && (
                  <>
                    <Link
                      to="/services"
                      className="btn btn-outline-primary mb-2 w-100 fw-bold rounded-pill"
                      onClick={closeMenu}
                    >
                      Services
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
