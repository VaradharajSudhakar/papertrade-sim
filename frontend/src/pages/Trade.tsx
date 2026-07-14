import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getQuote, getChart, getIndicator, placeTrade, searchSymbols } from "../api/client";
import type { Quote } from "../api/client";

type IndicatorType = "sma" | "ema" | "rsi";

export default function Trade() {
  const [params, setParams] = useSearchParams();
  const symbol = (params.get("symbol") || "").toUpperCase();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string; exchange: string }[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [chartData, setChartData] = useState<{ date: string; close: number; indicator?: number }[]>([]);
  const [indicatorType, setIndicatorType] = useState<IndicatorType>("sma");
  const [period, setPeriod] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      searchSymbols(query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    Promise.all([getQuote(symbol), getChart(symbol, 180), getIndicator(symbol, indicatorType, period)])
      .then(([q, chart, indicator]) => {
        setQuote(q);
        const indicatorMap = new Map(indicator.map((d) => [d.date, d[indicatorType]]));
        setChartData(
          chart.historical.map((h) => ({
            date: h.date,
            close: h.close,
            indicator: indicatorMap.get(h.date) as number | undefined,
          }))
        );
      })
      .catch((err) => setError(err?.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, [symbol, indicatorType, period]);

  const selectSymbol = (s: string) => {
    setParams({ symbol: s });
    setQuery("");
    setResults([]);
    setStatus(null);
  };

  const handleTrade = async (side: "BUY" | "SELL") => {
    if (!symbol || quantity <= 0) return;
    setStatus(null);
    setError(null);
    try {
      const res = await placeTrade(symbol, side, quantity);
      setStatus(`${side} ${res.quantity} ${res.symbol} @ $${res.price.toFixed(2)} executed.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message);
    }
  };

  return (
    <div>
      <h1>Trade</h1>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search NYSE symbols to trade..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r) => (
              <li key={r.symbol} onClick={() => selectSymbol(r.symbol)}>
                <strong>{r.symbol}</strong> — {r.name} <span className="muted">({r.exchange})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!symbol && <p className="muted">Search for a symbol above to view its chart and trade.</p>}
      {loading && <p>Loading {symbol}...</p>}
      {error && <p className="error">Error: {error}</p>}

      {symbol && quote && !loading && (
        <>
          <div className="trade-header">
            <div>
              <h2>{quote.symbol} — {quote.name}</h2>
              <div className="price-line">
                <span className="price">${quote.price?.toFixed(2)}</span>
                <span className={quote.change >= 0 ? "positive" : "negative"}>
                  {quote.change >= 0 ? "+" : ""}{quote.change?.toFixed(2)} ({quote.changePercentage?.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="trade-form">
              <label>
                Qty
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </label>
              <button className="buy" onClick={() => handleTrade("BUY")}>Buy</button>
              <button className="sell" onClick={() => handleTrade("SELL")}>Sell</button>
            </div>
          </div>

          {status && <p className="success">{status}</p>}

          <div className="indicator-controls">
            <label>
              Indicator
              <select value={indicatorType} onChange={(e) => setIndicatorType(e.target.value as IndicatorType)}>
                <option value="sma">SMA</option>
                <option value="ema">EMA</option>
                <option value="rsi">RSI</option>
              </select>
            </label>
            <label>
              Period
              <input type="number" min={2} max={200} value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
            </label>
          </div>

          <div className="chart-panel">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                <XAxis dataKey="date" stroke="#8b94a8" fontSize={11} minTickGap={40} />
                <YAxis stroke="#8b94a8" fontSize={12} domain={["auto", "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="close" name="Close" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="indicator" name={indicatorType.toUpperCase()} stroke="#facc15" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
