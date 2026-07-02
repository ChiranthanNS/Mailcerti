import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from './api';

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await api.get('/auth/config');
        setConfig(data);
        if (!data.googleClientId) {
          setErrorMsg('Google Client ID is not configured on the server. Please check your .env file.');
        }
      } catch (err) {
        console.error('Failed to load login config:', err);
        setErrorMsg('Failed to initialize server connection. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!config?.googleClientId) return;

    const initializeGoogleSignIn = () => {
      if (window.google) {
        try {
          window.google.accounts.id.initialize({
            client_id: config.googleClientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
              theme: 'filled_black',
              size: 'large',
              width: 300,
              text: 'signin_with',
              shape: 'pill',
              logo_alignment: 'left',
            }
          );
        } catch (err) {
          console.error('Error rendering Google button:', err);
        }
      } else {
        setTimeout(initializeGoogleSignIn, 500);
      }
    };

    initializeGoogleSignIn();
  }, [config]);

  const handleCredentialResponse = async (response) => {
    const loadingToast = toast.loading('Verifying college credentials...');
    setErrorMsg('');
    try {
      const { data } = await api.post('/auth/google-login', {
        credential: response.credential,
      });
      toast.success(`Access Granted. Welcome, ${data.user.name}!`, { id: loadingToast });
      onLogin(data.token, data.user);
    } catch (err) {
      const message = err.response?.data?.error || 'Authentication failed. Please try again.';
      setErrorMsg(message);
      toast.error('Access Denied', { id: loadingToast });
    }
  };

  const handleDevLogin = async () => {
    const loadingToast = toast.loading('Logging in via Dev Bypass...');
    setErrorMsg('');
    try {
      const { data } = await api.post('/auth/dev-login');
      toast.success(`Access Granted (Dev Bypass). Welcome, ${data.user.name}!`, { id: loadingToast });
      onLogin(data.token, data.user);
    } catch (err) {
      const message = err.response?.data?.error || 'Dev authentication failed. Please try again.';
      setErrorMsg(message);
      toast.error('Dev Bypass Denied', { id: loadingToast });
    }
  };

  return (
    <div className="login-container">
      <style>{`
        .login-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #030712;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
          z-index: 9999;
        }
        .login-bg-glows { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
        .login-glow-1 {
          position: absolute; width: 600px; height: 600px; top: -200px; left: -150px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
          filter: blur(80px); animation: floatGlow 15s ease-in-out infinite alternate;
        }
        .login-glow-2 {
          position: absolute; width: 500px; height: 500px; bottom: -150px; right: -100px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%);
          filter: blur(60px); animation: floatGlow 20s ease-in-out infinite alternate-reverse;
        }
        @keyframes floatGlow { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(40px, 30px) scale(1.1); } }
        .login-card {
          position: relative; z-index: 10;
          background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px; padding: 44px 40px; width: 100%; max-width: 440px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65), 0 0 40px rgba(99, 102, 241, 0.03);
          text-align: center; animation: loginCardEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes loginCardEnter { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .login-card::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          border-radius: 24px 24px 0 0; background: linear-gradient(90deg, #6366F1, #06B6D4);
        }
        .login-brand-logo {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #6366F1, #06B6D4);
          border-radius: 16px; display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.25);
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse { 0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.25); } 50% { transform: scale(1.04); box-shadow: 0 12px 32px rgba(99, 102, 241, 0.4); } }
        .login-title { font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; letter-spacing: -0.5px; }
        .login-subtitle { font-family: 'Space Grotesk', sans-serif; font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 32px; }
        .login-desc { font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 32px; }
        .login-desc strong { color: #818CF8; font-weight: 600; }
        .google-btn-wrapper { display: flex; justify-content: center; align-items: center; min-height: 50px; margin-bottom: 24px; }
        .login-alert { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 12px 16px; color: #FCA5A5; font-size: 12.5px; line-height: 1.5; margin-top: 20px; text-align: left; display: flex; gap: 10px; align-items: flex-start; animation: alertShake 0.4s ease; }
        @keyframes alertShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        .login-alert-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .login-footer-text { font-family: 'Space Grotesk', sans-serif; font-size: 10px; color: #475569; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 36px; }
        .login-spinner-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .login-spinner { width: 32px; height: 32px; border: 3px solid rgba(99, 102, 241, 0.1); border-top: 3px solid #6366F1; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-bg-glows">
        <div className="login-glow-1"></div>
        <div className="login-glow-2"></div>
      </div>

      <div className="login-card">
        <div className="login-brand-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 className="login-title">MailCerti</h1>
        <div className="login-subtitle">Console Auth Gateway</div>

        {loading ? (
          <div className="login-spinner-wrap">
            <div className="login-spinner"></div>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>Loading credentials...</span>
          </div>
        ) : (
          <>
            <p className="login-desc">
              Please authenticate using your official college Google account. Only emails on the <strong>@vvce.ac.in</strong> domain are permitted access.
            </p>

            <div className="google-btn-wrapper">
              {config?.googleClientId ? (
                <div id="google-signin-button"></div>
              ) : (
                <span style={{ color: '#EF4444', fontSize: 13 }}>Google OAuth is not configured.</span>
              )}
            </div>

            {window.location.hostname === 'localhost' && (
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <button 
                  onClick={handleDevLogin}
                  style={{
                    padding: '10px 20px', borderRadius: '24px',
                    background: 'linear-gradient(135deg, #6366F1 0%, #0891B2 100%)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    fontWeight: '600', fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)', transition: 'all 0.2s'
                  }}
                >
                  ⚡ Dev Bypass Login (Localhost Only)
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="login-alert">
                <span className="login-alert-icon">⚠️</span>
                <div>{errorMsg}</div>
              </div>
            )}

            <div className="login-footer-text">
              🔒 SECURE 256-BIT CLIENT AUTH
            </div>
          </>
        )}
      </div>
    </div>
  );
}
