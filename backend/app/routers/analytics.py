import math

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import fmp_client
from app.database import get_db
from app.fmp_client import FMPError
from app.models import Holding
from app.routers.portfolio import get_account, _holdings_with_value

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _daily_returns(historical: list[dict]) -> list[float]:
    closes = [d["close"] for d in historical]
    returns = []
    for i in range(1, len(closes)):
        prev = closes[i - 1]
        if prev:
            returns.append((closes[i] - prev) / prev)
    return returns


def _std_dev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


@router.get("")
async def get_analytics(db: Session = Depends(get_db)):
    account = get_account(db)
    holdings = await _holdings_with_value(db)
    total_value = account.cash + sum(h["market_value"] for h in holdings)

    if not holdings or total_value == 0:
        return {
            "total_value": total_value,
            "cash_pct": 100.0,
            "portfolio_beta": None,
            "annualized_volatility_pct": None,
            "sector_allocation": [],
            "largest_position_pct": 0.0,
            "num_positions": 0,
            "holdings_gain_loss": [],
        }

    symbols = [h["symbol"] for h in holdings]
    weights = {h["symbol"]: h["market_value"] / total_value for h in holdings}

    try:
        profiles = await fmp_client.get_profiles(symbols)
    except FMPError:
        profiles = []
    profile_map = {p["symbol"]: p for p in profiles} if profiles else {}

    portfolio_beta = 0.0
    beta_weight_sum = 0.0
    sector_values: dict[str, float] = {}
    for h in holdings:
        p = profile_map.get(h["symbol"], {})
        beta = p.get("beta")
        if beta is not None:
            portfolio_beta += beta * weights[h["symbol"]]
            beta_weight_sum += weights[h["symbol"]]
        sector = p.get("sector") or "Unknown"
        sector_values[sector] = sector_values.get(sector, 0.0) + h["market_value"]

    portfolio_beta = portfolio_beta / beta_weight_sum if beta_weight_sum else None

    # Weighted daily return series for annualized volatility
    daily_series: dict[str, list[float]] = {}
    for symbol in symbols:
        try:
            hist = await fmp_client.get_historical_prices(symbol, days=90)
            daily_series[symbol] = list(reversed(_daily_returns(list(reversed(hist)))))
        except FMPError:
            daily_series[symbol] = []

    min_len = min((len(v) for v in daily_series.values() if v), default=0)
    portfolio_returns = []
    if min_len > 1:
        for i in range(min_len):
            day_return = sum(
                daily_series[s][i] * weights[s] for s in symbols if len(daily_series[s]) > i
            )
            portfolio_returns.append(day_return)

    daily_std = _std_dev(portfolio_returns)
    annualized_volatility_pct = daily_std * math.sqrt(252) * 100 if portfolio_returns else None

    sector_allocation = [
        {"sector": s, "value": v, "pct": (v / total_value) * 100}
        for s, v in sorted(sector_values.items(), key=lambda kv: kv[1], reverse=True)
    ]

    largest_position_pct = max((h["market_value"] / total_value * 100 for h in holdings), default=0.0)

    return {
        "total_value": total_value,
        "cash_pct": (account.cash / total_value) * 100,
        "portfolio_beta": portfolio_beta,
        "annualized_volatility_pct": annualized_volatility_pct,
        "sector_allocation": sector_allocation,
        "largest_position_pct": largest_position_pct,
        "num_positions": len(holdings),
        "holdings_gain_loss": [
            {"symbol": h["symbol"], "gain_loss": h["gain_loss"], "gain_loss_pct": h["gain_loss_pct"]}
            for h in holdings
        ],
    }
