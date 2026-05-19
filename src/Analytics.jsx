import { useEffect, useState } from 'react';
import api from './api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

export default function Analytics() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [stats, setStats] = useState(null);
  const [eventStats, setEventStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async (evId = '') => {
    setLoading(true);
    try {
      const url = evId ? `/analytics/dashboard?eventId=${evId}` : '/analytics/dashboard';
      const [{data: dash}, {data: evs}] = await Promise.all([api.get(url), api.get('/events')]);
      setStats(dash); setEvents(evs);
      if (evId) {
        const {data: evSt} = await api.get(`/analytics/event/${evId}`);
        setEventStats(evSt);
      } else { setEventStats(null); }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(selectedEvent); }, [selectedEvent]);

  const emailTypeData = stats?.emails?.byType?.map(t => ({ name: t._id, value: t.sent, total: t.count })) || [];
  const perDayData = stats?.emails?.perDay?.map(d => ({ date: d._id.slice(5), emails: d.count })) || [];

  const regBarData = eventStats ? [
    { name: 'Registered', value: eventStats.stats.total },
    { name: 'Shortlisted', value: eventStats.stats.shortlisted },
    { name: 'Rejected', value: eventStats.stats.rejected },
    { name: 'Cert Sent', value: eventStats.stats.certificateSent },
    { name: 'Reminder', value: eventStats.stats.reminderSent },
  ] : [];

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <div className="spinner" style={{ width:32, height:32, borderTopColor:'var(--primary)' }} />
      <span style={{ color:'var(--text-secondary)' }}>Loading analytics...</span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>📈 Analytics</h1>
        <p>Detailed insights into your email campaigns and events</p>
      </div>

      {/* Event Filter */}
      <div style={{ marginBottom:24, maxWidth:320 }}>
        <label className="form-label">Filter by Event</label>
        <select className="form-control" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
          <option value="">All Events</option>
          {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      {/* KPI Grid */}
      <div className="stat-grid" style={{ marginBottom:24 }}>
        {[
          { label:'Total Emails Sent', val: stats?.emails?.sent ?? 0, icon:'📧', cls:'blue' },
          { label:'Open Rate', val: `${stats?.emails?.openRate ?? 0}%`, icon:'👁️', cls:'cyan' },
          { label:'Emails Failed', val: stats?.emails?.failed ?? 0, icon:'❌', cls:'red' },
          { label:'Total Registered', val: stats?.registrations?.total ?? 0, icon:'📝', cls:'purple' },
          { label:'Shortlisted', val: stats?.registrations?.shortlisted ?? 0, icon:'⭐', cls:'yellow' },
          { label:'Certificates Sent', val: stats?.registrations?.certEmailSent ?? 0, icon:'🎓', cls:'green' },
          { label:'Reminders Sent', val: stats?.registrations?.reminderSuccess ?? 0, icon:'⏰', cls:'blue' },
          { label:'Promotion Emails', val: stats?.promotion?.sent ?? 0, icon:'📣', cls:'purple' },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.cls}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom:24 }}>
        {/* Emails Over Time */}
        <div className="card">
          <div className="section-title">📅 Email Volume (Last 14 Days)</div>
          {perDayData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer>
                <AreaChart data={perDayData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'#151828',border:'1px solid #252a40',borderRadius:8,color:'#f1f5f9'}}/>
                  <Area type="monotone" dataKey="emails" stroke="#6366f1" strokeWidth={2.5} fill="url(#g1)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No data yet</p></div>
          )}
        </div>

        {/* Email Types */}
        <div className="card">
          <div className="section-title">🥧 Email Distribution by Type</div>
          {emailTypeData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={emailTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {emailTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Legend iconType="circle" iconSize={9} formatter={v => <span style={{color:'#94a3b8',fontSize:11}}>{v}</span>}/>
                  <Tooltip contentStyle={{background:'#151828',border:'1px solid #252a40',borderRadius:8,color:'#f1f5f9'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">🥧</div><p>No data yet</p></div>
          )}
        </div>
      </div>

      {/* Per-Event Stats */}
      {eventStats && (
        <div className="card" style={{ marginBottom:24 }}>
          <div className="section-title">🎯 Event: {eventStats.event?.name}</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={regBarData} barCategoryGap="40%">
                <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:12}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:'#151828',border:'1px solid #252a40',borderRadius:8,color:'#f1f5f9'}}/>
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {regBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Email status breakdown */}
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:20 }}>
            {[
              { label:'Confirmation Sent', val: eventStats.stats.confirmationSent, icon:'✅' },
              { label:'Shortlist Email', val: eventStats.stats.shortlistEmailSent, icon:'🌟' },
              { label:'Rejection Email', val: eventStats.stats.rejectionEmailSent, icon:'🚫' },
              { label:'Reminder Sent', val: eventStats.stats.reminderSent, icon:'⏰' },
              { label:'Certificate Sent', val: eventStats.stats.certificateSent, icon:'🎓' },
              { label:'Cert Downloaded', val: eventStats.stats.certificateDownloaded, icon:'📥' },
            ].map((s, i) => (
              <div key={i} style={{ flex:'1', minWidth:130, background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:20 }}>{s.icon}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', marginTop:6 }}>{s.val}</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Promotion stats */}
          <div style={{ marginTop:16, display:'flex', gap:12 }}>
            <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:10, padding:'14px 20px' }}>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Promotion Emails Sent</div>
              <div style={{ fontSize:24, fontWeight:800, color:'var(--primary)' }}>{eventStats.promotionStats?.sent ?? 0}</div>
            </div>
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'14px 20px' }}>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Promotion Failed</div>
              <div style={{ fontSize:24, fontWeight:800, color:'var(--danger)' }}>{eventStats.promotionStats?.failed ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Events Table */}
      {stats?.events?.length > 0 && (
        <div className="card">
          <div className="section-title">📅 Recent Events</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Event</th><th>Date</th><th>Status</th><th>Venue</th></tr>
              </thead>
              <tbody>
                {stats.events.map(ev => (
                  <tr key={ev._id}>
                    <td><strong>{ev.name}</strong></td>
                    <td>{new Date(ev.date).toLocaleDateString('en-IN')}</td>
                    <td><span className={`badge badge-${ev.status}`}>{ev.status}</span></td>
                    <td>{ev.venue || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
