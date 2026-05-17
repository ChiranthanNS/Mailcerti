import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Colleges from './pages/Colleges';
import Registrations from './pages/Registrations';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Compose from './pages/Compose';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">✉️</div>
            <div>
              <div className="brand-name">MailCerti</div>
              <div className="brand-sub">Event Management</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📊</span> Dashboard
            </NavLink>
            <NavLink to="/events" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">🎯</span> Events
            </NavLink>
            <NavLink to="/colleges" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">🏫</span> Colleges
            </NavLink>
            <NavLink to="/registrations" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📝</span> Registrations
            </NavLink>
            <NavLink to="/analytics" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📈</span> Analytics
            </NavLink>
            <NavLink to="/compose" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">✍️</span> Compose Email
            </NavLink>
            <NavLink to="/settings" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} style={{ marginTop: 'auto' }}>
              <span className="nav-icon">⚙️</span> Settings
            </NavLink>
          </nav>
          <div className="sidebar-footer">
            <div className="status-dot"></div>
            <span>System Active</span>
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/colleges" element={<Colleges />} />
            <Route path="/registrations" element={<Registrations />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
