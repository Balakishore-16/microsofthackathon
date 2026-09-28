import React, { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [memories, setMemories] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };
  
  // Form states
  const [errorMsg, setErrorMsg] = useState('');
  const [service, setService] = useState('payment-gateway');
  const [environment, setEnvironment] = useState('Production');
  const [logs, setLogs] = useState('');
  
  const [rootCause, setRootCause] = useState('HikariCP connection pool exhausted due to unclosed connections in the payment processing module.');
  const [solution, setSolution] = useState('Increased maxLifetime to 1800000 and added finally blocks to close connections. Restarted pods.');
  const [outcome, setOutcome] = useState('Incident resolved. Zero payment drops in last 12 hours.');

  const API_URL = 'http://localhost:3001/api';

  useEffect(() => {
    fetchIncidents();
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      const res = await fetch(`${API_URL}/memories`);
      const data = await res.json();
      setMemories(data);
    } catch (err) {
      console.error("Failed to fetch memories", err);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_URL}/incidents`);
      const data = await res.json();
      setIncidents(data);
    } catch (err) {
      console.error("Failed to fetch incidents", err);
    }
  };

  const createIncident = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: errorMsg, service, environment, impact: 'Critical - Revenue Impacting', logs })
      });
      if (!res.ok) throw new Error(`Incident API returned ${res.status}`);

      const newInc = await res.json();
      setIncidents(currentIncidents => [newInc, ...currentIncidents]);
      setSelectedIncident(newInc);
      setAnalysis(null);
    } catch (err) {
      console.error('Failed to create incident:', err);
      showToast('Incident could not be saved. Check that the backend is running on port 3001.');
    }
  };

  const analyzeIncident = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: selectedIncident.id })
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error("Analysis failed", err);
    }
    setLoading(false);
  };

  const resolveIncident = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: selectedIncident.id, rootCause, solution, outcome })
    });
    fetchIncidents();
    fetchMemories();
    setSelectedIncident(null);
    setAnalysis(null);
    showToast('✅ Incident Resolved & Memory Indexed');
  };

  return (
    <>
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      
      <div className="dashboard-layout">
        
        {/* Sidebar Navigation */}
        <aside className="sidebar glass-panel">
          <div className="logo" style={{ marginBottom: '2rem', justifyContent: 'center' }}>
            <span className="logo-icon">🧠</span>
            <div style={{ fontSize: '1.5rem' }}>
              IncidentIQ
              <div className="subtitle" style={{ fontSize: '0.6rem' }}>AI Ops Platform</div>
            </div>
          </div>
          
          <nav className="nav-menu">
            <a href="#" className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>
              <span className="icon">📊</span> Dashboard Overview
            </a>
            <a href="#" className={`nav-item ${activeTab === 'active_incidents' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('active_incidents'); }}>
              <span className="icon">🚨</span> Active Incidents
            </a>
            <a href="#" className={`nav-item ${activeTab === 'memory' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('memory'); }}>
              <span className="icon">💾</span> Hindsight Memory
            </a>
            <a href="#" className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('analytics'); }}>
              <span className="icon">📈</span> Analytics
            </a>
            <a href="#" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('settings'); }}>
              <span className="icon">⚙️</span> System Settings
            </a>
          </nav>

          <div className="agent-status">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>AI Agent Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pulse-dot"></span>
              <span style={{ color: '#10b981', fontWeight: '600' }}>Online & Monitoring</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          
          {/* Top Navigation Bar */}
          <header className="topbar glass-panel">
            <div className="search-bar">
              <span style={{ opacity: 0.5 }}>🔍</span>
              <input type="text" placeholder="Search incidents, memories, or logs (e.g. 'HikariPool')..." 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') showToast('Global Search is indexing new telemetry...');
                }} 
              />
            </div>
            <div className="topbar-actions">
              <button className="icon-btn" onClick={() => showToast('3 New AI Insights Available')}>
                🔔<span className="notification-badge">3</span>
              </button>
              <div className="user-profile" onClick={() => showToast('Logged in as Enterprise Admin')}>
                <img src="https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff" alt="User" className="avatar" />
                <span>Admin</span>
              </div>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <>
              {/* Metrics Overview (Only on Dashboard) */}
              <div className="metrics-grid">
                <div className="metric-card glass-panel">
                  <div className="metric-title">System Health</div>
                  <div className="metric-value" style={{ color: '#10b981' }}>99.98%</div>
                  <div className="metric-trend">↑ 0.02% from last week</div>
                </div>
                <div className="metric-card glass-panel">
                  <div className="metric-title">Hindsight Memories</div>
                  <div className="metric-value" style={{ color: '#a5b4fc' }}>{memories.length}</div>
                  <div className="metric-trend">Stored in Vector DB</div>
                </div>
                <div className="metric-card glass-panel">
                  <div className="metric-title">Mean Time To Resolution</div>
                  <div className="metric-value" style={{ color: '#34d399' }}>12m</div>
                  <div className="metric-trend" style={{ color: '#34d399' }}>↓ 85% faster with AI</div>
                </div>
                <div className="metric-card glass-panel">
                  <div className="metric-title">Active AI Interventions</div>
                  <div className="metric-value" style={{ color: '#ec4899' }}>{incidents.filter(i => i.status !== 'Resolved').length}</div>
                  <div className="metric-trend">Monitoring Open Incidents</div>
                </div>
              </div>

              <div className="glass-panel main-panel" style={{ marginTop: '2rem', display: 'flex', gap: '2rem', minHeight: '400px' }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '2rem' }}>
                  <h3 style={{ color: '#34d399', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="pulse-dot"></span> Live Global Telemetry
                  </h3>
                  <div className="shimmer" style={{ height: '250px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.8 }}>🌍</div>
                    <div style={{ fontWeight: '600' }}>System operating at peak efficiency.</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>Awaiting new incident reports...</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '2rem', overflowY: 'auto', maxHeight: '350px' }}>
                  <h3 style={{ color: '#a5b4fc', marginBottom: '1.5rem' }}>🧠 AI Agent Activity Log</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {memories.length === 0 && incidents.length === 0 && (
                      <div style={{ color: 'var(--text-muted)' }}>Waiting for telemetry to stream...</div>
                    )}
                    
                    {memories.map((mem, i) => (
                      <div key={`mem-${i}`} style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderLeft: '3px solid #10b981', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(mem.timestamp).toLocaleTimeString()}</span>
                        <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Indexed permanent Hindsight Memory for <strong style={{color: '#6ee7b7'}}>Resolution #{mem.id}</strong>.</div>
                      </div>
                    ))}

                    {incidents.map((inc, i) => (
                      <div key={`inc-${i}`} style={{ padding: '1rem', background: 'rgba(79, 70, 229, 0.1)', borderLeft: '3px solid #4f46e5', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(inc.createdAt).toLocaleTimeString()}</span>
                        <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Ingested telemetry and analyzed stack trace for <strong style={{color: '#a5b4fc'}}>{inc.service}</strong> outage.</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'active_incidents' && (
            <div className="main-grid">
                {/* Left Column: Create & List */}
                <div className="glass-panel main-panel">
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                    <h2 className="panel-title" style={{margin: 0, border: 'none'}}>Report New Incident</h2>
                  </div>
                  
                  <div className="demo-controls" style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px'}}>
                <button className="btn secondary" style={{fontSize: '0.85rem', padding: '0.5rem'}} onClick={() => {
                  setErrorMsg('java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available');
                  setService('payment-gateway');
                  setLogs('at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:199)\n... 42 more\nCaused by: java.sql.SQLTimeoutException: Timeout after 30000ms of waiting for a connection.');
                }}>1️⃣ Scenario: First Outage</button>
                <button className="btn secondary" style={{fontSize: '0.85rem', padding: '0.5rem', border: '1px solid rgba(99, 102, 241, 0.5)'}} onClick={() => {
                  setErrorMsg('java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available');
                  setService('billing-service');
                  setLogs('at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:199)\n... 42 more\nCaused by: java.sql.SQLTimeoutException: Timeout after 30000ms of waiting for a connection.');
                }}>2️⃣ Scenario: Similar Outage (Memory Kicks In)</button>
              </div>

              <form onSubmit={createIncident}>
                <div className="form-group">
                  <label>Error Message / Exception</label>
                  <input type="text" value={errorMsg} onChange={e => setErrorMsg(e.target.value)} placeholder="e.g. 502 Bad Gateway" required />
                </div>
                <div className="form-group">
                  <label>Service Name</label>
                  <select value={service} onChange={e => setService(e.target.value)}>
                    <option value="payment-gateway">payment-gateway</option>
                    <option value="billing-service">billing-service</option>
                    <option value="user-auth-service">user-auth-service</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Stack Trace / Logs</label>
                  <textarea value={logs} onChange={e => setLogs(e.target.value)} rows="3" placeholder="Paste relevant logs here..."></textarea>
                </div>
                <button type="submit" className="btn">Create Incident</button>
              </form>

              <h2 className="panel-title" style={{ marginTop: '2.5rem' }}>Recent Incidents</h2>
              <div className="incident-list">
                {incidents.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No incidents reported.</p>
                ) : (
                  incidents.map(inc => (
                    <div 
                      key={inc.id} 
                      className="incident-card"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setAnalysis(null);
                      }}
                      style={{ borderColor: selectedIncident?.id === inc.id ? 'var(--primary)' : '' }}
                    >
                      <div className="incident-header">
                        <strong>{inc.id} - {inc.service}</strong>
                        <span className={`badge ${inc.status.toLowerCase()}`}>{inc.status}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inc.error}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Investigation & Resolution */}
            <div className="glass-panel main-panel">
              {selectedIncident ? (
                <>
                  <h2 className="panel-title">
                    Investigating {selectedIncident.id}
                    <span className={`badge ${selectedIncident.status.toLowerCase()}`} style={{marginLeft: 'auto'}}>{selectedIncident.status}</span>
                  </h2>
                  
                  <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                    <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'monospace', color: '#fca5a5' }}>{selectedIncident.error}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Service: <strong>{selectedIncident.service}</strong> | Env: {selectedIncident.environment}</div>
                    {selectedIncident.logs && (
                      <pre style={{marginTop: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'pre-wrap'}}>{selectedIncident.logs}</pre>
                    )}
                  </div>

                  {selectedIncident.status === 'Open' && !analysis && !loading && (
                    <button className="btn pulse-glow" onClick={analyzeIncident}>
                      <span style={{marginRight: '8px'}}>✨</span> Analyze with AI & Hindsight
                    </button>
                  )}

                  {loading && (
                    <div className="shimmer" style={{ height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginTop: '1.5rem' }}></div>
                  )}

                  {analysis && (
                    <div className="analysis-section">
                      {analysis.memoryFound && (
                        <div className="memory-alert shimmer">
                          <div className="memory-header">
                            🧠 HINDSIGHT MEMORY FOUND
                            <span className="similarity">Similarity: {analysis.memory.similarity}</span>
                          </div>
                          <div className="memory-details">
                            <div><div className="label">Previous Incident</div><div className="value">{analysis.memory.previousIncident}</div></div>
                            <div><div className="label">Root Cause</div><div className="value">{analysis.memory.rootCause}</div></div>
                            <div><div className="label">Resolution</div><div className="value">{analysis.memory.previousResolution}</div></div>
                            <div><div className="label">Outcome</div><div className="value">{analysis.memory.outcome}</div></div>
                          </div>
                        </div>
                      )}

                      <div className="ai-recommendation">
                        <h4>✨ AI Recommendation</h4>
                        <p style={{ lineHeight: '1.6', fontSize: '0.95rem' }}>{analysis.aiRecommendation}</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                          <span className="metric-pill">Likely Cause: <strong>{analysis.likelyCause}</strong></span>
                          <span className="metric-pill">Severity: <strong style={{color: '#fca5a5'}}>{analysis.severity}</strong></span>
                        </div>
                      </div>

                      {selectedIncident.status === 'Open' && (
                        <form className="resolve-form" onSubmit={resolveIncident}>
                          <h3 style={{marginBottom: '1.5rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                            <span>💾</span> Store Knowledge in Hindsight
                          </h3>
                          <div className="form-group">
                            <label>Root Cause</label>
                            <input type="text" value={rootCause} onChange={e => setRootCause(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label>Solution Applied</label>
                            <input type="text" value={solution} onChange={e => setSolution(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label>Outcome</label>
                            <input type="text" value={outcome} onChange={e => setOutcome(e.target.value)} required />
                          </div>
                          <button type="submit" className="btn success">
                            Resolve Incident & Teach Agent
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {selectedIncident.status === 'Resolved' && (
                    <div className="memory-alert" style={{marginTop: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.4)', animation: 'none'}}>
                      <div className="memory-header" style={{color: '#6ee7b7'}}>✅ Saved to Hindsight Memory Layer</div>
                      <div className="memory-details">
                        <div><div className="label">Root Cause</div><div className="value">{selectedIncident.rootCause}</div></div>
                        <div><div className="label">Resolution</div><div className="value">{selectedIncident.solution}</div></div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  <div className="floating-icon" style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>📡</div>
                  <h3 style={{ fontSize: '1.5rem', color: '#f8fafc', marginBottom: '0.5rem' }}>Awaiting Target Incident</h3>
                  <p style={{ maxWidth: '350px', margin: '0 auto', lineHeight: '1.6' }}>Select an incident from the telemetry feed to investigate and resolve using Hindsight Memory AI.</p>
                </div>
              )}
            </div>
          </div>
      )}

          {activeTab === 'memory' && (
            <div className="glass-panel main-panel tab-panel memory-panel">
              <h2 className="panel-title" style={{color: '#a5b4fc'}}>🧠 Vectorize Hindsight Memory Database</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>This is the persistent knowledge base. The AI agent queries these historical records when analyzing new incidents to recall past resolutions and reduce MTTR. Newly created incidents appear here immediately and are permanently indexed once resolved.</p>
              
              <div className="incident-list" style={{ maxHeight: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {incidents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '1rem' }}>📭</div>
                    No telemetry indexed yet. Create an incident to see it appear here!
                  </div>
                ) : (
                  incidents.map(inc => {
                    const isResolved = inc.status === 'Resolved';
                    const mem = memories.find(m => m.id === inc.id);
                    
                    return (
                      <div key={inc.id} className="incident-card" style={{ cursor: 'default', background: isResolved ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.05), rgba(0,0,0,0.3))' : 'linear-gradient(145deg, rgba(245, 158, 11, 0.05), rgba(0,0,0,0.3))', border: isResolved ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div className="incident-header">
                          <strong style={{ color: isResolved ? '#34d399' : '#fbbf24' }}>
                            {isResolved ? `🧠 Memory ID: ${inc.id}` : `⏳ Pending Indexing: ${inc.id}`}
                          </strong>
                          <span className={`badge ${isResolved ? 'resolved' : 'open'}`} style={{ background: isResolved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isResolved ? '#10b981' : '#fbbf24' }}>
                            Created: {new Date(inc.createdAt).toLocaleString()}
                          </span>
                        </div>
                        
                        <div style={{ margin: '1rem 0' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Original Error</div>
                          <div style={{ fontFamily: 'monospace', color: '#fca5a5' }}>{inc.error}</div>
                        </div>

                        {isResolved && mem && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                            <div>
                              <div style={{ color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Root Cause</div>
                              <div style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{mem.rootCause}</div>
                            </div>
                            <div>
                              <div style={{ color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Resolution</div>
                              <div style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{mem.solution}</div>
                            </div>
                          </div>
                        )}
                        
                        {!isResolved && (
                          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Awaiting resolution. The AI will learn the root cause and solution once this incident is closed.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="glass-panel main-panel tab-panel analytics-panel">
              <h2 className="panel-title">📈 System Analytics & AI Impact</h2>
              
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Resolution Time Trend (MTTR)</h3>
                  <div className="mttr-chart">
                    {/* Mock Bar Chart */}
                    <div className="mttr-bar mttr-bar-high" style={{ height: '100%' }}><span>120m</span></div>
                    <div className="mttr-bar mttr-bar-medium" style={{ height: '70%' }}><span>85m</span></div>
                    <div className="mttr-bar mttr-bar-low" style={{ height: '40%' }}><span>45m</span></div>
                    <div className="mttr-bar mttr-bar-current" style={{ height: '15%' }}><span>12m</span></div>
                  </div>
                  <div className="mttr-months">
                    <span>Jan</span><span>Feb</span><span>Mar</span><span className="ai-enabled-month">Apr (AI Enabled)</span>
                  </div>
                </div>

                <div className="analytics-card memory-usage-card">
                  <h3>Hindsight Memory Usage</h3>
                  <p>AI successfully retrieved memory on:</p>
                  <div className="memory-usage-value">84.2%</div>
                  <p className="memory-usage-caption">Of all reported incidents this month.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="glass-panel main-panel tab-panel settings-panel">
              <h2 className="panel-title">⚙️ System Settings</h2>
              
              <div className="settings-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>AI Agent Configuration</h3>
                
                <div className="form-group">
                  <label>Active LLM Model</label>
                  <select disabled style={{ opacity: 0.8 }}>
                    <option>meta/llama-3.2-11b-vision-instruct</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Hindsight Memory Engine</label>
                  <select disabled style={{ opacity: 0.8 }}>
                    <option>Vectorize SQL Local Node (v1.4)</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.3)', marginTop: '2rem' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#a5b4fc', marginBottom: '0.2rem' }}>NVIDIA API Rate Limiting</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Protects your API key from overuse.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="number" value="35" disabled style={{ width: '80px', padding: '0.5rem', textAlign: 'center' }} />
                    <span style={{ color: 'var(--text-muted)' }}>req/min</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Toast Notification System */}
      {toast && (
        <div className="toast-notification">
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}

export default App;
