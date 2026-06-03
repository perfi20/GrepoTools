'use client';
import { useState, useEffect } from 'react';

export default function ReportsPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/scraper/grct');
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scraper/grct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse report');
      
      setUrl('');
      fetchReports();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4" style={{ marginTop: '2rem' }}>
      <div className="glass-panel">
        <h2>Parse GRCT Report</h2>
        <form onSubmit={handleScrape} className="flex gap-4 items-center mt-4">
          <input 
            type="text" 
            placeholder="Paste GRCT Report URL (e.g. https://www.grcrt.net/repview.php?rep=...)" 
            className="input-field"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
            {loading ? 'Parsing...' : 'Parse Report'}
          </button>
        </form>
        {error && <p className="text-danger mt-4">{error}</p>}
      </div>

      <div className="glass-panel mt-4">
        <h2>Report Archive</h2>
        {reports.length === 0 ? (
          <p className="text-secondary mt-4">No reports parsed yet.</p>
        ) : (
          <div className="grid mt-4 gap-4">
            {reports.map(report => (
              <div key={report.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.4)' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <strong className="gradient-text">{report.attacker}</strong> vs <strong>{report.defender}</strong>
                  </div>
                  <div className="text-secondary text-sm">
                    {new Date(report.date).toLocaleString()}
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-sm">
                  <span style={{ color: '#d97706' }}>Wood: {report.lootedWood}</span>
                  <span style={{ color: '#9ca3af' }}>Stone: {report.lootedStone}</span>
                  <span style={{ color: '#94a3b8' }}>Iron: {report.lootedIron}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
