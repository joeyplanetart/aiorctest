from __future__ import annotations

import os

from sqlalchemy import func

from app.db.engine import SessionLocal
from app.db.models import User


def bootstrap_superadmin_emails() -> None:
    """Promote users listed in BOOTSTRAP_SUPERADMIN_EMAILS to superadmin (comma-separated, case-insensitive)."""
    raw = os.getenv("BOOTSTRAP_SUPERADMIN_EMAILS", "")
    if not raw.strip():
        return
    emails = [p.strip().lower() for p in raw.split(",") if p.strip()]
    if not emails:
        return

    db = SessionLocal()
    try:
        changed = False
        for el in emails:
            user = db.query(User).filter(func.lower(User.email) == el).first()
            if user and not user.is_superadmin:
                user.is_superadmin = True
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()
