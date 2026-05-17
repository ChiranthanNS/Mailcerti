import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const WEBHOOK_SECRET = 'mailcerti_wh_secret_2025';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [webhookEvent, setWebhookEvent] = useState(null); // for webhook panel
  const [form, setForm] = useState({ name:'', description:'', date:'', venue:'', googleFormLink:'' });
  const [templateFile, setTemplateFile] = useState(null);
  const [saving, setSaving] = useState(false);


  const fetchEvents = async () => {
    try { const { data } = await api.get('/events'); setEvents(data); }
    catch (e) { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const openCreate = () => { setEditEvent(null); setForm({ name:'', description:'', date:'', venue:'', googleFormLink:'' }); setTemplateFile(null); setShowModal(true); };
  const openEdit = (ev) => { setEditEvent(ev); setForm({ name:ev.name, description:ev.description||'', date:ev.date?.slice(0,10)||'', venue:ev.venue||'', googleFormLink:ev.googleFormLink||'' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (templateFile) fd.append('certificateTemplate', templateFile);

      if (editEvent) {
        await api.put(`/events/${editEvent._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Event updated!');
      } else {
        await api.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Event created!');
      }
      setShowModal(false); fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save event');
    } finally { setSaving(false); }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    try { await api.delete(`/events/${id}`); toast.success('Deleted'); fetchEvents(); }
    catch { toast.error('Failed to delete'); }
  };

  const updateStatus = async (id, status) => {
    try { await api.put(`/events/${id}`, { status }); toast.success(`Status → ${status}`); fetchEvents(); }
    catch { toast.error('Failed to update status'); }
  };

  const statusColors = { upcoming:'badge-upcoming', ongoing:'badge-yellow', completed:'badge-participated' };

  if (loading) return <div className="empty-state"><div className="spinner" style={{width:32,height:32,borderTopColor:'var(--primary)'}}/></div>;

  return (
    <div>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div><h1>🎯 Events</h1><p>Manage all your events and certificate templates</p></div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📅</div>
          <p>No events yet. Create your first event!</p>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={openCreate}>Create Event</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {events.map(ev => (
            <div key={ev._id} className="card" style={{ display:'flex', alignItems:'center', gap:20 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <strong style={{ fontSize:16 }}>{ev.name}</strong>
                  <span className={`badge ${statusColors[ev.status] || 'badge-upcoming'}`}>{ev.status}</span>
                </div>
                <div style={{ color:'var(--text-secondary)', fontSize:13, display:'flex', gap:20, flexWrap:'wrap' }}>
                  <span>📅 {ev.date ? new Date(ev.date).toLocaleDateString('en-IN') : 'TBA'}</span>
                  {ev.venue && <span>📍 {ev.venue}</span>}
                  {ev.googleFormLink && <a href={ev.googleFormLink} target="_blank" rel="noreferrer" style={{color:'var(--primary)'}}>📋 Google Form</a>}
                  {ev.certificateTemplate && <span style={{ color:'var(--success)' }}>🎓 Template uploaded</span>}
                </div>
                {ev.description && <p style={{ color:'var(--text-muted)', fontSize:12, marginTop:6 }}>{ev.description}</p>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                <select className="form-control" style={{ width:'auto', fontSize:12, padding:'5px 10px' }}
                  value={ev.status}
                  onChange={e => updateStatus(ev._id, e.target.value)}>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => setWebhookEvent(ev)} title="Set up Google Form auto-email">🔗 Webhook</button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(ev)}>✏️ Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteEvent(ev._id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editEvent ? '✏️ Edit Event' : '✨ Create Event'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Event Name *</label>
                <input className="form-control" required value={form.name}
                  onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Hackathon 2025" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Event Date *</label>
                  <input type="date" className="form-control" required value={form.date}
                    onChange={e => setForm({...form, date:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Venue</label>
                  <input className="form-control" value={form.venue}
                    onChange={e => setForm({...form, venue:e.target.value})} placeholder="e.g. Main Auditorium" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={form.description}
                  onChange={e => setForm({...form, description:e.target.value})} placeholder="Brief description..." />
              </div>
              <div className="form-group">
                <label className="form-label">Google Form Registration Link</label>
                <input className="form-control" value={form.googleFormLink}
                  onChange={e => setForm({...form, googleFormLink:e.target.value})} placeholder="https://forms.google.com/..." />
              </div>
              <div className="form-group">
                <label className="form-label">Certificate Template (Image/PDF) — Optional</label>
                <input type="file" className="form-control" accept=".png,.jpg,.jpeg,.pdf"
                  onChange={e => setTemplateFile(e.target.files[0])} />
                <small style={{ color:'var(--text-muted)', fontSize:11 }}>Upload a background template. If not provided, a default dark gold certificate is generated.</small>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" />Saving...</> : (editEvent ? 'Update Event' : 'Create Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Webhook Setup Panel ── */}
      {webhookEvent && (() => {
        const webhookUrl = `${BACKEND_URL}/api/registrations/webhook/${webhookEvent._id}?key=${WEBHOOK_SECRET}`;
        const appsScript = `// MailCerti — Google Form Auto-Registration Script
// Paste this in: Google Form → ⋮ → Script Editor → Save → Add Trigger (onFormSubmit)

const WEBHOOK_URL = "${webhookUrl}";

function onFormSubmit(e) {
  try {
    var responses = e.response.getItemResponses();
    var data = {};
    responses.forEach(function(r) {
      data[r.getItem().getTitle()] = r.getResponse();
    });
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('MailCerti response: ' + response.getContentText());
  } catch(err) {
    Logger.log('MailCerti error: ' + err.toString());
  }
}`;

        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setWebhookEvent(null)}>
            <div className="modal" style={{ maxWidth: 680 }}>
              <div className="modal-header">
                <h2>🔗 Google Form Webhook — {webhookEvent.name}</h2>
                <button className="modal-close" onClick={() => setWebhookEvent(null)}>✕</button>
              </div>

              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                <span>ℹ️</span>
                <div>When a participant submits the Google Form, this script calls your backend <strong>instantly</strong> — saves the registration and sends a confirmation email automatically.</div>
              </div>

              {/* Step 1 */}
              <div className="section-title" style={{ marginBottom: 8 }}>Step 1 — Your Webhook URL</div>
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                <input className="form-control" readOnly value={webhookUrl} style={{ fontFamily:'monospace', fontSize:11 }} />
                <button className="btn btn-secondary" style={{ whiteSpace:'nowrap' }}
                  onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Webhook URL copied!'); }}>
                  📋 Copy
                </button>
              </div>

              {/* Step 2 */}
              <div className="section-title" style={{ marginBottom: 8 }}>Step 2 — Google Apps Script</div>
              <div style={{ position:'relative' }}>
                <textarea
                  readOnly
                  value={appsScript}
                  style={{
                    width:'100%', height:240, fontFamily:'monospace', fontSize:11,
                    background:'var(--bg-card2)', color:'var(--text-secondary)',
                    border:'1px solid var(--border)', borderRadius:8, padding:12,
                    resize:'none', lineHeight:1.6
                  }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ position:'absolute', top:8, right:8 }}
                  onClick={() => { navigator.clipboard.writeText(appsScript); toast.success('Script copied!'); }}>
                  📋 Copy Script
                </button>
              </div>

              {/* Step 3 instructions */}
              <div className="section-title" style={{ margin:'20px 0 10px' }}>Step 3 — Set Up in Google Form</div>
              <ol style={{ color:'var(--text-secondary)', fontSize:13, lineHeight:2, paddingLeft:20 }}>
                <li>Open your <strong>Google Form</strong> → click <strong>⋮ (3 dots)</strong> → <strong>Script Editor</strong></li>
                <li>Delete any existing code → <strong>Paste the script above</strong> → Save (Ctrl+S)</li>
                <li>Click <strong>+ Add Trigger</strong> (clock icon) → Function: <strong>onFormSubmit</strong> → Event: <strong>On form submit</strong> → Save</li>
                <li>Authorize when prompted → Done! ✅</li>
              </ol>

              <div className="alert alert-warning" style={{ marginTop:16 }}>
                <span>⚠️</span>
                <div><strong>Important:</strong> Your backend must be publicly accessible (not just localhost) for Google to reach it. Use <strong>ngrok</strong> for testing or deploy to Render/Railway for production. See instructions below.</div>
              </div>

              <div style={{ display:'flex', gap:10, marginTop:16, justifyContent:'flex-end' }}>
                <a href="https://ngrok.com/download" target="_blank" rel="noreferrer" className="btn btn-secondary">📡 Get ngrok</a>
                <button className="btn btn-primary" onClick={() => setWebhookEvent(null)}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
