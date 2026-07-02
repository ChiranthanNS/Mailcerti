import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import api from './api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

// ═══════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════

function StatusBadge({ status }) {
  const map = {
    registered:  { label: 'Registered',     color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
    shortlisted: { label: 'Shortlisted',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    rejected:    { label: 'Not Shortlisted', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    participated:{ label: 'Participated',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
    upcoming:    { label: 'Upcoming',        color: '#14B8A6', bg: 'rgba(20,184,166,0.1)' },
    ongoing:     { label: 'Ongoing',         color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    completed:   { label: 'Completed',       color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
    individual:  { label: 'Individual',      color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
    team:        { label: 'Team',            color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  };
  const s = map[status] || { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`
    }}>{s.label}</span>
  );
}

function Card({ children, className = '', style = {} }) {
  return (
    <div className={`card ${className}`} style={style}>{children}</div>
  );
}

function Modal({ show, onClose, title, children, wide }) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} style={{ maxWidth: wide ? 800 : 560 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', className = '', style = {}, ...props }) {
  return (
    <input 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      className={`form-control ${className}`}
      style={style}
      {...props}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 5, className = '', style = {} }) {
  return (
    <textarea 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      rows={rows}
      className={`form-control ${className}`}
      style={style}
    />
  );
}

function Select({ value, onChange, options, className = '', style = {} }) {
  return (
    <select 
      value={value} 
      onChange={onChange}
      className={`form-control ${className}`}
      style={style}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ children, onClick, variant = 'primary', disabled, loading, className = '', style = {}, type = 'button', size = 'md' }) {
  const btnClass = `btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`;
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled || loading}
      className={btnClass}
      style={style}
    >
      {loading ? <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} /> : null}
      {children}
    </button>
  );
}

function InfoBox({ icon, title, children, color = '#14B8A6' }) {
  return (
    <div style={{
      background: `${color}0D`, border: `1px solid ${color}30`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 16
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        <div>
          {title && <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 13, marginBottom: 4 }}>{title}</div>}
          <div style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.6 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: i < current ? '#14B8A6' : i === current ? 'linear-gradient(135deg,#14B8A6,#0D9488)' : 'rgba(255,255,255,0.06)',
              color: i <= current ? '#fff' : '#64748B',
              border: i === current ? '2px solid #14B8A6' : '2px solid transparent',
              boxShadow: i === current ? '0 0 0 4px rgba(20,184,166,0.15)' : 'none'
            }}>{i < current ? '✓' : i + 1}</div>
            <span style={{ fontSize: 10, color: i <= current ? '#14B8A6' : '#64748B', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{step}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? '#14B8A6' : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: 18, transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SpreadsheetMapper({ file, taskType, onMapped, onCancel }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [loading, setLoading] = useState(true);

  const isTeam = taskType === 'team';

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Get rows and headers
        const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const sheetHeaders = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
        
        setHeaders(sheetHeaders);
        setRows(parsedRows);

        if (sheetHeaders.length === 0) {
          toast.error("The selected spreadsheet is empty.");
          onCancel();
          return;
        }

        // Call backend to analyze headers
        const res = await api.post('/analyze-headers', { headers: sheetHeaders, taskType });
        setMappings(res.data);
      } catch (err) {
        toast.error("Failed to parse Excel file: " + err.message);
        onCancel();
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [file, taskType]);

  const targetFields = isTeam ? [
    { key: 'teamName', label: 'Team Name *', required: true },
    { key: 'name', label: 'Leader Name *', required: true },
    { key: 'email', label: 'Leader Email *', required: true },
    { key: 'member1Name', label: 'Member 1 Name', required: false },
    { key: 'member1Email', label: 'Member 1 Email', required: false },
    { key: 'member2Name', label: 'Member 2 Name', required: false },
    { key: 'member2Email', label: 'Member 2 Email', required: false },
    { key: 'member3Name', label: 'Member 3 Name', required: false },
    { key: 'member3Email', label: 'Member 3 Email', required: false },
    { key: 'college', label: 'College', required: false },
    { key: 'phone', label: 'Phone', required: false }
  ] : [
    { key: 'name', label: 'Participant Name *', required: true },
    { key: 'email', label: 'Participant Email *', required: true },
    { key: 'college', label: 'College Name', required: false },
    { key: 'phone', label: 'Phone Number', required: false }
  ];

  const handleFieldChange = (key, val) => {
    setMappings(prev => ({ ...prev, [key]: val }));
  };

  const handleConfirm = () => {
    // Validate required fields
    for (const field of targetFields) {
      if (field.required && (!mappings[field.key] || mappings[field.key] === '')) {
        toast.error(`Please map the required field: ${field.label}`);
        return;
      }
    }

    // Process rows
    const processed = rows.map((row, index) => {
      try {
        if (isTeam) {
          return {
            teamName: row[mappings.teamName] || '',
            name: row[mappings.name] || '',
            email: row[mappings.email] || '',
            memberNames: [
              row[mappings.member1Name],
              row[mappings.member2Name],
              row[mappings.member3Name]
            ].filter(Boolean),
            memberEmails: [
              row[mappings.member1Email],
              row[mappings.member2Email],
              row[mappings.member3Email]
            ].filter(Boolean),
            college: row[mappings.college] || '',
            phone: row[mappings.phone] || ''
          };
        } else {
          return {
            name: row[mappings.name] || '',
            email: row[mappings.email] || '',
            college: row[mappings.college] || '',
            phone: row[mappings.phone] || ''
          };
        }
      } catch (err) {
        console.error(`Row mapping failed at index ${index}:`, err);
        return null;
      }
    }).filter(Boolean);

    toast.success(`Successfully mapped ${processed.length} rows!`);
    onMapped(processed);
  };

  if (loading) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
        <div style={{ color: '#14B8A6', fontWeight: 600, fontSize: 15 }}>Analyzing spreadsheet columns with AI...</div>
        <div style={{ color: '#64748B', fontSize: 12, marginTop: 6 }}>Matching headers like Name, Email, and College automatically.</div>
      </Card>
    );
  }

  // Find unmapped columns
  const mappedCols = new Set(Object.values(mappings).filter(Boolean));
  const ignoredCols = headers.filter(h => !mappedCols.has(h));

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ margin: 0, color: '#F1F5F9', fontSize: 15 }}>🧠 Column Mapping Analysis</h3>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 12 }}>Review and correct AI mappings for <strong>{file.name}</strong></p>
        </div>
        <Btn variant="secondary" size="sm" onClick={onCancel}>Reset File</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {targetFields.map(field => (
          <Field key={field.key} label={field.label}>
            <Select
              value={mappings[field.key] || ''}
              onChange={e => handleFieldChange(field.key, e.target.value)}
              options={[
                { value: '', label: field.required ? '— Select Column * —' : '— Ignore / Unmapped —' },
                ...headers.map(h => ({ value: h, label: h }))
              ]}
            />
          </Field>
        ))}
      </div>

      {ignoredCols.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Ignored Columns ({ignoredCols.length}):</div>
          <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ignoredCols.map(c => <span key={c} style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4 }}>{c}</span>)}
          </div>
        </div>
      )}

      <Btn onClick={handleConfirm} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
        ✓ Confirm Mapping & Process ({rows.length} rows)
      </Btn>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// EVENT SELECTOR — used by Modules 2, 3, 4
// ═══════════════════════════════════════════════

// Optional event auto-fill panel (collapsible)
function EventAutoFill({ eventId, event, onChange }) {
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.get('/events').then(r => setEvents(r.data)).catch(() => {}); }, []);
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
        color: eventId ? '#14B8A6' : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit'
      }}>
        <span style={{ fontSize: 14 }}>{eventId ? '📅' : '🔗'}</span>
        {eventId ? `Linked to: ${event?.name}` : 'Link to an event (optional — for placeholders)'}
        <span style={{ fontSize: 10, marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 10px' }}>
            Optionally link to an event to auto-fill <code>{'{{eventName}}'}</code>, <code>{'{{eventDate}}'}</code>, etc. in emails. Not required.
          </p>
          <Select
            value={eventId}
            onChange={e => onChange(e.target.value, events.find(ev => ev._id === e.target.value))}
            options={[{ value: '', label: '— No event linked —' }, ...events.map(e => ({ value: e._id, label: `${e.name} (${e.status})` }))]}
          />
          {event && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusBadge status={event.status} />
              <StatusBadge status={event.participationType} />
              <span style={{ fontSize: 11, color: '#64748B' }}>
                📅 {new Date(event.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                {event.venue && ` · 📍 ${event.venue}`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventSelector({ selectedId, onChange, showNone = true }) {
  const [events, setEvents] = useState([]);
  useEffect(() => { api.get('/events').then(r => setEvents(r.data)).catch(() => {}); }, []);
  return (
    <Select
      value={selectedId}
      onChange={e => onChange(e.target.value, events.find(ev => ev._id === e.target.value))}
      options={[
        ...(showNone ? [{ value: '', label: '— No event linked (Standalone Mode) —' }] : []),
        ...events.map(e => ({ value: e._id, label: `${e.name} (${e.status})` }))
      ]}
    />
  );
}

// ═══════════════════════════════════════════════
// PAGE WRAPPER — consistent padding layout
// ═══════════════════════════════════════════════

function PageWrap({ children }) {
  return (
    <div style={{ padding: 28, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//   PAGE 1: EVENTS
//   Create events, manage registrations, set up Google Form
// ═══════════════════════════════════════════════

function EventForm({ event, onSave, onClose }) {
  const [form, setForm] = useState({
    name: event?.name || '',
    description: event?.description || '',
    date: event?.date ? new Date(event.date).toISOString().slice(0, 10) : '',
    venue: event?.venue || '',
    googleFormLink: event?.googleFormLink || '',
    participationType: event?.participationType || 'individual',
    teamEmailPolicy: event?.teamEmailPolicy || 'leader_only',
    status: event?.status || 'upcoming',
    confirmationSubject: event?.confirmationSubject || '',
    confirmationBody: event?.confirmationBody || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name || !form.date) return toast.error('Event name and date are required');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      let data;
      if (event?._id) {
        data = (await api.put(`/events/${event._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
      } else {
        data = (await api.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
      }
      toast.success(event?._id ? 'Event updated!' : 'Event created!');
      onSave(data);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Event Name *"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. TechFest 2026" /></Field>
        <Field label="Event Date *"><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
      </div>
      <Field label="Venue"><Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="e.g. Main Auditorium" /></Field>
      <Field label="Description"><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></Field>
      <Field label="Google Form Registration Link">
        <Input value={form.googleFormLink} onChange={e => setForm(f => ({ ...f, googleFormLink: e.target.value }))} placeholder="https://forms.gle/..." />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Field label="Participation Type">
          <Select value={form.participationType} onChange={e => setForm(f => ({ ...f, participationType: e.target.value }))}
            options={[{ value: 'individual', label: '👤 Individual' }, { value: 'team', label: '👥 Team' }]} />
        </Field>
        {form.participationType === 'team' && (
          <Field label="Team Mail Policy">
            <Select value={form.teamEmailPolicy} onChange={e => setForm(f => ({ ...f, teamEmailPolicy: e.target.value }))}
              options={[{ value: 'leader_only', label: 'Leader Only' }, { value: 'all_members', label: 'All Members' }]} />
          </Field>
        )}
        <Field label="Status">
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'ongoing', label: 'Ongoing' }, { value: 'completed', label: 'Completed' }]} />
        </Field>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 14, fontWeight: 700, textTransform: 'uppercase' }}>Custom Confirmation Email (optional)</div>
        <Field label="Subject" hint="Placeholders: {{name}}, {{eventName}}, {{eventDate}}">
          <Input value={form.confirmationSubject} onChange={e => setForm(f => ({ ...f, confirmationSubject: e.target.value }))} placeholder="Registration Confirmed — {{eventName}}" />
        </Field>
        <Field label="Body">
          <Textarea value={form.confirmationBody} onChange={e => setForm(f => ({ ...f, confirmationBody: e.target.value }))} rows={3} placeholder="Dear {{name}}, your registration for {{eventName}} is confirmed..." />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} loading={saving}>{event?._id ? 'Save Changes' : 'Create Event'}</Btn>
      </div>
    </div>
  );
}

function GoogleFormPanel({ event }) {
  if (!event) return null;
  const webhookUrl = `${BACKEND_URL}/api/registrations/webhook/${event._id}?key=mailcerti_wh_secret_2025`;
  const script = `function onFormSubmit(e) {
  var itemResponses = e.response.getItemResponses();
  var data = {};
  itemResponses.forEach(function(r) { data[r.getItem().getTitle()] = r.getResponse(); });
  var payload = {
    name: data['Full Name'] || data['Name'] || '',
    email: data['Email Address'] || data['Email'] || '',
    college: data['College'] || '',
    phone: data['Phone'] || '',
    teamName: data['Team Name'] || '',
    memberNames: data['Member Names'] || '',
    memberEmails: data['Member Emails'] || ''
  };
  UrlFetchApp.fetch('${webhookUrl}', {
    method: 'POST', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}`;

  return (
    <Card style={{ marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 16 }}>🔗 Google Form Setup</div>
      <InfoBox icon="📋" color="#14B8A6">
        Paste this webhook URL into a Google Apps Script trigger so registrations are auto-saved and confirmation emails are sent instantly.
      </InfoBox>
      {event.googleFormLink && (
        <Field label="Your Google Form">
          <a href={event.googleFormLink} target="_blank" rel="noopener noreferrer" style={{ color: '#14B8A6', fontSize: 13, wordBreak: 'break-all' }}>{event.googleFormLink}</a>
        </Field>
      )}
      <Field label="Webhook URL">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, padding: '9px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, fontSize: 12, color: '#14B8A6', fontFamily: 'monospace', wordBreak: 'break-all', border: '1px solid rgba(20,184,166,0.2)' }}>{webhookUrl}</div>
          <Btn variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied!'); }}>📋 Copy</Btn>
        </div>
      </Field>
      <Field label="Apps Script Code">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <Btn variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(script); toast.success('Script copied!'); }}>📋 Copy Script</Btn>
        </div>
        <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, overflow: 'auto', maxHeight: 240, fontSize: 11, color: '#94A3B8', lineHeight: 1.6, margin: 0, fontFamily: 'monospace' }}>{script}</pre>
      </Field>
      <div style={{ fontSize: 12, color: '#64748B', lineHeight: 2 }}>
        <strong style={{ color: '#94A3B8' }}>Setup:</strong>&nbsp;
        Form → ⋮ More → Script Editor → paste → Triggers → Add Trigger → onFormSubmit → On form submit → Save
      </div>
    </Card>
  );
}

