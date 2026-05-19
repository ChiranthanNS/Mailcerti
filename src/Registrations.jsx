import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from './api';

const STATUS_BADGE = {
  registered: 'badge-registered',
  shortlisted: 'badge-shortlisted',
  rejected: 'badge-rejected',
  participated: 'badge-participated'
};

export default function Registrations() {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [tab, setTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [shortlisting, setShortlisting] = useState(false);
  const [sending, setSending] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [shortlistResult, setShortlistResult] = useState(null);
  const [instructions, setInstructions] = useState('');
  const importFileRef = useRef();
  const shortlistFileRef = useRef();
  const [importFile, setImportFile] = useState(null);
  const [shortlistFile, setShortlistFile] = useState(null);

  // Manual registration
  const [manualForm, setManualForm] = useState({ name:'', email:'', college:'', teamName:'', phone:'' });
  const [manualSending, setManualSending] = useState(false);
  const [manualResult, setManualResult] = useState(null);

  // Previous event invite
  const [prevInviteForm, setPrevInviteForm] = useState({ newEventId:'', previousEventIds:[], subject:'', customMessage:'' });
  const [prevSending, setPrevSending] = useState(false);
  const [prevResult, setPrevResult] = useState(null);

  useEffect(() => {
    api.get('/events').then(({data}) => setEvents(data)).catch(() => toast.error('Failed to load events'));
  }, []);

  const fetchRegs = async (evId) => {
    if (!evId) return setRegs([]);
    setLoading(true);
    try { const {data} = await api.get(`/registrations?eventId=${evId}`); setRegs(data); }
    catch { toast.error('Failed to load registrations'); }
    finally { setLoading(false); }
  };

  const handleEventChange = (evId) => { setSelectedEvent(evId); fetchRegs(evId); };

  // Import Google Form responses
  const handleImport = async () => {
    if (!importFile || !selectedEvent) return toast.error('Select event and file');
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append('file', importFile); fd.append('eventId', selectedEvent);
      const {data} = await api.post('/registrations/import', fd, { headers: {'Content-Type':'multipart/form-data'} });
      setImportResult(data);
      toast.success(`✅ Added ${data.added}, sent confirmation emails!`);
      fetchRegs(selectedEvent); setImportFile(null); if(importFileRef.current) importFileRef.current.value='';
    } catch(err) { toast.error(err.response?.data?.error || 'Import failed'); }
    finally { setImporting(false); }
  };

  // Upload shortlist
  const handleShortlist = async () => {
    if (!shortlistFile || !selectedEvent) return toast.error('Select event and shortlist file');
    setShortlisting(true); setShortlistResult(null);
    try {
      const fd = new FormData(); fd.append('file', shortlistFile); fd.append('eventId', selectedEvent);
      if (instructions) fd.append('instructions', instructions);
      const {data} = await api.post('/registrations/upload-shortlist', fd, { headers: {'Content-Type':'multipart/form-data'} });
      setShortlistResult(data);
      toast.success(`🌟 Shortlisted emails: ${data.shortlisted}, Rejected: ${data.rejected}`);
      fetchRegs(selectedEvent); setShortlistFile(null); if(shortlistFileRef.current) shortlistFileRef.current.value='';
    } catch(err) { toast.error(err.response?.data?.error || 'Shortlisting failed'); }
    finally { setShortlisting(false); }
  };

  const handleAction = async (action) => {
    if (!selectedEvent) return toast.error('Select an event first');
    setSending(action);
    try {
      if (action === 'reminder') {
        const {data} = await api.post(`/registrations/send-reminders/${selectedEvent}`);
        toast.success(`⏰ Reminders sent: ${data.sent}`);
      } else if (action === 'certificates') {
        const {data} = await api.post(`/registrations/send-certificates/${selectedEvent}`);
        toast.success(`🎓 Certificates sent: ${data.sent}`);
      }
      fetchRegs(selectedEvent);
    } catch(err) { toast.error(err.response?.data?.error || 'Action failed'); }
    finally { setSending(''); }
  };

  const handleManualAdd = async () => {
    if (!selectedEvent) return toast.error('Select an event first');
    if (!manualForm.name || !manualForm.email) return toast.error('Name and email are required');
    setManualSending(true); setManualResult(null);
    try {
      const { data } = await api.post('/registrations', { ...manualForm, eventId: selectedEvent });
      setManualResult(data);
      toast.success(`✅ Registered & confirmation email sent to ${manualForm.email}!`);
      setManualForm({ name:'', email:'', college:'', teamName:'', phone:'' });
      fetchRegs(selectedEvent);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add registration');
    } finally {
      setManualSending(false);
    }
  };

  const handlePrevInvites = async () => {
    if (!prevInviteForm.newEventId || prevInviteForm.previousEventIds.length === 0)
      return toast.error('Select new event and at least one previous event');
    setPrevSending(true); setPrevResult(null);
    try {
      const {data} = await api.post('/registrations/send-invites-previous', prevInviteForm);
      setPrevResult(data);
      toast.success(`📧 Sent ${data.sent} invites to previous participants!`);
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setPrevSending(false); }
  };

  const togglePrevEvent = (id) => {
    setPrevInviteForm(p => ({
      ...p, previousEventIds: p.previousEventIds.includes(id)
        ? p.previousEventIds.filter(x => x !== id) : [...p.previousEventIds, id]
    }));
  };

  const shortlisted = regs.filter(r => r.status === 'shortlisted').length;
  const registered = regs.filter(r => r.status === 'registered').length;

  return (
    <div>
      <div className="page-header">
        <h1>📝 Registrations</h1>
        <p>Import registrations, manage shortlisting, send reminders & certificates</p>
      </div>

      {/* Event Selector */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:250 }}>
            <label className="form-label">Select Event</label>
            <select className="form-control" value={selectedEvent} onChange={e => handleEventChange(e.target.value)}>
              <option value="">— Choose Event —</option>
              {events.map(e => <option key={e._id} value={e._id}>{e.name} ({new Date(e.date).toLocaleDateString('en-IN')})</option>)}
            </select>
          </div>
          {selectedEvent && (
            <div style={{ display:'flex', gap:12, paddingTop:22, flexWrap:'wrap' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:'var(--primary)' }}>{regs.length}</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Total</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:'var(--warning)' }}>{shortlisted}</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Shortlisted</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:'var(--accent)' }}>{registered}</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Pending</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        {['list','manual','import','shortlist','actions','invites'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {{list:'📋 List', manual:'➕ Add Manually', import:'📤 Import', shortlist:'⭐ Shortlist', actions:'🚀 Actions', invites:'💌 Prev Invites'}[t]}
          </button>
        ))}
      </div>

      {/* MANUAL ADD */}
      {tab === 'manual' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="section-title">➕ Add Registration Manually</div>
          <div className="alert alert-info">
            <span>ℹ️</span>
            <div>Enter one person's details. A <strong>confirmation email</strong> will be sent to them instantly.</div>
          </div>
          {!selectedEvent && <div className="alert alert-warning">⚠️ Please select an event above first.</div>}

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-control" placeholder="e.g. Chiranjeev Kumar" value={manualForm.name}
              onChange={e => setManualForm({...manualForm, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input className="form-control" type="email" placeholder="e.g. you@gmail.com" value={manualForm.email}
              onChange={e => setManualForm({...manualForm, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">College / Institution</label>
            <input className="form-control" placeholder="e.g. IIT Delhi" value={manualForm.college}
              onChange={e => setManualForm({...manualForm, college: e.target.value})} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Team Name</label>
              <input className="form-control" placeholder="Optional" value={manualForm.teamName}
                onChange={e => setManualForm({...manualForm, teamName: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Phone</label>
              <input className="form-control" placeholder="Optional" value={manualForm.phone}
                onChange={e => setManualForm({...manualForm, phone: e.target.value})} />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width:'100%', marginTop:8 }}
            onClick={handleManualAdd} disabled={manualSending || !selectedEvent}>
            {manualSending
              ? <><span className="spinner"/>Registering & Sending Email...</>
              : '✉️ Add & Send Confirmation Email'}
          </button>

          {manualResult && (
            <div className="alert alert-success" style={{ marginTop:16 }}>
              ✅ <strong>{manualResult.registration?.name}</strong> registered!
              {manualResult.confirmationEmailSent
                ? ' Confirmation email sent successfully.'
                : ' ⚠️ Registration saved but email sending failed — check SMTP config.'}
            </div>
          )}
        </div>
      )}

      {/* LIST */}
      {tab === 'list' && (
        <div className="card">
          {loading ? (
            <div className="empty-state"><div className="spinner" style={{width:28,height:28,borderTopColor:'var(--primary)'}}/></div>
          ) : regs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{selectedEvent ? '📭' : '👆'}</div>
              <p>{selectedEvent ? 'No registrations yet for this event.' : 'Select an event to view registrations.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>College</th><th>Team</th><th>Status</th><th>Confirm</th><th>Reminder</th><th>Certificate</th></tr>
                </thead>
                <tbody>
                  {regs.map(r => (
                    <tr key={r._id}>
                      <td><strong>{r.name}</strong></td>
                      <td style={{ color:'var(--primary)', fontSize:12 }}>{r.email}</td>
                      <td>{r.college || '—'}</td>
                      <td>{r.teamName || '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status]||''}`}>{r.status}</span></td>
                      <td>{r.confirmationEmailSent ? '✅' : '—'}</td>
                      <td>{r.reminderEmailSent ? '✅' : '—'}</td>
                      <td>{r.certificateEmailSent ? '🎓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* IMPORT */}
      {tab === 'import' && (
        <div className="card" style={{ maxWidth:600 }}>
          <div className="section-title">📤 Import Google Form Responses</div>
          <div className="alert alert-info">
            <span>ℹ️</span>
            <div>Upload the downloaded Google Form response Excel. Columns needed: <strong>name, email, college, teamName, phone</strong>. Confirmation emails are sent to new registrants only (no duplicates).</div>
          </div>
          {!selectedEvent && <div className="alert alert-warning">⚠️ Please select an event first.</div>}
          <div className="upload-area" onClick={() => importFileRef.current?.click()}>
            <div className="upload-icon">📊</div>
            <div className="upload-text">
              {importFile ? <strong>{importFile.name}</strong> : <><strong>Click to browse</strong> — Excel/CSV</>}
            </div>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
              onChange={e => setImportFile(e.target.files[0])} />
          </div>
          {importFile && (
            <button className="btn btn-primary" style={{ marginTop:16, width:'100%' }}
              onClick={handleImport} disabled={importing||!selectedEvent}>
              {importing ? <><span className="spinner"/>Importing & Sending Confirmations...</> : '📤 Import & Send Confirmation Emails'}
            </button>
          )}
          {importResult && (
            <div style={{ marginTop:16 }}>
              <div className="alert alert-success">✅ New registrations: {importResult.added}</div>
              {importResult.skipped > 0 && <div className="alert alert-warning">⚠️ Skipped (already registered): {importResult.skipped}</div>}
            </div>
          )}
        </div>
      )}

      {/* SHORTLIST */}
      {tab === 'shortlist' && (
        <div className="card" style={{ maxWidth:600 }}>
          <div className="section-title">⭐ Upload Shortlist</div>
          <div className="alert alert-info">
            <span>ℹ️</span>
            <div>Upload an Excel with shortlisted emails. <strong>Shortlisted</strong> students get a congratulations email; the rest get a polite rejection email. No duplicates sent.</div>
          </div>
          {!selectedEvent && <div className="alert alert-warning">⚠️ Please select an event first.</div>}
          <div className="upload-area" onClick={() => shortlistFileRef.current?.click()}>
            <div className="upload-icon">⭐</div>
            <div className="upload-text">
              {shortlistFile ? <strong>{shortlistFile.name}</strong> : <><strong>Click to browse</strong> — Excel with email column</>}
            </div>
            <input ref={shortlistFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
              onChange={e => setShortlistFile(e.target.files[0])} />
          </div>
          <div className="form-group" style={{ marginTop:16 }}>
            <label className="form-label">Instructions for Shortlisted Students (Optional)</label>
            <textarea className="form-control" value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="e.g. Please bring your ID card and laptop..." />
          </div>
          {shortlistFile && (
            <button className="btn btn-warning" style={{ width:'100%' }}
              onClick={handleShortlist} disabled={shortlisting||!selectedEvent}>
              {shortlisting ? <><span className="spinner"/>Processing Shortlist...</> : '⭐ Process Shortlist & Send Emails'}
            </button>
          )}
          {shortlistResult && (
            <div style={{ marginTop:16 }}>
              <div className="alert alert-success">🌟 Shortlisted emails sent: {shortlistResult.shortlisted}</div>
              <div className="alert alert-info">🚫 Rejection emails sent: {shortlistResult.rejected}</div>
            </div>
          )}
        </div>
      )}

      {/* ACTIONS */}
      {tab === 'actions' && (
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <div className="card" style={{ flex:1, minWidth:280 }}>
            <div className="section-title">⏰ Send Reminders</div>
            <p style={{ color:'var(--text-secondary)', fontSize:13, marginBottom:16 }}>
              Send reminder emails to all shortlisted students who haven't received a reminder yet. 
              (Also runs automatically the day before the event at 8 AM.)
            </p>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--warning)', marginBottom:8 }}>{shortlisted}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:16 }}>shortlisted students</div>
            <button className="btn btn-warning" style={{ width:'100%' }}
              onClick={() => handleAction('reminder')} disabled={sending==='reminder'||!selectedEvent}>
              {sending==='reminder' ? <><span className="spinner"/>Sending...</> : '⏰ Send Reminder Emails'}
            </button>
          </div>

          <div className="card" style={{ flex:1, minWidth:280 }}>
            <div className="section-title">🎓 Send Certificates</div>
            <p style={{ color:'var(--text-secondary)', fontSize:13, marginBottom:16 }}>
              Generate PDF certificates with participant names and email them to all shortlisted/participated students.
            </p>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--success)', marginBottom:8 }}>{shortlisted}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:16 }}>eligible participants</div>
            <button className="btn btn-success" style={{ width:'100%' }}
              onClick={() => handleAction('certificates')} disabled={sending==='certificates'||!selectedEvent}>
              {sending==='certificates' ? <><span className="spinner"/>Generating & Sending...</> : '🎓 Send Certificates'}
            </button>
          </div>
        </div>
      )}

      {/* PREVIOUS INVITES */}
      {tab === 'invites' && (
        <div className="card" style={{ maxWidth:600 }}>
          <div className="section-title">💌 Invite Previous Participants</div>
          <div className="alert alert-info">
            <span>ℹ️</span>
            <div>Send promotional emails for a new event to all students registered in previous events.</div>
          </div>

          <div className="form-group">
            <label className="form-label">New Event to Promote *</label>
            <select className="form-control" value={prevInviteForm.newEventId}
              onChange={e => setPrevInviteForm({...prevInviteForm, newEventId:e.target.value})}>
              <option value="">— Select New Event —</option>
              {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Select Previous Event(s) to Pull Registrants From *</label>
            <div style={{ background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:8, padding:8, maxHeight:160, overflowY:'auto' }}>
              {events.map(e => (
                <label key={e._id} style={{ display:'flex', gap:8, padding:'6px 4px', cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={prevInviteForm.previousEventIds.includes(e._id)}
                    onChange={() => togglePrevEvent(e._id)} />
                  <span>{e.name} ({new Date(e.date).toLocaleDateString('en-IN')})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Subject</label>
            <input className="form-control" value={prevInviteForm.subject}
              onChange={e => setPrevInviteForm({...prevInviteForm, subject:e.target.value})}
              placeholder="Join us for the next event!" />
          </div>

          <div className="form-group">
            <label className="form-label">Custom Message</label>
            <textarea className="form-control" value={prevInviteForm.customMessage}
              onChange={e => setPrevInviteForm({...prevInviteForm, customMessage:e.target.value})}
              placeholder="We'd love to see you again..." />
          </div>

          <button className="btn btn-primary" style={{ width:'100%' }}
            onClick={handlePrevInvites} disabled={prevSending}>
            {prevSending ? <><span className="spinner"/>Sending Invites...</> : '💌 Send Invites to Previous Participants'}
          </button>

          {prevResult && (
            <div style={{ marginTop:16 }}>
              <div className="alert alert-success">✅ Sent: {prevResult.sent}</div>
              {prevResult.failed > 0 && <div className="alert alert-error">❌ Failed: {prevResult.failed}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
