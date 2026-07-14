import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getAnalytics } from "../api/client";
import type { AnalyticsSummary } from "../api/client";

const COLORS = ["#60a5fa", "#4ade80", "#facc15", "#f87171", "#c084fc", "#22d3ee", "#fb923c", "#a3e635"];

export default function Analytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading analytics...</p>;
  if (error) return <p className="error">Error: {error}</p>;
  if (!data) return null;

  return (
    <div>
      <h1>Risk & Performance Analytics</h1>

      <div className="summary-cards">
        <div className="card">
          <div className="card-label">Portfolio Beta</div>
          <div className="card-value">{data.portfolio_beta !== null ? data.portfolio_beta.toFixed(2) : "—"}</div>
          <div className="card-sub muted">vs. market (1.0 = market risk)</div>
        </div>
        <div className="card">
          <div className="card-label">Annualized Volatility</div>
          <div className="card-value">
            {data.annualized_volatility_pct !== null ? `${data.annualized_volatility_pct.toFixed(1)}%` : "—"}
          </div>
          <div className="card-sub muted">based on 90-day daily returns</div>
        </div>
        <div className="card">
          <div className="card-label">Cash Allocation</div>
          <div className="card-value">{data.cash_pct.toFixed(1)}%</div>
        </div>
        <div className="card">
          <div className="card-label">Largest Position</div>
          <div className="card-value">{data.largest_position_pct.toFixed(1)}%</div>
          <div className="card-sub muted">{data.num_positions} position(s) held</div>
        </div>
      </div>

      {data.sector_allocation.length > 0 && (
        <div className="chart-panel">
          <h2>Sector Allocation</h2>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.sector_allocation}
                dataKey="value"
                nameKey="sector"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={(entry: any) => `${entry.sector} (${entry.pct.toFixed(1)}%)`}
              >
                {data.sector_allocation.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" })} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.holdings_gain_loss.length > 0 && (
        <>
          <h2>Position Performance</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Gain/Loss</th>
                <th>Gain/Loss %</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings_gain_loss.map((h) => (
                <tr key={h.symbol}>
                  <td className="symbol">{h.symbol}</td>
                  <td className={h.gain_loss >= 0 ? "positive" : "negative"}>
                    {h.gain_loss.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </td>
                  <td className={h.gain_loss_pct >= 0 ? "positive" : "negative"}>{h.gain_loss_pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {data.num_positions === 0 && <p className="muted">Add positions from the Trade page to see risk analytics.</p>}
    </div>
  );
}
