import { useEffect, useState } from 'react';
import api from './api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState('');

  const fetchStats = async () => {
    try {
      const url = selectedEvent ? `/analytics/dashboard?eventId=${selectedEvent}` : '/analytics/dashboard';
      const { data } = await api.get(url);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [selectedEvent]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <div className="spinner" style={{ width:32, height:32, borderTopColor:'var(--primary)' }} />
      <span style={{ color:'var(--text-secondary)' }}>Loading dashboard...</span>
    </div>
  );

  const emailTypeData = stats?.emails?.byType?.map(t => ({ name: t._id, value: t.sent })) || [];
  const perDayData = stats?.emails?.perDay?.map(d => ({ date: d._id.slice(5), emails: d.count })) || [];

  return (
    <div>
      <div className="page-header">
        <h1>📊 Dashboard</h1>
        <p>Overview of all email campaigns and event activities</p>
      </div>

      {/* Event filter */}
      {stats?.events?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <select className="form-control" style={{ maxWidth: 280 }}
            value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
            <option value="">All Events</option>
            {stats.events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-icon">📧</div>
          <div className="stat-value">{stats?.emails?.sent ?? 0}</div>
          <div className="stat-label">Emails Sent</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-icon">👁️</div>
          <div className="stat-value">{stats?.emails?.openRate ?? 0}%</div>
          <div className="stat-label">Open Rate</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{stats?.registrations?.shortlisted ?? 0}</div>
          <div className="stat-label">Shortlisted</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">🎓</div>
          <div className="stat-value">{stats?.registrations?.certEmailSent ?? 0}</div>
          <div className="stat-label">Certificates Sent</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">⏰</div>
          <div className="stat-value">{stats?.registrations?.reminderSuccess ?? 0}</div>
          <div className="stat-label">Reminders Sent</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon">❌</div>
          <div className="stat-value">{stats?.emails?.failed ?? 0}</div>
          <div className="stat-label">Failed Emails</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Emails Per Day Chart */}
        <div className="card">
          <div className="section-title">📈 Emails Sent (Last 14 Days)</div>
          {perDayData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perDayData}>
                  <defs>
                    <linearGradient id="emailGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background:'#151828', border:'1px solid #252a40', borderRadius:8, color:'#f1f5f9' }} />
                  <Area type="monotone" dataKey="emails" stroke="#6366f1" strokeWidth={2} fill="url(#emailGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No email data yet</p></div>
          )}
        </div>

        {/* Email Types Pie */}
        <div className="card">
          <div className="section-title">🥧 Emails by Type</div>
          {emailTypeData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={emailTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4}>
                    {emailTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={10} formatter={v => <span style={{color:'#94a3b8',fontSize:12}}>{v}</span>} />
                  <Tooltip contentStyle={{ background:'#151828', border:'1px solid #252a40', borderRadius:8, color:'#f1f5f9' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">🥧</div><p>No type data yet</p></div>
          )}
        </div>
      </div>

      {/* Registration summary */}
      <div className="card">
        <div className="section-title">📝 Registration Summary</div>
        <div className="stat-grid" style={{ margin: 0 }}>
          {[
            { label: 'Total Registered', val: stats?.registrations?.total ?? 0, icon: '📝' },
            { label: 'Shortlisted', val: stats?.registrations?.shortlisted ?? 0, icon: '🌟' },
            { label: 'Rejected', val: stats?.registrations?.rejected ?? 0, icon: '🚫' },
            { label: 'Confirmation Sent', val: stats?.registrations?.confirmationSent ?? '-', icon: '✅' },
            { label: 'Certificates', val: stats?.registrations?.certEmailSent ?? 0, icon: '🎓' },
          ].map((s, i) => (
            <div key={i} style={{ background:'var(--bg-card2)', borderRadius:10, padding:'16px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontSize:24, fontWeight:800 }}>{s.val}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
