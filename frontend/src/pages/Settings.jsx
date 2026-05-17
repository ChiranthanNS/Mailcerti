import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Settings() {
  const [form, setForm] = useState({
    fromName: '',
    fromEmail: '',
    orgName: '',
    replyTo: '',
    geminiApiKey: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setForm({
        fromName:     data.fromName     || '',
        fromEmail:    data.fromEmail    || '',
        orgName:      data.orgName      || '',
        replyTo:      data.replyTo      || '',
        geminiApiKey: data.geminiApiKey || ''
      }))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.fromName || !form.fromEmail) return toast.error('From Name and From Email are required');
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success('✅ Settings saved! All future emails will use these sender details.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return toast.error('Enter a recipient email to test');
    if (!form.fromName || !form.fromEmail) return toast.error('Save settings first');
    setTestSending(true);
    try {
      await api.post('/settings/test-email', { to: testEmail });
      toast.success(`✅ Test email sent to ${testEmail}! Check your inbox.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send test email');
    } finally {
      setTestSending(false);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" style={{width:32,height:32,borderTopColor:'var(--primary)'}}/></div>;

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Settings</h1>
        <p>Configure sender details used for all outgoing emails</p>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Sender Config Card */}
        <div className="card" style={{ flex: 1, minWidth: 340, maxWidth: 560 }}>
          <div className="section-title">✉️ Email Sender Configuration</div>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <span>ℹ️</span>
            <div>These details appear in the <strong>"From"</strong> field of every email sent — confirmation, shortlist, certificate, reminder, etc.</div>
          </div>

          <div className="form-group">
            <label className="form-label">From Name <span style={{color:'var(--error)'}}>*</span></label>
            <input
              className="form-control"
              placeholder='e.g. TechFest Organizing Committee'
              value={form.fromName}
              onChange={e => setForm({ ...form, fromName: e.target.value })}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              This name appears as the sender in the recipient's inbox
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">From Email <span style={{color:'var(--error)'}}>*</span></label>
            <input
              className="form-control"
              type="email"
              placeholder='e.g. techfest@nmit.ac.in'
              value={form.fromEmail}
              onChange={e => setForm({ ...form, fromEmail: e.target.value })}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              ⚠️ Must be your Gmail address (<strong>chiranthanns24056@gmail.com</strong>) or an alias on the same account
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Organisation Name</label>
            <input
              className="form-control"
              placeholder='e.g. NMIT Bangalore'
              value={form.orgName}
              onChange={e => setForm({ ...form, orgName: e.target.value })}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Shown in the email footer. Optional.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reply-To Email</label>
            <input
              className="form-control"
              type="email"
              placeholder='e.g. support@nmit.ac.in  (optional)'
              value={form.replyTo}
              onChange={e => setForm({ ...form, replyTo: e.target.value })}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              If set, replies from recipients go here instead of the From Email
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          <div className="section-title" style={{ marginBottom: 8 }}>🤖 AI Configuration (Gemini)</div>
          <div className="form-group">
            <label className="form-label">Google Gemini API Key</label>
            <input
              className="form-control"
              type="password"
              placeholder='AIza...'
              value={form.geminiApiKey}
              onChange={e => setForm({ ...form, geminiApiKey: e.target.value })}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Required for AI email generation in Compose page. Free to use. &nbsp;
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                style={{ color: 'var(--primary)' }}>Get your key at aistudio.google.com →</a>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><span className="spinner" />Saving...</> : '💾 Save Settings'}
          </button>
        </div>

        {/* Preview + Test Card */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Live Preview */}
          <div className="card">
            <div className="section-title">👁️ Live Preview</div>
            <div style={{
              background: 'var(--bg-card2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px 20px',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 2
            }}>
              <div><span style={{color:'var(--text-secondary)'}}>From: </span>
                <strong style={{color:'var(--primary)'}}>
                  {form.fromName || 'Your Name'} &lt;{form.fromEmail || 'your@email.com'}&gt;
                </strong>
              </div>
              {form.replyTo && (
                <div><span style={{color:'var(--text-secondary)'}}>Reply-To: </span>
                  <span style={{color:'var(--accent)'}}>{form.replyTo}</span>
                </div>
              )}
              <div><span style={{color:'var(--text-secondary)'}}>Subject: </span>
                <span>Registration Confirmed — CodeFest 2025</span>
              </div>
              {form.orgName && (
                <div><span style={{color:'var(--text-secondary)'}}>Footer: </span>
                  <span style={{color:'var(--text-secondary)', fontSize:11}}>{form.orgName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Send Test Email */}
          <div className="card">
            <div className="section-title">🧪 Send Test Email</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
              Send a test email using your current saved settings to verify everything looks right.
            </p>
            <div className="form-group">
              <label className="form-label">Send Test To</label>
              <input
                className="form-control"
                type="email"
                placeholder='e.g. chiranthanns24056@gmail.com'
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
              />
            </div>
            <button
              className="btn btn-success"
              style={{ width: '100%' }}
              onClick={handleTestEmail}
              disabled={testSending}
            >
              {testSending ? <><span className="spinner" />Sending Test...</> : '📨 Send Test Email'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
