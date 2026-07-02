import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Events, ImportConfirm, SendEmails, Certificates, Settings } from './pages';
import Login from './Login';
import './App.css';

/* ── SVG Icon Components ── */
const icons = {
  events: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  import: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  mail: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  certificate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/>
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  directory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  logo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
};

const navItems = [
  { to: '/',             icon: 'events',      label: 'Events',          end: true,  tag: null },
  { to: '/import',       icon: 'import',      label: 'Import & Confirm', end: true, tag: 'M2' },
  { to: '/send-emails',  icon: 'mail',        label: 'Send Emails',      end: true, tag: 'M3' },
  { to: '/certificates', icon: 'certificate', label: 'Certificates',     end: true, tag: 'M4' },
];

const bottomNavItems = [
  { to: '/settings',     icon: 'settings',    label: 'Settings',         end: true },
];

function AppContent({ token, user, onLogout }) {
  const location = useLocation();

  const allNav = [...navItems, ...bottomNavItems];
  const activeItem = allNav.find(item => item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)
  );
  const activeLabel = activeItem ? activeItem.label : 'MailCerti';

  const renderNavLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => isActive ? 'rail-item active' : 'rail-item'}
    >
      <div className="rail-icon-wrap">{icons[item.icon]}</div>
      <span className="rail-label">{item.label}</span>
      {item.tag && (
        <span style={{
          marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
          color: '#14B8A6', background: 'rgba(20,184,166,0.12)',
          border: '1px solid rgba(20,184,166,0.25)',
          padding: '2px 6px', borderRadius: 20, flexShrink: 0
        }}>{item.tag}</span>
      )}
    </NavLink>
  );

  return (
    <div className="app-layout">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(9, 13, 22, 0.95)',
            backdropFilter: 'blur(20px)',
            color: '#F8FAFC',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
        }}
      />

      {/* Floating Vertical Left Rail */}
      <aside className="left-rail">
        <div className="rail-brand">
          <div className="brand-icon-wrap">{icons.logo}</div>
          <div className="brand-text">
            <div style={{ fontFamily: 'Sora', fontSize: '15px', fontWeight: 800, background: 'linear-gradient(135deg, #fff, var(--primary-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.3px' }}>MailCerti</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: '9px', color: 'var(--text-secondary)', opacity: 0.7, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Event Console</div>
          </div>
        </div>

        <nav className="rail-nav">
          <div style={{ padding: '0 14px', marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#475569', textTransform: 'uppercase' }}>Modules</span>
          </div>

          {navItems.map(renderNavLink)}

          <div className="rail-divider" />

          <div style={{ padding: '0 14px', marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#475569', textTransform: 'uppercase' }}>Manage</span>
          </div>

          {bottomNavItems.map(renderNavLink)}
        </nav>

        {/* User profile & Logout footer */}
        <div className="rail-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 12px', width: '240px', alignItems: 'stretch' }}>
          <div className="rail-divider" style={{ margin: '8px 0', width: '100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            {user?.picture ? (
              <img src={user.picture} alt={user.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary-light)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="brand-text" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '10px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', opacity: 0.8 }}>
                {user?.email || 'vvce.ac.in'}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="rail-item"
            style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '14px', padding: '0', height: '40px', cursor: 'pointer', color: '#F87171' }}
          >
            <div className="rail-icon-wrap" style={{ width: '48px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <span className="rail-label" style={{ fontFamily: 'Space Grotesk', fontSize: '12.5px', fontWeight: 600 }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Minimal Top Action Ribbon */}
      <header className="top-ribbon">
        <div className="ribbon-title">{activeLabel}</div>
        <div className="ribbon-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '20px' }}>
            <span className="status-dot" />
            <span style={{ fontSize: '11px', fontFamily: 'Space Grotesk', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>SECURE ACCESS</span>
          </div>
        </div>
      </header>

      {/* Main content page area */}
      <main className="main-content">
        <Routes>
          <Route path="/"             element={<Events />} />
          <Route path="/import"       element={<ImportConfirm />} />
          <Route path="/send-emails"  element={<SendEmails />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/settings"     element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('mailcerti_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('mailcerti_user') || 'null'));

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('mailcerti_token', newToken);
    localStorage.setItem('mailcerti_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('mailcerti_token');
    localStorage.removeItem('mailcerti_user');
    setToken(null);
    setUser(null);
    window.location.href = '/';
  };

  if (!token) {
    return (
      <>
        <Toaster position="top-right" />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <Router>
      <AppContent token={token} user={user} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