function RegistrationsTable({ eventId, event }) {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadRegs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { eventId };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/registrations', { params });
      setRegs(data);
    } catch { toast.error('Failed to load registrations'); }
    finally { setLoading(false); }
  }, [eventId, filter]);

  useEffect(() => { loadRegs(); }, [loadRegs]);

  const filters = ['all', 'registered', 'shortlisted', 'rejected', 'participated'];

  return (
    <Card style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Registrations</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#14B8A6' : '#64748B'
            }}>{f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}</button>
          ))}
          <span style={{ marginLeft: 8, fontSize: 12, color: '#64748B', alignSelf: 'center' }}>{regs.length} records</span>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading...</div>
      ) : regs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748B', fontSize: 13 }}>No registrations yet. Use Import & Confirm or Google Form to add participants.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Name', 'Email', event?.participationType === 'team' ? 'Team' : 'College', 'Status', 'Emails'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={r._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', color: '#F1F5F9', fontWeight: 500 }}>
                    {r.name}
                    {r.isTeamLeader && event?.participationType === 'team' && (
                      <span style={{ fontSize: 10, color: '#14B8A6', marginLeft: 5, background: 'rgba(20,184,166,0.1)', padding: '1px 5px', borderRadius: 10 }}>Leader</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: 12 }}>{r.email}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: 12 }}>{r.teamName || r.college || '—'}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {r.confirmationEmailSent && <span title="Confirmation">✅</span>}
                      {r.shortlistEmailSent && <span title="Shortlisted">🌟</span>}
                      {r.rejectionEmailSent && <span title="Not Shortlisted">❌</span>}
                      {r.reminderEmailSent && <span title="Reminder">⏰</span>}
                      {r.certificateEmailSent && <span title="Certificate">🏅</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setLoading(true);
    try { const { data } = await api.get('/events'); setEvents(data); }
    catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event and all its registrations?')) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success('Deleted');
      if (selectedEvent?._id === id) setSelectedEvent(null);
      loadEvents();
    } catch { toast.error('Delete failed'); }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: Event List */}
      <div style={{ width: 290, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' }}>
        <div style={{ padding: '20px 14px 10px', position: 'sticky', top: 0, background: '#080C14', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>All Events</h2>
            <Btn size="sm" onClick={() => { setEditingEvent(null); setShowModal(true); }}>+ New</Btn>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 20, color: '#64748B', fontSize: 13 }}>Loading...</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>No events yet</div>
            <Btn size="sm" onClick={() => setShowModal(true)}>Create first event</Btn>
          </div>
        ) : (
          events.map(ev => (
            <div key={ev._id} onClick={() => setSelectedEvent(ev)}
              style={{
                padding: '13px 14px', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: selectedEvent?._id === ev._id ? 'rgba(20,184,166,0.08)' : 'transparent',
                borderLeft: `3px solid ${selectedEvent?._id === ev._id ? '#14B8A6' : 'transparent'}`,
                transition: 'all 0.15s'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 13, flex: 1, marginRight: 8 }}>{ev.name}</div>
                <StatusBadge status={ev.status} />
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5 }}>
                📅 {new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {ev.venue && ` · 📍 ${ev.venue}`}
              </div>
              <StatusBadge status={ev.participationType} />
            </div>
          ))
        )}
      </div>

      {/* Right: Event Detail */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!selectedEvent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748B', gap: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8' }}>Select an event to manage</div>
            <div style={{ fontSize: 13 }}>or create a new one using the button on the left</div>
          </div>
        ) : (
          <>
            {/* Event Header */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F1F5F9' }}>{selectedEvent.name}</h1>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>
                    📅 {new Date(selectedEvent.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                    {selectedEvent.venue && ` · 📍 ${selectedEvent.venue}`}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <StatusBadge status={selectedEvent.status} />
                    <StatusBadge status={selectedEvent.participationType} />
                    {selectedEvent.participationType === 'team' && (
                      <span style={{ fontSize: 11, color: '#94A3B8', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 20 }}>
                        Mail: {selectedEvent.teamEmailPolicy === 'all_members' ? 'All members' : 'Leader only'}
                      </span>
                    )}
                  </div>
                  {selectedEvent.googleFormLink && (
                    <div style={{ marginTop: 10 }}>
                      <a href={selectedEvent.googleFormLink} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#14B8A6' }}>🔗 Open Google Form ↗</a>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn size="sm" variant="secondary" onClick={() => { setEditingEvent(selectedEvent); setShowModal(true); }}>✏️ Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => deleteEvent(selectedEvent._id)}>🗑️ Delete</Btn>
                </div>
              </div>
            </Card>

            {/* Tip cards for other modules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
              {[
                { icon: '📤', label: 'Import & Confirm', route: '/import', color: '#6366F1', desc: 'Upload Excel + auto confirmation mail' },
                { icon: '✉️', label: 'Send Emails',       route: '/send-emails', color: '#F59E0B', desc: 'Targeted custom email campaigns' },
                { icon: '🏅', label: 'Certificates',      route: '/certificates', color: '#8B5CF6', desc: 'Generate & send certificates' },
              ].map(m => (
                <a key={m.route} href={m.route} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: 16, borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${m.color}25`,
                    background: `${m.color}08`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                    <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 13 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{m.desc}</div>
                    <div style={{ marginTop: 10, fontSize: 11, color: m.color, fontWeight: 600 }}>Go to section →</div>
                  </div>
                </a>
              ))}
            </div>

            {/* Google Form Panel */}
            <GoogleFormPanel event={selectedEvent} />

            {/* Registrations Table */}
            <RegistrationsTable eventId={selectedEvent._id} event={selectedEvent} />
          </>
        )}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editingEvent ? 'Edit Event' : 'Create New Event'} wide>
        <EventForm event={editingEvent} onSave={(ev) => { loadEvents(); setSelectedEvent(ev); setShowModal(false); }} onClose={() => setShowModal(false)} />
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//   PAGE 2: IMPORT & CONFIRM (Module 2)
// ═══════════════════════════════════════════════

export function ImportConfirm() {
  const [eventId, setEventId] = useState('');
  const [event, setEvent] = useState(null);
  const [file, setFile] = useState(null);
  const [mappedRegistrations, setMappedRegistrations] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [participationType, setParticipationType] = useState('individual');
  // Confirmation email
  const [confirmSubject, setConfirmSubject] = useState('');
  const [confirmBody, setConfirmBody] = useState('');

  function reset() {
    setFile(null);
    setMappedRegistrations(null);
    setResult(null);
  }

  async function handleImport() {
    if (!mappedRegistrations) return toast.error('Please map spreadsheet columns first');
    setImporting(true);
    try {
      const payload = {
        eventId: eventId || undefined,
        participationType,
        confirmSubject: confirmSubject || undefined,
        confirmBody: confirmBody || undefined,
        registrations: mappedRegistrations
      };
      const { data } = await api.post('/registrations/import', payload);
      setResult(data);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally { setImporting(false); }
  }

  const isTeam = event ? event.participationType === 'team' : participationType === 'team';

  return (
    <PageWrap>
      <div style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#F1F5F9' }}>📤 Import & Confirm</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>
            Upload your Excel sheet — AI maps your columns, and confirmation emails are sent automatically.
          </p>
        </div>

        {result ? (
          <Card style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: '#F1F5F9', margin: '0 0 8px' }}>Import Complete</h3>
            <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 20 }}>
              <span style={{ color: '#14B8A6', fontWeight: 700 }}>{result.added}</span> added &nbsp;·&nbsp;
              <span style={{ color: '#F59E0B', fontWeight: 700 }}>{result.skipped}</span> skipped &nbsp;·&nbsp;
              <span style={{ color: '#8B5CF6', fontWeight: 700 }}>{result.emailsSent}</span> emails sent
            </div>
            {result.errors?.length > 0 && (
              <div style={{ textAlign: 'left', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, marginBottom: 6 }}>Errors ({result.errors.length}):</div>
                {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>Row {e.row}: {e.reason}</div>)}
              </div>
            )}
            <Btn onClick={reset} variant="secondary">📤 Import Another File</Btn>
          </Card>
        ) : (
          <>
            {/* Optional event link */}
            <EventAutoFill eventId={eventId} event={event} onChange={(id, ev) => { setEventId(id); setEvent(ev); reset(); }} />

            {/* Participation type (only shown if no event linked) */}
            {!event && !file && (
              <Card style={{ marginBottom: 16 }}>
                <Field label="Participation Type">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{ v: 'individual', l: '👤 Individual', d: 'name, email, college, phone' }, { v: 'team', l: '👥 Team', d: 'team_name, leader, members...' }].map(o => (
                      <div key={o.v} onClick={() => setParticipationType(o.v)} style={{
                        flex: 1, padding: 14, borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${participationType === o.v ? '#14B8A6' : 'rgba(255,255,255,0.08)'}`,
                        background: participationType === o.v ? 'rgba(20,184,166,0.1)' : 'rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 13 }}>{o.l}</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, fontFamily: 'monospace' }}>{o.d}</div>
                      </div>
                    ))}
                  </div>
                </Field>
              </Card>
            )}

            {/* Upload or Map spreadsheet */}
            {!file && (
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Spreadsheet</div>
                <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                  <input type="file" accept=".xlsx,.xls,.csv" id="importFile" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
                  <label htmlFor="importFile" style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 14, color: '#94A3B8' }}>Click to select .xlsx / .xls / .csv</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Any spreadsheet structure is accepted. Columns will be analyzed by AI.</div>
                  </label>
                </div>
              </Card>
            )}

            {file && !mappedRegistrations && (
              <SpreadsheetMapper
                file={file}
                taskType={isTeam ? 'team' : 'individual'}
                onMapped={(data) => setMappedRegistrations(data)}
                onCancel={reset}
              />
            )}

            {mappedRegistrations && (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#14B8A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>✓ Columns Mapped</div>
                    <Btn variant="secondary" size="sm" onClick={reset}>Reset File</Btn>
                  </div>
                  <div style={{ fontSize: 14, color: '#F1F5F9', marginBottom: 10 }}>
                    Successfully mapped <strong>{mappedRegistrations.length}</strong> registration records from <strong>{file.name}</strong>.
                  </div>
                  <div style={{ maxHeight: 150, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Data Preview:</div>
                    {mappedRegistrations.slice(0, 3).map((r, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: '#94A3B8', marginBottom: idx < 2 ? 6 : 0, paddingBottom: idx < 2 ? 6 : 0, borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <strong>Name:</strong> {r.name} · <strong>Email:</strong> {r.email} {isTeam && `· <strong>Team:</strong> ${r.teamName}`} {r.college && `· <strong>College:</strong> ${r.college}`}
                      </div>
                    ))}
                    {mappedRegistrations.length > 3 && <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>+ {mappedRegistrations.length - 3} more records</div>}
                  </div>
                </Card>

                {/* Custom confirmation mail */}
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confirmation Email (optional)</div>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>Leave blank to use the default confirmation message. Placeholders: <code>{`{{name}}`}</code> <code>{`{{eventName}}`}</code></p>
                  <Field label="Subject">
                    <Input value={confirmSubject} onChange={e => setConfirmSubject(e.target.value)} placeholder="Registration Confirmed — {{eventName}}" />
                  </Field>
                  <Field label="Body">
                    <Textarea value={confirmBody} onChange={e => setConfirmBody(e.target.value)} rows={3} placeholder={`Dear {{name}},\n\nYour registration is confirmed!\n\nRegards,\n{{orgName}}`} />
                  </Field>
                </Card>

                <InfoBox icon="✉️" color="#14B8A6">
                  Duplicate emails already in the system are automatically skipped. Each participant receives exactly one confirmation email.
                </InfoBox>
                <Btn onClick={handleImport} loading={importing} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
                  📤 Import & Send Confirmation Emails
                </Btn>
              </>
            )}
          </>
        )}
      </div>
    </PageWrap>
  );
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//   PAGE 3: SEND EMAILS (Module 3)
// ═══════════════════════════════════════════════

const MAIL_TYPES = [
  { value: 'shortlisted',     label: 'Shortlisted',     icon: '🌟', desc: 'Inform selected participants',    color: '#F59E0B' },
  { value: 'not_shortlisted', label: 'Not Shortlisted',  icon: '❌', desc: 'Politely inform non-selected',   color: '#EF4444' },
  { value: 'reminder',        label: 'Reminder',         icon: '⏰', desc: 'Event reminder',                 color: '#6366F1' },
  { value: 'confirmation',    label: 'Re-Confirmation',  icon: '✅', desc: 'Re-send registration confirm',   color: '#14B8A6' },
  { value: 'custom',          label: 'Custom',           icon: '✉️', desc: 'Any custom message',             color: '#8B5CF6' },
];

const PLACEHOLDERS = ['{{name}}', '{{eventName}}', '{{eventDate}}', '{{eventVenue}}', '{{orgName}}', '{{teamName}}'];

export function SendEmails() {
  const [eventId, setEventId] = useState('');
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState(0);       // 0=type, 1=compose, 2=preview, 3=done
  const [mailType, setMailType] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // Recipients: excel file OR pull from DB (only if event linked)
  const [recipientMode, setRecipientMode] = useState('excel'); // 'excel' | 'db'
  const [file, setFile] = useState(null);
  const [mappedRecipients, setMappedRecipients] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [hasAiDraft, setHasAiDraft] = useState(false);
  const [prevSubject, setPrevSubject] = useState('');
  const [prevBody, setPrevBody] = useState('');

  useEffect(() => {
    if (!eventId) setRecipientMode('excel');
  }, [eventId]);

  function reset() {
    setStep(0);
    setMailType('');
    setSubject('');
    setBody('');
    setFile(null);
    setMappedRecipients(null);
    setResult(null);
    setHasAiDraft(false);
    setPrevSubject('');
    setPrevBody('');
  }

  const previewText = body
    .replace(/\{\{name\}\}/g, 'John Doe').replace(/\{\{eventName\}\}/g, event?.name || 'TechFest')
    .replace(/\{\{eventDate\}\}/g, event?.date ? new Date(event.date).toLocaleDateString('en-IN') : '15 Jan 2026')
    .replace(/\{\{eventVenue\}\}/g, event?.venue || 'Main Hall').replace(/\{\{orgName\}\}/g, 'Event Team')
    .replace(/\{\{teamName\}\}/g, 'Team Alpha');

  async function handleAiGenerate() {
    setAiGenerating(true);
    try {
      const { data } = await api.post('/compose/generate', {
        emailType: mailType, eventName: event?.name, eventDate: event?.date, eventVenue: event?.venue, tone: 'professional'
      });
      setPrevSubject(subject);
      setPrevBody(body);
      setSubject(data.subject || '');
      setBody(data.body || data.html || '');
      setHasAiDraft(true);
      toast.success('AI generated your email!');
    } catch (e) { toast.error(e.response?.data?.error || 'AI generation failed'); }
    finally { setAiGenerating(false); }
  }

  async function handleTestSend() {
    if (!testEmail || !subject || !body) return toast.error('Fill subject, body, and test email');
    setTestSending(true);
    try {
      await api.post('/compose/test-send', { to: testEmail, subject, body, eventId });
      toast.success(`Test email sent to ${testEmail}`);
    } catch (e) { toast.error(e.response?.data?.error || 'Test failed'); }
    finally { setTestSending(false); }
  }

  async function handleSendAll() {
    setSending(true);
    try {
      const payload = {
        eventId: eventId || undefined,
        mailType,
        subject,
        body,
        recipients: recipientMode === 'excel' ? mappedRecipients : undefined
      };
      const { data } = await api.post('/registrations/send-targeted', payload);
      setResult(data); setStep(3);
    } catch (e) { toast.error(e.response?.data?.error || 'Send failed'); }
    finally { setSending(false); }
  }

  return (
    <PageWrap>
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#F1F5F9' }}>✉️ Send Emails</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>
            Compose and send targeted emails — upload your own Excel list or pull from an event's registrations.
          </p>
        </div>

        {step === 3 && result ? (
          <Card style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: '#F1F5F9', margin: '0 0 12px' }}>Emails Dispatched!</h3>
            <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 24 }}>
              Sent: <strong style={{ color: '#14B8A6' }}>{result.sent}</strong> &nbsp;·&nbsp;
              Failed: <strong style={{ color: '#EF4444' }}>{result.failed}</strong> &nbsp;·&nbsp;
              Total: <strong style={{ color: '#F1F5F9' }}>{result.total}</strong>
            </div>
            {result.errors?.length > 0 && (
              <div style={{ textAlign: 'left', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>{e.email}: {e.error}</div>)}
              </div>
            )}
            <Btn onClick={reset} variant="secondary">✉️ Send Another Email</Btn>
          </Card>
        ) : (
          <Card>
            <StepIndicator steps={['Choose Type', 'Compose', 'Preview & Send']} current={step} />

            {/* STEP 0: Choose mail type */}
            {step === 0 && (
              <div>
                <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>What type of email do you want to send?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {MAIL_TYPES.map(mt => (
                    <div key={mt.value} onClick={() => { setMailType(mt.value); setStep(1); }}
                      style={{
                        padding: 16, borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${mt.color}30`, background: `${mt.color}08`,
                        transition: 'all 0.2s'
                      }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{mt.icon}</div>
                      <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 14 }}>{mt.label}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{mt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 1: Compose */}
            {step === 1 && (
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge status={mailType} />
                  <Btn variant="ghost" size="sm" onClick={() => setStep(0)}>← Back</Btn>
                  <Btn variant="secondary" size="sm" onClick={handleAiGenerate} loading={aiGenerating}>✨ Generate with AI</Btn>
                </div>

                {/* Optional event link for placeholder auto-fill */}
                <EventAutoFill eventId={eventId} event={event} onChange={(id, ev) => { setEventId(id); setEvent(ev); }} />

                <InfoBox icon="💡" color="#8B5CF6">
                  Placeholders:&nbsp;
                  {PLACEHOLDERS.map(p => <code key={p} style={{ background: 'rgba(139,92,246,0.2)', padding: '1px 5px', borderRadius: 4, fontSize: 11, margin: '0 2px' }}>{p}</code>)}
                </InfoBox>

                {hasAiDraft && (
                  <div style={{
                    background: 'rgba(20, 184, 166, 0.06)',
                    border: '1px solid rgba(20, 184, 166, 0.2)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <div style={{ fontWeight: '700', color: '#14B8A6', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✨ AI Draft Populated</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        Do you want to keep this generated version or revert to your original text?
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Btn variant="primary" size="sm" onClick={() => setHasAiDraft(false)}>
                        Keep Draft
                      </Btn>
                      <Btn variant="secondary" size="sm" onClick={() => {
                        setSubject(prevSubject);
                        setBody(prevBody);
                        setHasAiDraft(false);
                        toast.success('Restored your original text');
                      }}>
                        Revert
                      </Btn>
                    </div>
                  </div>
                )}

                <Field label="Subject Line">
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. 🌟 You're Shortlisted for {{eventName}}!" />
                </Field>
                <Field label="Email Body">
                  <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
                    placeholder={`Dear {{name}},\n\nWe are pleased to inform you...\n\nRegards,\n{{orgName}}`} />
                </Field>

                {/* Recipient source */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase' }}>Send To</div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div onClick={() => { setRecipientMode('excel'); setFile(null); setMappedRecipients(null); }} style={{
                      flex: 1, padding: 12, borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${recipientMode === 'excel' ? '#14B8A6' : 'rgba(255,255,255,0.08)'}`,
                      background: recipientMode === 'excel' ? 'rgba(20,184,166,0.08)' : 'rgba(255,255,255,0.02)'
                    }}>
                      <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 13 }}>📤 Upload Excel List</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>name, email columns</div>
                    </div>
                    {eventId && (
                      <div onClick={() => { setRecipientMode('db'); setFile(null); setMappedRecipients(null); }} style={{
                        flex: 1, padding: 12, borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${recipientMode === 'db' ? '#14B8A6' : 'rgba(255,255,255,0.08)'}`,
                        background: recipientMode === 'db' ? 'rgba(20,184,166,0.08)' : 'rgba(255,255,255,0.02)'
                      }}>
                        <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 13 }}>🗄️ From Linked Event</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>All registered participants</div>
                      </div>
                    )}
                  </div>
                  {recipientMode === 'excel' && (
                    <div style={{ marginTop: 10 }}>
                      {!file ? (
                        <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                          <input type="file" accept=".xlsx,.xls,.csv" id="recipientFile" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
                          <label htmlFor="recipientFile" style={{ cursor: 'pointer' }}>
                            <div style={{ fontSize: 13, color: '#94A3B8' }}>Select Spreadsheet File</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>AI will map the name and email columns.</div>
                          </label>
                        </div>
                      ) : !mappedRecipients ? (
                        <SpreadsheetMapper
                          file={file}
                          taskType="individual"
                          onMapped={(data) => setMappedRecipients(data)}
                          onCancel={() => { setFile(null); setMappedRecipients(null); }}
                        />
                      ) : (
                        <div style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 10, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#14B8A6' }}>✓ Spreadsheet Mapped ({mappedRecipients.length} recipients)</span>
                            <Btn variant="secondary" size="sm" onClick={() => { setFile(null); setMappedRecipients(null); }}>Change</Btn>
                          </div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>
                            File: <strong>{file.name}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Btn onClick={() => {
                  if (!subject || !body) return toast.error('Fill subject and body first');
                  if (recipientMode === 'excel' && !mappedRecipients) return toast.error('Please map recipient Excel file first');
                  setStep(2);
                }} style={{ width: '100%', justifyContent: 'center' }}>
                  Next: Preview →
                </Btn>
              </div>
            )}

            {/* STEP 2: Preview & Send */}
            {step === 2 && (
              <div>
                <Btn variant="ghost" size="sm" onClick={() => setStep(1)} style={{ marginBottom: 16 }}>← Back to Edit</Btn>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Email Preview (sample recipient: John Doe)</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 10 }}>
                    Subject: {(subject || '').replace(/\{\{name\}\}/g, 'John Doe').replace(/\{\{eventName\}\}/g, event?.name || '')}
                  </div>
                  <div style={{ background: '#fff', borderRadius: 8, padding: 16, color: '#333', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {previewText}
                  </div>
                </div>

                <div style={{ background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8, fontWeight: 600 }}>🧪 Send a test email to yourself first</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" type="email" style={{ flex: 1 }} />
                    <Btn variant="secondary" size="sm" onClick={handleTestSend} loading={testSending}>Send Test</Btn>
                  </div>
                </div>

                <InfoBox icon="⚠️" color="#F59E0B">
                  Once you confirm, emails are sent to <strong>all matching recipients</strong> for this event. This cannot be undone.
                </InfoBox>

                <Btn onClick={handleSendAll} loading={sending} style={{ width: '100%', justifyContent: 'center' }} size="lg">
                  📤 Confirm — Send to All Recipients
                </Btn>
              </div>
            )}
          </Card>
        )}
      </div>
    </PageWrap>
  );
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//   PAGE 4: CERTIFICATES (Module 4)
// ═══════════════════════════════════════════════

export function Certificates() {
  const [eventId, setEventId] = useState('');
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState(0);     // 0=setup, 1=design, 2=review, 3=send, 4=done
  const [certFile, setCertFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [mappedParticipants, setMappedParticipants] = useState(null);
  const [sourceType, setSourceType] = useState('db');
  const [config, setConfig] = useState({ certNameX: 50, certNameY: 50, certFontSize: 48, certFontColor: '#000000' });
  const [certSubject, setCertSubject] = useState('');
  const [certBody, setCertBody] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!eventId) {
      setSourceType('excel');
    }
  }, [eventId]);

  useEffect(() => {
    if (event) {
      setConfig({
        certNameX: event.certNameX ?? 50,
        certNameY: event.certNameY ?? 50,
        certFontSize: event.certFontSize ?? 48,
        certFontColor: event.certFontColor ?? '#000000'
      });
      setCertSubject(event.certificateSubject || '');
      setCertBody(event.certificateBody || '');
    } else {
      setConfig({ certNameX: 50, certNameY: 50, certFontSize: 48, certFontColor: '#000000' });
      setCertSubject('');
      setCertBody('');
    }
  }, [event]);

  // Debounce live certificate preview rendering in Step 1
  useEffect(() => {
    if (step !== 1) return;
    if (!eventId && !certFile) return;

    setLoadingPreview(true);

    const timer = setTimeout(() => {
      triggerPreview();
    }, 500);

    return () => clearTimeout(timer);
  }, [config.certNameX, config.certNameY, config.certFontSize, config.certFontColor, step]);

  // Cleanup blob URL when it changes or unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function resetWizard() {
    setStep(0);
    setCertFile(null);
    setExcelFile(null);
    setMappedParticipants(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setParticipants([]);
    setConfirmed(false);
    setResult(null);
  }

  async function triggerPreview() {
    try {
      const token = localStorage.getItem('mailcerti_token');
      let blob;

      if (eventId) {
        // Event mode: first save settings to backend (allows template update if loaded)
        const fd = new FormData();
        if (certFile) fd.append('certificateTemplate', certFile);
        Object.entries(config).forEach(([k, v]) => fd.append(k, v));
        fd.append('certificateSubject', certSubject);
        fd.append('certificateBody', certBody);
        await api.put(`/events/${eventId}/cert-settings`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

        // Fetch PDF preview
        const resp = await fetch(`${BACKEND_URL}/api/events/${eventId}/preview-certificate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sampleName: 'Sample Participant', ...config })
        });
        if (!resp.ok) throw new Error('Preview failed');
        blob = await resp.blob();
      } else {
        // Standalone mode: send template file dynamically along with preview request
        const fd = new FormData();
        if (certFile) fd.append('certificateTemplate', certFile);
        Object.entries(config).forEach(([k, v]) => fd.append(k, v));
        fd.append('sampleName', 'Sample Participant');
        fd.append('eventName', 'Event');
        fd.append('date', '15 January 2026');

        const resp = await fetch(`${BACKEND_URL}/api/registrations/preview-certificate-standalone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        if (!resp.ok) throw new Error('Preview failed');
        blob = await resp.blob();
      }

      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error('Preview error:', e);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function loadParticipants() {
    setLoadingParticipants(true);
    try {
      if (sourceType === 'db' && eventId) {
        const { data } = await api.get('/registrations', { params: { eventId, status: 'shortlisted' } });
        setParticipants(data.filter(r => !r.certificateEmailSent));
      } else {
        setParticipants(mappedParticipants || []);
      }
      setStep(2);
    } catch { toast.error('Failed to load participants'); }
    finally { setLoadingParticipants(false); }
  }

  async function handleSend() {
    if (!confirmed) return toast.error('Please confirm the participant list first');
    setSending(true);
    try {
      const fd = new FormData();
      Object.entries(config).forEach(([k, v]) => fd.append(k, v));
      fd.append('certificateSubject', certSubject);
      fd.append('certificateBody', certBody);
      
      if (eventId) {
        fd.append('eventId', eventId);
      }
      
      // Standalone or custom Excel: send participants as serialized JSON
      if (sourceType === 'excel') {
        fd.append('participants', JSON.stringify(participants.map(p => ({ name: p.name, email: p.email }))));
      } else if (!eventId) {
        fd.append('participants', JSON.stringify(participants.map(p => ({ name: p.name, email: p.email }))));
      }

      // Standalone: upload certificate template file
      if (!eventId && certFile) {
        fd.append('certificateTemplate', certFile);
      }

      const { data } = await api.post('/registrations/send-certificates', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
      setStep(4);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Certificate dispatch failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <PageWrap>
      <div style={{ maxWidth: 840 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#F1F5F9' }}>🏅 Certificates</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>
            Upload your certificate template, configure name placement, preview, then send — safely.
          </p>
        </div>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Event</div>
          <EventSelector selectedId={eventId} onChange={(id, ev) => { setEventId(id); setEvent(ev); resetWizard(); }} />
        </Card>

        {step === 4 && result ? (
          <Card style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{result.failed === 0 ? '🎉' : '⚠️'}</div>
            <h3 style={{ color: '#F1F5F9', margin: '0 0 12px' }}>Certificate Dispatch Complete</h3>
            <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 24 }}>
              Sent: <strong style={{ color: '#14B8A6' }}>{result.sent}</strong> &nbsp;·&nbsp;
              Failed: <strong style={{ color: '#EF4444' }}>{result.failed}</strong> &nbsp;·&nbsp;
              Total: <strong style={{ color: '#F1F5F9' }}>{result.total}</strong>
            </div>
            {result.errors?.length > 0 && (
              <div style={{ textAlign: 'left', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, marginBottom: 6 }}>Failed (retry from Events page):</div>
                {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>{e.name} ({e.email}): {e.error}</div>)}
              </div>
            )}
            <Btn onClick={resetWizard} variant="secondary">🏅 Send for Another Event</Btn>
          </Card>
        ) : (
          <Card>
            <StepIndicator steps={['Setup', 'Design & Preview', 'Review', 'Send']} current={step} />

            {/* STEP 0: Setup Template & Source */}
            {step === 0 && (
              <div>
                <InfoBox icon="🖼️" color="#14B8A6">
                  Upload your certificate background image (PNG or JPG). The participant's name will be overlaid on it.
                  {event?.certificateTemplate && <strong> A template is already saved — you can skip re-uploading.</strong>}
                  {!eventId && <strong> (Standalone Mode: Uploading template is required).</strong>}
                </InfoBox>

                <Field label="Certificate Template (PNG / JPG)">
                  <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.01)', marginBottom: 16 }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                    <input type="file" accept=".png,.jpg,.jpeg" id="certTemplate" style={{ display: 'none' }} onChange={e => setCertFile(e.target.files[0])} />
                    <label htmlFor="certTemplate" style={{ cursor: 'pointer', fontSize: 13, color: certFile ? '#14B8A6' : '#94A3B8', fontWeight: certFile ? 600 : 400 }}>
                      {certFile ? `✓ ${certFile.name}` : 'Click to select certificate template'}
                    </label>
                  </div>
                </Field>

                {eventId && (
                  <Field label="Participant Source">
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                      {[{ sourceTypeKey: 'db', title: '🗄️ Shortlisted (from Database)', desc: 'All shortlisted registrations not yet sent' }, { sourceTypeKey: 'excel', title: '📤 Upload Excel', desc: 'Custom name + email list' }].map(o => (
                        <div key={o.sourceTypeKey} onClick={() => { setSourceType(o.sourceTypeKey); setExcelFile(null); setMappedParticipants(null); }} style={{
                          flex: 1, padding: 14, borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${sourceType === o.sourceTypeKey ? '#14B8A6' : 'rgba(255,255,255,0.08)'}`,
                          background: sourceType === o.sourceTypeKey ? 'rgba(20,184,166,0.1)' : 'rgba(255,255,255,0.02)'
                        }}>
                          <div style={{ fontWeight: 700, color: '#F1F5F9', fontSize: 13 }}>{o.title}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{o.desc}</div>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}

                {sourceType === 'excel' && (
                  <div style={{ marginBottom: 16 }}>
                    {!excelFile ? (
                      <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                        <input type="file" accept=".xlsx,.xls,.csv" id="certExcel" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setExcelFile(e.target.files[0]); }} />
                        <label htmlFor="certExcel" style={{ cursor: 'pointer' }}>
                          <div style={{ fontSize: 14, color: '#94A3B8' }}>Select Participant Spreadsheet File</div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>AI will map the name and email columns.</div>
                        </label>
                      </div>
                    ) : !mappedParticipants ? (
                      <SpreadsheetMapper
                        file={excelFile}
                        taskType="individual"
                        onMapped={(data) => setMappedParticipants(data)}
                        onCancel={() => { setExcelFile(null); setMappedParticipants(null); }}
                      />
                    ) : (
                      <div style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#14B8A6' }}>✓ Spreadsheet Mapped ({mappedParticipants.length} participants)</span>
                          <Btn variant="secondary" size="sm" onClick={() => { setExcelFile(null); setMappedParticipants(null); }}>Change</Btn>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          File: <strong>{excelFile.name}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Btn 
                  onClick={() => {
                    if (!eventId && !certFile) return toast.error('Please upload a certificate template');
                    if (sourceType === 'excel' && !mappedParticipants) return toast.error('Please map participant Excel file first');
                    setStep(1);
                  }} 
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                >
                  Next: Design & Live Preview →
                </Btn>
              </div>
            )}

            {/* STEP 1: Design & Preview */}
            {step === 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, minHeight: 480 }}>
                {/* Left Panel: Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ margin: 0, color: '#F1F5F9', fontSize: 15 }}>Live Adjustments</h3>
                    <Btn variant="ghost" size="sm" onClick={() => setStep(0)}>← Back</Btn>
                  </div>

                  <Field label={`Name X Position: ${config.certNameX}%`}>
                    <input type="range" min="0" max="100" value={config.certNameX}
                      onChange={e => setConfig(c => ({ ...c, certNameX: +e.target.value }))}
                      style={{ width: '100%', accentColor: '#14B8A6' }} />
                  </Field>
                  
                  <Field label={`Name Y Position: ${config.certNameY}%`}>
                    <input type="range" min="0" max="100" value={config.certNameY}
                      onChange={e => setConfig(c => ({ ...c, certNameY: +e.target.value }))}
                      style={{ width: '100%', accentColor: '#14B8A6' }} />
                  </Field>

                  <Field label={`Font Size: ${config.certFontSize}px`}>
                    <input type="range" min="16" max="96" step="2" value={config.certFontSize}
                      onChange={e => setConfig(c => ({ ...c, certFontSize: +e.target.value }))}
                      style={{ width: '100%', accentColor: '#14B8A6' }} />
                  </Field>

                  <Field label="Font Color">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input type="color" value={config.certFontColor}
                        onChange={e => setConfig(c => ({ ...c, certFontColor: e.target.value }))}
                        style={{ width: 44, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }} />
                      <Input value={config.certFontColor} onChange={e => setConfig(c => ({ ...c, certFontColor: e.target.value }))} style={{ flex: 1 }} />
                    </div>
                  </Field>

                  <Field label="Certificate Email Subject" hint="Placeholder: {{name}}, {{eventName}}">
                    <Input value={certSubject} onChange={e => setCertSubject(e.target.value)} placeholder={`🎓 Your Certificate — ${event?.name || '{{eventName}}'}`} />
                  </Field>

                  <Field label="Certificate Email Body (optional)">
                    <Textarea value={certBody} onChange={e => setCertBody(e.target.value)} rows={3}
                      placeholder="Dear {{name}}, please find your certificate attached." />
                  </Field>

                  <Btn onClick={loadParticipants} loading={loadingParticipants} style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
                    Looks Good — Review Participants →
                  </Btn>
                </div>

                {/* Right Panel: Live PDF Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Live Certificate Preview</span>
                    {loadingPreview && <span style={{ fontSize: 11, color: '#14B8A6', fontWeight: 600 }}>⏳ Syncing adjustments...</span>}
                  </div>
                  <div style={{ flex: 1, minHeight: 380, position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                    {previewUrl ? (
                      <iframe src={previewUrl} style={{ width: '100%', height: '100%', minHeight: 380, border: 'none', background: '#fff' }} title="Certificate Preview" />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B', fontSize: 13 }}>
                        Generating live preview...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Review Participants */}
            {step === 2 && (
              <div>
                <Btn variant="ghost" size="sm" onClick={() => setStep(1)} style={{ marginBottom: 16 }}>← Back to Design</Btn>
                <InfoBox icon="🔍" color="#F59E0B">
                  <strong>Review carefully.</strong> Each person below will receive <strong>only their own certificate</strong> to their own email address.
                  No duplicates, no wrong sends.
                </InfoBox>
                {sourceType === 'db' && eventId ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 10 }}>
                      {participants.length} participant(s) found (shortlisted, certificate not yet sent):
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                      {participants.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                          No eligible participants — either all certificates already sent or no shortlisted registrations.
                        </div>
                      ) : participants.map((p, i) => (
                        <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < participants.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#14B8A6', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{p.email}</div>
                          </div>
                          <span style={{ fontSize: 10, color: '#14B8A6', background: 'rgba(20,184,166,0.1)', padding: '2px 7px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>Will receive own cert</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <InfoBox icon="📤" color="#6366F1">
                    Excel file: <strong>{excelFile?.name}</strong> — each of the {participants.length} participant(s) will get their own unique certificate.
                  </InfoBox>
                )}
                <div style={{ marginTop: 20, padding: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.6 }}>
                      I have reviewed all participants above. I confirm that each person will receive <strong>only their own certificate</strong> to their own email. I understand sent certificates cannot be undone.
                    </span>
                  </label>
                </div>
                <Btn onClick={() => setStep(3)} disabled={!confirmed || participants.length === 0}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
                  Refine settings & Confirm Send →
                </Btn>
              </div>
            )}

            {/* STEP 3: Final Send */}
            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Btn variant="ghost" size="sm" onClick={() => setStep(2)} style={{ marginBottom: 20 }}>← Back to Review</Btn>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏅</div>
                <h3 style={{ color: '#F1F5F9', marginBottom: 8 }}>Ready to Send Certificates</h3>
                <p style={{ color: '#94A3B8', fontSize: 13, maxWidth: 400, margin: '0 auto 24px' }}>
                  Each certificate PDF is generated individually with only that participant's name,
                  and sent to their own email address. No other certificate is attached.
                </p>
                <Btn onClick={handleSend} loading={sending} size="lg" style={{ justifyContent: 'center' }}>
                  🚀 Send All Certificates Now
                </Btn>
              </div>
            )}
          </Card>
        )}
      </div>
    </PageWrap>
  );
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//   PAGE 5: COLLEGE OUTREACH
// ═══════════════════════════════════════════════



// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//   PAGE 6: SETTINGS
// ═══════════════════════════════════════════════

export function Settings() {
  const [settings, setSettings] = useState({ fromName: '', fromEmail: '', orgName: '', replyTo: '', geminiApiKey: '', allowedEmails: [] });
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => {
      setSettings({
        ...r.data,
        allowedEmails: Array.isArray(r.data.allowedEmails) ? r.data.allowedEmails : []
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings.fromName || !settings.fromEmail) return toast.error('From Name and From Email are required');
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved!');
    }
    catch (e) { toast.error(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  const handleAddEmail = (e) => {
    if (e) e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return toast.error('Please enter a valid email address');
    }
    if (!email.endsWith('@vvce.ac.in')) {
      return toast.error('Only @vvce.ac.in accounts can be whitelisted');
    }
    if (settings.allowedEmails.includes(email)) {
      return toast.error('Email is already whitelisted');
    }
    setSettings(s => ({
      ...s,
      allowedEmails: [...s.allowedEmails, email]
    }));
    setNewEmail('');
    toast.success('Added to whitelist (Save to apply)');
  };

  const handleRemoveEmail = (emailToRemove) => {
    setSettings(s => ({
      ...s,
      allowedEmails: s.allowedEmails.filter(e => e !== emailToRemove)
    }));
    toast.success('Removed from whitelist (Save to apply)');
  };

  async function handleTest() {
    if (!testEmail) return toast.error('Enter a recipient email');
    setTesting(true);
    try { await api.post('/settings/test-email', { to: testEmail }); toast.success(`Test email sent to ${testEmail}`); }
    catch (e) { toast.error(e.response?.data?.error || 'Test failed'); }
    finally { setTesting(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading settings...</div>;

  return (
    <PageWrap>
      <div style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#F1F5F9' }}>⚙️ Settings</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>Configure sender identity and SMTP credentials</p>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 20 }}>📧 Email Configuration</div>
          <Field label="Sender Name *"><Input value={settings.fromName} onChange={e => setSettings(s => ({ ...s, fromName: e.target.value }))} placeholder="Event Management Team" /></Field>
          <Field label="Sender Email *" hint="This is the 'from' address in all emails">
            <Input type="email" value={settings.fromEmail} onChange={e => setSettings(s => ({ ...s, fromEmail: e.target.value }))} placeholder="events@vvce.ac.in" />
          </Field>
          <Field label="Reply-To Address">
            <Input type="email" value={settings.replyTo} onChange={e => setSettings(s => ({ ...s, replyTo: e.target.value }))} placeholder="support@vvce.ac.in" />
          </Field>
          <Field label="Organisation Name" hint="Used as {{orgName}} in email templates">
            <Input value={settings.orgName} onChange={e => setSettings(s => ({ ...s, orgName: e.target.value }))} placeholder="VVCE Tech Club" />
          </Field>
          <InfoBox icon="ℹ️" color="#6366F1">
            SMTP credentials are configured in the <strong>.env</strong> file:
            &nbsp;<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>
          </InfoBox>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 16 }}>✨ AI Configuration</div>
          <Field label="Gemini API Key" hint="Used for AI email generation in Send Emails module">
            <Input type="password" value={settings.geminiApiKey} onChange={e => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))} placeholder="AIzaSy..." />
          </Field>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔒 Access Control & Whitelist</span>
            </div>
            {settings.allowedEmails && settings.allowedEmails.length > 0 ? (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#10B981',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 8px #10B981'
                }}></span>
                Whitelist Enforced
              </span>
            ) : (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                background: 'rgba(59, 130, 246, 0.08)',
                color: '#3B82F6',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.15)'
              }}>
                Domain Restricted (@vvce.ac.in)
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
            Manage the list of official <code>@vvce.ac.in</code> accounts that are permitted to access this console.
          </div>

          <form onSubmit={handleAddEmail} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input 
              value={newEmail} 
              onChange={e => setNewEmail(e.target.value)} 
              placeholder="Add email (e.g. coordinator@vvce.ac.in)" 
              style={{ flex: 1 }} 
            />
            <Btn type="submit" variant="secondary" size="md">＋ Add</Btn>
          </form>

          <div style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px',
            minHeight: '80px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignContent: 'flex-start'
          }}>
            {settings.allowedEmails && settings.allowedEmails.length > 0 ? (
              settings.allowedEmails.map(email => (
                <div key={email} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#E2E8F0',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12.5px',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                className="whitelist-pill"
                >
                  <span>{email}</span>
                  <span 
                    onClick={() => handleRemoveEmail(email)}
                    style={{
                      cursor: 'pointer',
                      color: '#94A3B8',
                      fontSize: '14px',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(239, 68, 68, 0.15)';
                      e.target.style.color = '#EF4444';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = 'transparent';
                      e.target.style.color = '#94A3B8';
                    }}
                  >
                    ×
                  </span>
                </div>
              ))
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                color: '#64748B',
                fontSize: '12.5px',
                textAlign: 'center',
                padding: '12px 0'
              }}>
                <span style={{ fontSize: '18px', marginBottom: '4px' }}>🔓</span>
                <span>No whitelisted accounts. Any user on the <strong>@vvce.ac.in</strong> domain can log in.</span>
              </div>
            )}
          </div>
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 12 }}>🧪 Test SMTP Connection</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Send test email to..." style={{ flex: 1 }} />
            <Btn variant="secondary" onClick={handleTest} loading={testing}>Send Test</Btn>
          </div>
        </Card>

        <Btn onClick={handleSave} loading={saving} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
          💾 Save Settings
        </Btn>
      </div>
    </PageWrap>
  );
}
