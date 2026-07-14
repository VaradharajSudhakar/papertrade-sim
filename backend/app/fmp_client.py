import asyncio
from datetime import date, timedelta

import httpx

from app.config import FMP_API_KEY

STABLE_BASE_URL = "https://financialmodelingprep.com/stable"
TIMEOUT = 10.0


class FMPError(Exception):
    pass


async def _get(path: str, params: dict | None = None) -> object:
    if not FMP_API_KEY:
        raise FMPError("FMP_API_KEY is not configured. Set it in backend/.env")
    query = dict(params or {})
    query["apikey"] = FMP_API_KEY
    url = f"{STABLE_BASE_URL}/{path}"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(url, params=query)
        if resp.status_code != 200:
            raise FMPError(f"FMP request failed ({resp.status_code}): {resp.text}")
        data = resp.json()
        if isinstance(data, dict) and data.get("Error Message"):
            raise FMPError(data["Error Message"])
        if isinstance(data, str):
            # FMP returns plain-text error bodies (still HTTP 200) for restricted endpoints
            raise FMPError(data)
        return data


async def get_quote(symbol: str):
    return await _get("quote", {"symbol": symbol})


async def get_quotes(symbols: list[str]):
    results = await asyncio.gather(*(get_quote(s) for s in symbols), return_exceptions=True)
    quotes = []
    for r in results:
        if isinstance(r, Exception):
            continue
        if r:
            quotes.append(r[0])
    return quotes


async def search_symbols(query: str, exchange: str = "NYSE", limit: int = 15):
    return await _get("search-symbol", {"query": query, "exchange": exchange, "limit": limit})


async def get_historical_prices(symbol: str, days: int = 180):
    from_date = date.today() - timedelta(days=int(days * 1.6) + 10)
    data = await _get(
        "historical-price-eod/full",
        {"symbol": symbol, "from": from_date.isoformat(), "to": date.today().isoformat()},
    )
    # FMP returns newest-first; keep only the most recent `days` entries
    return data[:days] if isinstance(data, list) else data


async def get_profile(symbol: str):
    return await _get("profile", {"symbol": symbol})


async def get_profiles(symbols: list[str]):
    results = await asyncio.gather(*(get_profile(s) for s in symbols), return_exceptions=True)
    profiles = []
    for r in results:
        if isinstance(r, Exception):
            continue
        if r:
            profiles.append(r[0])
    return profiles
