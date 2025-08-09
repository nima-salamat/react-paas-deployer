import './App.css';
import { Routes, Route, BrowserRouter as Router, Outlet } from 'react-router-dom';
import Home from './components/home/home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './components/login/login.jsx';
import Plans from './components/plans/plans.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import AboutUs from './components/aboutUs/aboutUs.jsx';

const Layout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="plans" element={<Plans />} />
          <Route path="login" element={<Login />} />
          <Route path="aboutUs" element={<AboutUs />} />
          {/* add other routes here */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
