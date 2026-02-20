// App.jsx
import React from "react";
import { Routes, Route, BrowserRouter as Router, Outlet, Link } from "react-router-dom";
import { Box } from "@mui/material";

import Home from './components/home/home.jsx';
import Services from './components/service/Services.jsx';
import Login from './components/login/login.jsx';
import Plans from './components/plans/plans.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import AboutUs from './components/aboutUs/aboutUs.jsx';
import ServiceDetail from "./components/service_detail/ServiceDetail.jsx";
import Profile from  "./components/profile/profile.jsx";
import FloatingNav from "./components/layout/FloatingNav";

const Layout = ({ toggleTheme, themeMode }) => {
  const loggedIn = Boolean(localStorage.getItem("access"));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      
      {/* Navbar */}
      <Navbar toggleTheme={toggleTheme} themeMode={themeMode} />

      {/* Page content */}
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>

      {/* Footer */}
      <Footer />

      {/* Floating Action Panel */}
      <FloatingNav loggedIn={loggedIn} />

    </Box>
  );
};

function App({ toggleTheme, themeMode }) {
  return (
    <Router>
      <Routes>
        {/* forward the props down to Layout */}
        <Route path="/" element={<Layout toggleTheme={toggleTheme} themeMode={themeMode} />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="plans" element={<Plans />} />
          <Route path="login" element={<Login />} />
          <Route path="aboutUs" element={<AboutUs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
