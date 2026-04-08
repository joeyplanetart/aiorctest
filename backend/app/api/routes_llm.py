from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import LlmConfig, LlmUsageRecord, Project, User
from app.rag.config import LLM_MODEL
from app.schemas.llm import (
    LlmConfigOut,
    LlmConfigUpdate,
    LlmUsageRecordOut,
    LlmUsageStatsDay,
    LlmUsageSummary,
)

router = APIRouter()


@router.get("/config", response_model=LlmConfigOut)
def get_llm_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = db.query(LlmConfig).filter(LlmConfig.id == "default").first()
    if not cfg:
        return LlmConfigOut(model_name=LLM_MODEL)
    return LlmConfigOut(
        model_name=cfg.model_name,
        api_base=cfg.api_base,
        updated_at=cfg.updated_at,
    )


@router.put("/config", response_model=LlmConfigOut)
def update_llm_config(
    body: LlmConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cfg = db.query(LlmConfig).filter(LlmConfig.id == "default").first()
    if not cfg:
        cfg = LlmConfig(id="default", model_name=body.model_name)
        db.add(cfg)
    else:
        cfg.model_name = body.model_name
    db.commit()
    db.refresh(cfg)
    return LlmConfigOut(
        model_name=cfg.model_name,
        api_base=cfg.api_base,
        updated_at=cfg.updated_at,
    )


@router.get("/usage", response_model=list[LlmUsageRecordOut])
def list_usage_records(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(200, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(LlmUsageRecord)
        .filter(LlmUsageRecord.created_at >= since)
        .order_by(LlmUsageRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    user_ids = {r.user_id for r in rows if r.user_id}
    project_ids = {r.project_id for r in rows if r.project_id}
    users = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)):
            users[u.id] = u.email
    projects = {}
    if project_ids:
        for p in db.query(Project).filter(
            Project.id.in_(project_ids),
        ):
            projects[p.id] = p.name

    return [
        LlmUsageRecordOut(
            id=r.id,
            user_id=r.user_id,
            user_email=users.get(r.user_id),
            project_id=r.project_id,
            project_name=projects.get(r.project_id),
            model=r.model,
            feature=r.feature,
            prompt_tokens=r.prompt_tokens,
            completion_tokens=r.completion_tokens,
            total_tokens=r.total_tokens,
            prompt_summary=r.prompt_summary,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/usage/stats", response_model=list[LlmUsageStatsDay])
def usage_stats(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(LlmUsageRecord)
        .filter(LlmUsageRecord.created_at >= since)
        .all()
    )

    _zero = {
        "total_tokens": 0, "prompt_tokens": 0,
        "completion_tokens": 0, "count": 0,
    }
    by_day: dict[str, dict] = defaultdict(
        lambda: dict(_zero),
    )
    for r in rows:
        day_key = r.created_at.strftime("%Y-%m-%d")
        d = by_day[day_key]
        d["total_tokens"] += r.total_tokens
        d["prompt_tokens"] += r.prompt_tokens
        d["completion_tokens"] += r.completion_tokens
        d["count"] += 1

    today = datetime.utcnow().date()
    result = []
    for i in range(days):
        day = today - timedelta(days=days - 1 - i)
        key = day.strftime("%Y-%m-%d")
        d = by_day.get(key, dict(_zero))
        result.append(LlmUsageStatsDay(date=key, **d))

    return result


@router.get("/usage/summary", response_model=LlmUsageSummary)
def usage_summary(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(LlmUsageRecord)
        .filter(LlmUsageRecord.created_at >= since)
        .all()
    )

    by_model: dict[str, int] = defaultdict(int)
    total_t = total_p = total_c = 0
    for r in rows:
        by_model[r.model] += r.total_tokens
        total_t += r.total_tokens
        total_p += r.prompt_tokens
        total_c += r.completion_tokens

    return LlmUsageSummary(
        total_calls=len(rows),
        total_tokens=total_t,
        total_prompt_tokens=total_p,
        total_completion_tokens=total_c,
        by_model=dict(by_model),
    )
