import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from './api';

export default function Colleges() {
  const [colleges, setColleges] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list'); // list | upload | promote
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileRef = useRef();

  // Promotion form
  const [promoForm, setPromoForm] = useState({
    eventId: '', subject: '', customMessage: '', targetAll: true, selectedIds: []
  });
  const [sending, setSending] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [promoStatus, setPromoStatus] = useState(null);

  const fetchData = async () => {
    try {
      const [{ data: cols }, { data: evs }] = await Promise.all([api.get('/colleges'), api.get('/events')]);
      setColleges(cols); setEvents(evs);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchPromoStatus = async (eventId) => {
    if (!eventId) return;
    try {
      const { data } = await api.get(`/colleges/promotion-status/${eventId}`);
      setPromoStatus(data);
    } catch {}
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a file');
    setUploading(true); setUploadResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await api.post('/colleges/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadResult(data);
      toast.success(`✅ Added ${data.added} colleges, skipped ${data.skipped} duplicates`);
      fetchData(); setFile(null); if(fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleSendPromotion = async () => {
    if (!promoForm.eventId) return toast.error('Please select an event');
    setSending(true); setPromoResult(null);
    try {
      const payload = { ...promoForm };
      if (!payload.targetAll) { payload.collegeIds = payload.selectedIds; }
      const { data } = await api.post('/colleges/send-promotion', payload);
      setPromoResult(data);
      toast.success(`📧 Sent ${data.sent} promotion emails!`);
      fetchPromoStatus(promoForm.eventId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally { setSending(false); }
  };

  const toggleCollegeSelect = (id) => {
    setPromoForm(p => ({
      ...p,
      selectedIds: p.selectedIds.includes(id) ? p.selectedIds.filter(x => x !== id) : [...p.selectedIds, id]
    }));
  };

  if (loading) return <div className="empty-state"><div className="spinner" style={{width:32,height:32,borderTopColor:'var(--primary)'}}/></div>;

  return (
    <div>
      <div className="page-header">
        <h1>🏫 Colleges</h1>
        <p>Manage college email database and send promotional emails</p>
      </div>

      <div className="tabs">
        {['list', 'upload', 'promote'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t === 'list' ? `📋 All Colleges (${colleges.length})` : t === 'upload' ? '📤 Upload Excel' : '📧 Send Promotion'}
          </button>
        ))}
      </div>

      {/* LIST TAB */}
      {tab === 'list' && (
        <div className="card">
          {colleges.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏫</div>
              <p>No colleges added yet. Upload an Excel file to get started.</p>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setTab('upload')}>Upload Excel</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Domain</th><th>City</th><th>State</th><th>Added</th></tr>
                </thead>
                <tbody>
                  {colleges.map(c => (
                    <tr key={c._id}>
                      <td><strong>{c.name}</strong></td>
                      <td style={{ color:'var(--primary)' }}>{c.email}</td>
                      <td>{c.domain || '—'}</td>
                      <td>{c.city || '—'}</td>
                      <td>{c.state || '—'}</td>
                      <td style={{ color:'var(--text-muted)', fontSize:12 }}>{new Date(c.addedAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* UPLOAD TAB */}
      {tab === 'upload' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="section-title">📤 Upload College Excel / CSV</div>
          <div className="alert alert-info">
            <span>ℹ️</span>
            <div>
              Excel must have columns: <strong>name, email, domain, city, state</strong> (case-insensitive).
              Duplicate emails are automatically skipped.
            </div>
          </div>

          <div className="upload-area" onClick={() => fileRef.current?.click()}>
            <div className="upload-icon">📊</div>
            <div className="upload-text">
              {file ? <><strong>{file.name}</strong> ({(file.size/1024).toFixed(1)} KB)</> : 
                <><strong>Click to browse</strong> or drag & drop<br/><span style={{fontSize:12,color:'var(--text-muted)'}}>Excel (.xlsx, .xls) or CSV supported</span></>}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
              onChange={e => setFile(e.target.files[0])} />
          </div>

          {file && (
            <button className="btn btn-primary" style={{ marginTop:16, width:'100%' }}
              onClick={handleUpload} disabled={uploading}>
              {uploading ? <><span className="spinner" />Uploading & Processing...</> : '📤 Upload & Add Colleges'}
            </button>
          )}

          {uploadResult && (
            <div style={{ marginTop:16 }}>
              <div className="alert alert-success">✅ Added: {uploadResult.added} new colleges</div>
              {uploadResult.skipped > 0 && <div className="alert alert-warning">⚠️ Skipped: {uploadResult.skipped} duplicates</div>}
              {uploadResult.errors?.length > 0 && (
                <div className="alert alert-error">
                  ❌ Errors: {uploadResult.errors.slice(0,3).map(e => e.row).join(', ')}
                  {uploadResult.errors.length > 3 && ` +${uploadResult.errors.length-3} more`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PROMOTE TAB */}
      {tab === 'promote' && (
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <div className="card" style={{ flex:1, minWidth:320 }}>
            <div className="section-title">📧 Send Promotion Emails</div>
            <div className="alert alert-info">
              <span>ℹ️</span>
              <div>Each college receives only <strong>one</strong> email per event. Previously emailed colleges are automatically skipped.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Event *</label>
              <select className="form-control" value={promoForm.eventId}
                onChange={e => { setPromoForm({...promoForm, eventId:e.target.value}); fetchPromoStatus(e.target.value); }}>
                <option value="">— Choose Event —</option>
                {events.map(e => <option key={e._id} value={e._id}>{e.name} ({new Date(e.date).toLocaleDateString('en-IN')})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Email Subject</label>
              <input className="form-control" value={promoForm.subject}
                onChange={e => setPromoForm({...promoForm, subject:e.target.value})}
                placeholder="Invitation to [Event Name]" />
            </div>

            <div className="form-group">
              <label className="form-label">Custom Message (Optional)</label>
              <textarea className="form-control" value={promoForm.customMessage}
                onChange={e => setPromoForm({...promoForm, customMessage:e.target.value})}
                placeholder="Add any additional information or instructions..." />
            </div>

            <div className="toggle-row">
              <div className={`toggle ${promoForm.targetAll ? 'on' : ''}`}
                onClick={() => setPromoForm({...promoForm, targetAll: !promoForm.targetAll})} />
              <span>Send to all colleges {promoForm.targetAll ? '(All selected)' : '(Select manually below)'}</span>
            </div>

            {!promoForm.targetAll && (
              <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8, padding:8, marginBottom:16 }}>
                {colleges.map(c => (
                  <label key={c._id} style={{ display:'flex', gap:8, padding:'6px 4px', cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={promoForm.selectedIds.includes(c._id)}
                      onChange={() => toggleCollegeSelect(c._id)} />
                    <span>{c.name} — {c.email}</span>
                  </label>
                ))}
              </div>
            )}

            <button className="btn btn-primary" style={{ width:'100%' }}
              onClick={handleSendPromotion} disabled={sending || !promoForm.eventId}>
              {sending ? <><span className="spinner"/>Sending Emails...</> : '🚀 Send Promotion Emails'}
            </button>

            {promoResult && (
              <div style={{ marginTop:16 }}>
                <div className="alert alert-success">✅ Sent: {promoResult.sent}</div>
                {promoResult.failed > 0 && <div className="alert alert-error">❌ Failed: {promoResult.failed}</div>}
                {promoResult.message && <div className="alert alert-info">ℹ️ {promoResult.message}</div>}
              </div>
            )}
          </div>

          {/* Promotion Status */}
          {promoStatus && (
            <div className="card" style={{ flex:1, minWidth:320 }}>
              <div className="section-title">📊 Promotion Status</div>
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, padding:'12px 16px', flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:'var(--success)' }}>{promoStatus.sent?.length || 0}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Already Sent</div>
                </div>
                <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, padding:'12px 16px', flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:'var(--primary)' }}>{promoStatus.unsent?.length || 0}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Pending</div>
                </div>
              </div>
              {promoStatus.unsent?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:8, fontWeight:600 }}>Colleges not yet emailed:</div>
                  <div style={{ maxHeight:200, overflowY:'auto' }}>
                    {promoStatus.unsent.map(c => (
                      <div key={c._id} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                        {c.name} — <span style={{ color:'var(--primary)' }}>{c.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
