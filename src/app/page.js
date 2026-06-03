export default function Home() {
  return (
    <div>
      <div className="mb-4 text-center">
        <h1 className="gradient-text" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Grepolis Arsenal</h1>
        <p className="text-secondary">Your personal toolkit for dominating the Aegean Sea.</p>
      </div>

      <div className="grid grid-cols-3 mt-4">
        <a href="/reports" className="glass-panel text-center">
          <h3>Combat Reports</h3>
          <p className="text-secondary text-sm">Analyze GRCT reports, track your losses and loot efficiency over time.</p>
          <div className="mt-4 btn btn-primary" style={{ width: '100%' }}>View Reports</div>
        </a>

        <a href="/planner" className="glass-panel text-center">
          <h3>City & Army Planner</h3>
          <p className="text-secondary text-sm">Optimize your nukes and defensive walls based on real unit stats.</p>
          <div className="mt-4 btn btn-primary" style={{ width: '100%' }}>Plan Cities</div>
        </a>

        <a href="/snipe" className="glass-panel text-center">
          <h3>Snipe & Dodge Timer</h3>
          <p className="text-secondary text-sm">Tactical calculator to nail your timings down to the second.</p>
          <div className="mt-4 btn btn-primary" style={{ width: '100%' }}>Calculate Times</div>
        </a>
      </div>
    </div>
  );
}
