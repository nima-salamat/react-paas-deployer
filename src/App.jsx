import './App.css';
import { Routes, Route, BrowserRouter as Router, Outlet } from 'react-router-dom';
import Home from './components/home/home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './components/login/login.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';

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
          <Route path="/login" element={<Login />} />
          {/* add other routes here */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
