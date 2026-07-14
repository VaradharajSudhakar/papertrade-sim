import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">PaperTrade Sim</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
          <NavLink to="/trade">Trade</NavLink>
          <NavLink to="/analytics">Risk Analytics</NavLink>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
