import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8001",
});

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercentage: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  cost_basis: number;
  gain_loss: number;
  gain_loss_pct: number;
}

export interface PortfolioSummary {
  cash: number;
  holdings_value: number;
  total_value: number;
  total_gain_loss: number;
  holdings: Holding[];
}

export interface Transaction {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  timestamp: string;
}

export interface EquityPoint {
  timestamp: string;
  total_value: number;
}

export interface AnalyticsSummary {
  total_value: number;
  cash_pct: number;
  portfolio_beta: number | null;
  annualized_volatility_pct: number | null;
  sector_allocation: { sector: string; value: number; pct: number }[];
  largest_position_pct: number;
  num_positions: number;
  holdings_gain_loss: { symbol: string; gain_loss: number; gain_loss_pct: number }[];
}

export const getPortfolio = () => api.get<PortfolioSummary>("/api/portfolio").then((r) => r.data);
export const getTransactions = () => api.get<Transaction[]>("/api/portfolio/transactions").then((r) => r.data);
export const getEquityCurve = () => api.get<EquityPoint[]>("/api/portfolio/equity-curve").then((r) => r.data);
export const placeTrade = (symbol: string, side: "BUY" | "SELL", quantity: number) =>
  api.post("/api/portfolio/trade", { symbol, side, quantity }).then((r) => r.data);
export const resetPortfolio = () => api.post("/api/portfolio/reset").then((r) => r.data);

export const getWatchlist = () => api.get<Quote[]>("/api/watchlist").then((r) => r.data);
export const addWatchlist = (symbol: string) => api.post("/api/watchlist", { symbol }).then((r) => r.data);
export const removeWatchlist = (symbol: string) => api.delete(`/api/watchlist/${symbol}`).then((r) => r.data);

export const getQuote = (symbol: string) => api.get<Quote>(`/api/market/quote/${symbol}`).then((r) => r.data);
export const searchSymbols = (q: string) =>
  api.get<{ symbol: string; name: string; exchange: string }[]>("/api/market/search", { params: { q } }).then((r) => r.data);
export const getChart = (symbol: string, days = 180) =>
  api.get<{ symbol: string; historical: { date: string; close: number }[] }>(`/api/market/chart/${symbol}`, { params: { days } }).then((r) => r.data);
export const getIndicator = (symbol: string, type: string, period = 20) =>
  api.get<{ date: string; [key: string]: number | string }[]>(`/api/market/indicator/${symbol}`, { params: { type, period } }).then((r) => r.data);
export const getProfile = (symbol: string) => api.get(`/api/market/profile/${symbol}`).then((r) => r.data);

export const getAnalytics = () => api.get<AnalyticsSummary>("/api/analytics").then((r) => r.data);
