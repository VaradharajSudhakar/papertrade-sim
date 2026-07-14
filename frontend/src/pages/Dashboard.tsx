import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getPortfolio, getEquityCurve, resetPortfolio } from "../api/client";
import type { PortfolioSummary, EquityPoint } from "../api/client";

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getPortfolio(), getEquityCurve()])
      .then(([p, e]) => {
        setPortfolio(p);
        setEquity(e);
        setError(null);
      })
      .catch((err) => setError(err?.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleReset = async () => {
    if (!confirm("Reset simulated portfolio to starting cash? This clears all holdings and history.")) return;
    await resetPortfolio();
    load();
  };

  if (loading) return <p>Loading portfolio...</p>;
  if (error) return <p className="error">Error: {error}</p>;
  if (!portfolio) return null;

  const chartData = equity.map((e) => ({
    date: new Date(e.timestamp).toLocaleDateString(),
    value: e.total_value,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="secondary" onClick={handleReset}>Reset Simulation</button>
      </div>

      <div className="summary-cards">
        <div className="card">
          <div className="card-label">Total Portfolio Value</div>
          <div className="card-value">{fmtUsd(portfolio.total_value)}</div>
        </div>
        <div className="card">
          <div className="card-label">Cash Balance</div>
          <div className="card-value">{fmtUsd(portfolio.cash)}</div>
        </div>
        <div className="card">
          <div className="card-label">Holdings Value</div>
          <div className="card-value">{fmtUsd(portfolio.holdings_value)}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Gain/Loss</div>
          <div className={`card-value ${portfolio.total_gain_loss >= 0 ? "positive" : "negative"}`}>
            {fmtUsd(portfolio.total_gain_loss)}
          </div>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="chart-panel">
          <h2>Equity Curve</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
              <XAxis dataKey="date" stroke="#8b94a8" fontSize={12} />
              <YAxis stroke="#8b94a8" fontSize={12} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => fmtUsd(Number(v))} />
              <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2>Holdings</h2>
      {portfolio.holdings.length === 0 ? (
        <p className="muted">No positions yet. Head to the Trade page to buy your first stock.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Avg Cost</th>
              <th>Current Price</th>
              <th>Market Value</th>
              <th>Gain/Loss</th>
              <th>Gain/Loss %</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.holdings.map((h) => (
              <tr key={h.symbol}>
                <td className="symbol">{h.symbol}</td>
                <td>{h.quantity}</td>
                <td>{fmtUsd(h.avg_cost)}</td>
                <td>{fmtUsd(h.current_price)}</td>
                <td>{fmtUsd(h.market_value)}</td>
                <td className={h.gain_loss >= 0 ? "positive" : "negative"}>{fmtUsd(h.gain_loss)}</td>
                <td className={h.gain_loss_pct >= 0 ? "positive" : "negative"}>{h.gain_loss_pct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
