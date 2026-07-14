from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import fmp_client
from app.database import get_db
from app.fmp_client import FMPError
from app.models import WatchlistItem

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistRequest(BaseModel):
    symbol: str


@router.get("")
async def get_watchlist(db: Session = Depends(get_db)):
    items = db.query(WatchlistItem).all()
    symbols = [i.symbol for i in items]
    if not symbols:
        return []
    try:
        quotes = await fmp_client.get_quotes(symbols)
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return quotes


@router.post("")
def add_watchlist(req: WatchlistRequest, db: Session = Depends(get_db)):
    symbol = req.symbol.upper()
    existing = db.query(WatchlistItem).filter(WatchlistItem.symbol == symbol).first()
    if not existing:
        db.add(WatchlistItem(symbol=symbol))
        db.commit()
    return {"status": "ok", "symbol": symbol}


@router.delete("/{symbol}")
def remove_watchlist(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    item = db.query(WatchlistItem).filter(WatchlistItem.symbol == symbol).first()
    if item:
        db.delete(item)
        db.commit()
    return {"status": "ok", "symbol": symbol}
