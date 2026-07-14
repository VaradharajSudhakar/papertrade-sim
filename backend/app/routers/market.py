from fastapi import APIRouter, HTTPException, Query

from app import fmp_client, indicators
from app.fmp_client import FMPError

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/quote/{symbol}")
async def quote(symbol: str):
    try:
        data = await fmp_client.get_quote(symbol.upper())
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not data:
        raise HTTPException(status_code=404, detail=f"No quote found for {symbol}")
    return data[0]


@router.get("/quotes")
async def quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        return []
    try:
        return await fmp_client.get_quotes(symbol_list)
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/search")
async def search(q: str, exchange: str = "NYSE"):
    try:
        return await fmp_client.search_symbols(q, exchange=exchange)
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/chart/{symbol}")
async def chart(symbol: str, days: int = 180):
    try:
        data = await fmp_client.get_historical_prices(symbol.upper(), days=days)
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "symbol": symbol.upper(),
        "historical": list(reversed(data)),
    }


@router.get("/indicator/{symbol}")
async def indicator(symbol: str, type: str = "sma", period: int = 20, interval: str = "1day"):
    try:
        data = await fmp_client.get_historical_prices(symbol.upper(), days=max(period * 3, 250))
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    ordered = list(reversed(data))  # oldest -> newest
    closes = [d["close"] for d in ordered]
    try:
        values = indicators.compute(type, closes, period)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return [
        {"date": ordered[i]["date"], type: values[i]}
        for i in range(len(ordered))
        if values[i] is not None
    ]


@router.get("/profile/{symbol}")
async def profile(symbol: str):
    try:
        data = await fmp_client.get_profile(symbol.upper())
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not data:
        raise HTTPException(status_code=404, detail=f"No profile found for {symbol}")
    return data[0]
