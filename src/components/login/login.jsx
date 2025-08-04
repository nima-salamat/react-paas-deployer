import React, { useState } from 'react';
import './Login.css';

const Login = () => {
  const [useEmail, setUseEmail] = useState(true);

  const toggleLoginMethod = (e) => {
    e.preventDefault();
    setUseEmail(prev => !prev);
  };

  return (
    <div className="login-container">
      <div className="login-card shadow rounded">
        <h2 className="mb-4 text-primary text-center">Login</h2>
        <form>
          {useEmail ? (
            <div className="form-group mb-3">
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                type="email"
                id="email"
                className="form-control"
                placeholder="Enter your email"
                required
              />
            </div>
          ) : (
            <div className="form-group mb-3">
              <label htmlFor="phone" className="form-label">Phone number</label>
              <input
                type="tel"
                id="phone"
                className="form-control"
                placeholder="Enter your phone number"
                required
              />
            </div>
          )}

          <div className="form-group mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100 rounded-pill mb-3">
            Login
          </button>

          <div className="text-center">
            <a href="#" className="toggle-link" onClick={toggleLoginMethod}>
              {useEmail
                ? 'Login with phone instead'
                : 'Login with email instead'}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
