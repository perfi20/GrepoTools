import './globals.css';

export const metadata = {
  title: 'Grepolis Toolkit',
  description: 'Premium personal tools for Grepolis players',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="container flex justify-between items-center" style={{ padding: 0 }}>
            <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.5rem' }}>GrepoTools</h1>
            <div className="nav-links">
              <a href="/" className="nav-link">Dashboard</a>
              <a href="/reports" className="nav-link">Reports</a>
              <a href="/planner" className="nav-link">Planner</a>
              <a href="/snipe" className="nav-link">Snipe Timer</a>
            </div>
          </div>
        </nav>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
