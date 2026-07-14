from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import fmp_client
from app.config import STARTING_CASH
from app.database import get_db
from app.fmp_client import FMPError
from app.models import Account, Holding, Transaction, EquitySnapshot

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class TradeRequest(BaseModel):
    symbol: str
    side: str  # BUY or SELL
    quantity: float


def get_account(db: Session) -> Account:
    account = db.query(Account).filter(Account.id == 1).first()
    if not account:
        account = Account(id=1, cash=STARTING_CASH)
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


async def _holdings_with_value(db: Session):
    holdings = db.query(Holding).filter(Holding.quantity > 0).all()
    if not holdings:
        return []
    symbols = [h.symbol for h in holdings]
    try:
        quotes = await fmp_client.get_quotes(symbols)
    except FMPError:
        quotes = []
    price_map = {q["symbol"]: q["price"] for q in quotes} if quotes else {}
    result = []
    for h in holdings:
        price = price_map.get(h.symbol, h.avg_cost)
        market_value = price * h.quantity
        cost_basis = h.avg_cost * h.quantity
        result.append({
            "symbol": h.symbol,
            "quantity": h.quantity,
            "avg_cost": h.avg_cost,
            "current_price": price,
            "market_value": market_value,
            "cost_basis": cost_basis,
            "gain_loss": market_value - cost_basis,
            "gain_loss_pct": ((market_value - cost_basis) / cost_basis * 100) if cost_basis else 0.0,
        })
    return result


@router.get("")
async def get_portfolio(db: Session = Depends(get_db)):
    account = get_account(db)
    holdings = await _holdings_with_value(db)
    holdings_value = sum(h["market_value"] for h in holdings)
    total_cost_basis = sum(h["cost_basis"] for h in holdings)
    total_value = account.cash + holdings_value
    return {
        "cash": account.cash,
        "holdings_value": holdings_value,
        "total_value": total_value,
        "total_gain_loss": holdings_value - total_cost_basis,
        "holdings": holdings,
    }


@router.post("/trade")
async def trade(req: TradeRequest, db: Session = Depends(get_db)):
    side = req.side.upper()
    if side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="side must be BUY or SELL")
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")

    symbol = req.symbol.upper()
    try:
        quote_data = await fmp_client.get_quote(symbol)
    except FMPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not quote_data:
        raise HTTPException(status_code=404, detail=f"No quote found for {symbol}")
    price = quote_data[0]["price"]

    account = get_account(db)
    holding = db.query(Holding).filter(Holding.symbol == symbol).first()

    if side == "BUY":
        cost = price * req.quantity
        if cost > account.cash:
            raise HTTPException(status_code=400, detail="Insufficient virtual cash for this trade")
        account.cash -= cost
        if holding:
            total_qty = holding.quantity + req.quantity
            holding.avg_cost = ((holding.avg_cost * holding.quantity) + cost) / total_qty
            holding.quantity = total_qty
        else:
            holding = Holding(symbol=symbol, quantity=req.quantity, avg_cost=price)
            db.add(holding)
    else:  # SELL
        if not holding or holding.quantity < req.quantity:
            raise HTTPException(status_code=400, detail="Insufficient shares to sell")
        proceeds = price * req.quantity
        account.cash += proceeds
        holding.quantity -= req.quantity
        if holding.quantity == 0:
            holding.avg_cost = 0.0

    txn = Transaction(symbol=symbol, side=side, quantity=req.quantity, price=price, timestamp=datetime.utcnow())
    db.add(txn)
    db.commit()

    holdings = await _holdings_with_value(db)
    holdings_value = sum(h["market_value"] for h in holdings)
    snapshot = EquitySnapshot(total_value=account.cash + holdings_value, timestamp=datetime.utcnow())
    db.add(snapshot)
    db.commit()

    return {"status": "ok", "symbol": symbol, "side": side, "quantity": req.quantity, "price": price}


@router.get("/transactions")
def get_transactions(db: Session = Depends(get_db)):
    txns = db.query(Transaction).order_by(Transaction.timestamp.desc()).limit(200).all()
    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "side": t.side,
            "quantity": t.quantity,
            "price": t.price,
            "timestamp": t.timestamp.isoformat(),
        }
        for t in txns
    ]


@router.get("/equity-curve")
def get_equity_curve(db: Session = Depends(get_db)):
    snapshots = db.query(EquitySnapshot).order_by(EquitySnapshot.timestamp.asc()).all()
    return [{"timestamp": s.timestamp.isoformat(), "total_value": s.total_value} for s in snapshots]


@router.post("/reset")
def reset_portfolio(db: Session = Depends(get_db)):
    db.query(Holding).delete()
    db.query(Transaction).delete()
    db.query(EquitySnapshot).delete()
    account = get_account(db)
    account.cash = STARTING_CASH
    db.commit()
    return {"status": "ok", "cash": account.cash}
