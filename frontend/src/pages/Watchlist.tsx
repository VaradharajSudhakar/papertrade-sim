import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWatchlist, addWatchlist, removeWatchlist, searchSymbols } from "../api/client";
import type { Quote } from "../api/client";

export default function Watchlist() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string; exchange: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getWatchlist()
      .then((q) => {
        setQuotes(q);
        setError(null);
      })
      .catch((err) => setError(err?.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  const handleAdd = async (symbol: string) => {
    await addWatchlist(symbol);
    setQuery("");
    setResults([]);
    load();
  };

  const handleRemove = async (symbol: string) => {
    await removeWatchlist(symbol);
    load();
  };

  return (
    <div>
      <h1>Watchlist</h1>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search NYSE symbols (e.g. JPM, DIS, KO)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((r) => (
              <li key={r.symbol} onClick={() => handleAdd(r.symbol)}>
                <strong>{r.symbol}</strong> — {r.name} <span className="muted">({r.exchange})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <p>Loading watchlist...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && quotes.length === 0 && !error && (
        <p className="muted">Your watchlist is empty. Search above to add NYSE symbols.</p>
      )}

      {quotes.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Price</th>
              <th>Change</th>
              <th>Change %</th>
              <th>Day High</th>
              <th>Day Low</th>
              <th>Volume</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.symbol}>
                <td className="symbol">
                  <Link to={`/trade?symbol=${q.symbol}`}>{q.symbol}</Link>
                </td>
                <td>{q.name}</td>
                <td>${q.price?.toFixed(2)}</td>
                <td className={q.change >= 0 ? "positive" : "negative"}>{q.change?.toFixed(2)}</td>
                <td className={q.changePercentage >= 0 ? "positive" : "negative"}>{q.changePercentage?.toFixed(2)}%</td>
                <td>${q.dayHigh?.toFixed(2)}</td>
                <td>${q.dayLow?.toFixed(2)}</td>
                <td>{q.volume?.toLocaleString()}</td>
                <td>
                  <button className="link-btn" onClick={() => handleRemove(q.symbol)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
