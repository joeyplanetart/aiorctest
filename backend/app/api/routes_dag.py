from __future__ import annotations

import json
import time
import uuid
from collections import defaultdict, deque

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import ApiEndpoint, Environment, EnvironmentEnum, ProjectMember, ProjectVariable, Scenario, User
from app.schemas.scenario import (
    AssertionResult,
    RunFlowResponse,
    RunStepResult,
    ScenarioCreate,
    ScenarioListItem,
    ScenarioOut,
    ScenarioSave,
)

router = APIRouter()


def _check_project_access(db: Session, project_id: str, user: User) -> None:
    if user.is_superadmin:
        return
    mem = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .first()
    )
    if not mem:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this project")


def _scenario_to_out(s: Scenario) -> ScenarioOut:
    return ScenarioOut(
        id=s.id,
        project_id=s.project_id,
        name=s.name,
        nodes=json.loads(s.nodes_json),
        edges=json.loads(s.edges_json),
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


# ---- CRUD ----

@router.get("/{project_id}/scenarios", response_model=list[ScenarioListItem])
def list_scenarios(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    rows = db.query(Scenario).filter(Scenario.project_id == project_id).order_by(Scenario.updated_at.desc()).all()
    result = []
    for s in rows:
        nodes = json.loads(s.nodes_json)
        result.append(ScenarioListItem(
            id=s.id, project_id=s.project_id, name=s.name,
            node_count=len(nodes), created_at=s.created_at, updated_at=s.updated_at,
        ))
    return result


@router.post("/{project_id}/scenarios", response_model=ScenarioOut, status_code=201)
def create_scenario(
    project_id: str,
    body: ScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    s = Scenario(project_id=project_id, name=body.name)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _scenario_to_out(s)


@router.get("/{project_id}/scenarios/{scenario_id}", response_model=ScenarioOut)
def get_scenario(
    project_id: str,
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    s = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.project_id == project_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found")
    return _scenario_to_out(s)


@router.put("/{project_id}/scenarios/{scenario_id}", response_model=ScenarioOut)
def save_scenario(
    project_id: str,
    scenario_id: str,
    body: ScenarioSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    s = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.project_id == project_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found")
    if body.name is not None:
        s.name = body.name
    s.nodes_json = json.dumps([n.model_dump() for n in body.nodes], ensure_ascii=False)
    s.edges_json = json.dumps([e.model_dump() for e in body.edges], ensure_ascii=False)
    db.commit()
    db.refresh(s)
    return _scenario_to_out(s)


@router.delete("/{project_id}/scenarios/{scenario_id}", status_code=204)
def delete_scenario(
    project_id: str,
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    s = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.project_id == project_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found")
    db.delete(s)
    db.commit()


# ---- Run flow ----

def _topo_sort(node_ids: set[str], edges: list[dict]) -> list[str] | None:
    """Kahn's algorithm. Returns topo order or None if cycle detected."""
    in_deg: dict[str, int] = {nid: 0 for nid in node_ids}
    adj: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        src, tgt = e["source"], e["target"]
        if src in node_ids and tgt in node_ids:
            adj[src].append(tgt)
            in_deg[tgt] += 1
    q: deque[str] = deque(nid for nid, d in in_deg.items() if d == 0)
    order: list[str] = []
    while q:
        n = q.popleft()
        order.append(n)
        for nb in adj[n]:
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                q.append(nb)
    return order if len(order) == len(node_ids) else None


def _render(text: str, ctx: dict[str, str]) -> str:
    """Replace {{var}} placeholders with values from context."""
    for k, v in ctx.items():
        text = text.replace("{{" + k + "}}", v)
    return text


def _parse_env_slug(raw: str | None) -> EnvironmentEnum:
    if not raw:
        return EnvironmentEnum.stage
    try:
        return EnvironmentEnum(raw.strip().lower())
    except ValueError:
        return EnvironmentEnum.stage


def _apply_project_base_url(url: str, base_url: str | None) -> str:
    """If URL has no scheme, prepend project environment base_url (same rules as API Management)."""
    u = (url or "").strip()
    if not u:
        return u
    low = u.lower()
    if low.startswith("http://") or low.startswith("https://"):
        return u
    b = (base_url or "").strip().rstrip("/")
    if not b:
        return u
    if u.startswith("/"):
        return f"{b}{u}"
    return f"{b}/{u}"


def _render_dict(d: dict[str, str], ctx: dict[str, str]) -> dict[str, str]:
    return {_render(k, ctx): _render(v, ctx) for k, v in d.items()}


def _extract_vars(
    rules: list[dict],
    resp_body: str,
    resp_headers: dict[str, str],
    status_code: int,
) -> dict[str, str]:
    """Run extraction rules and return extracted variables."""
    from jsonpath_ng import parse as jp_parse

    extracted: dict[str, str] = {}
    for rule in rules:
        var_name = rule.get("var_name", "")
        source = rule.get("source", "body")
        jp = rule.get("json_path", "")
        if not var_name:
            continue

        if source == "status":
            extracted[var_name] = str(status_code)
            continue

        if source == "header":
            if jp:
                extracted[var_name] = resp_headers.get(jp, "")
            continue

        if source == "body" and jp:
            try:
                body_obj = json.loads(resp_body)
                matches = jp_parse(jp).find(body_obj)
                if matches:
                    val = matches[0].value
                    extracted[var_name] = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
            except (json.JSONDecodeError, Exception):
                extracted[var_name] = ""

    return extracted


def _evaluate_assertions(
    assertions: list[dict],
    status_code: int,
    elapsed_ms: float,
    resp_body: str,
    resp_headers: dict[str, str],
    ctx: dict[str, str] | None = None,
) -> list[dict]:
    """Evaluate assertion rules and return results.
    ctx: variable context used to render {{var}} in expected values and json_path.
    """
    import re
    from jsonpath_ng import parse as jp_parse

    _ctx = ctx or {}

    results = []
    for a in assertions:
        aid = a.get("id", "")
        atype = a.get("type", "status_code")
        operator = a.get("operator", "eq")
        # Render {{var}} in expected value, json_path, and header_name using variable context
        expected = _render(a.get("expected", ""), _ctx)
        jp = _render(a.get("json_path", ""), _ctx)
        header_name = _render(a.get("header_name", ""), _ctx)

        actual = ""
        description = ""
        passed = False
        message = ""

        try:
            if atype == "status_code":
                actual = str(status_code)
                description = f"Status code {operator} {expected}"
            elif atype == "response_time":
                actual = str(round(elapsed_ms, 1))
                description = f"Response time {operator} {expected}ms"
            elif atype == "json_path":
                description = f"{jp} {operator} {expected}"
                try:
                    body_obj = json.loads(resp_body)
                    matches = jp_parse(jp).find(body_obj)
                    if matches:
                        val = matches[0].value
                        actual = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
                    else:
                        actual = "__NOT_FOUND__"
                except Exception:
                    actual = "__PARSE_ERROR__"
            elif atype == "header":
                actual = resp_headers.get(header_name.lower(), "")
                description = f"Header '{header_name}' {operator} {expected}"
            elif atype == "body_contains":
                actual = "(body)"
                description = f"Body {operator} '{expected}'"
                if operator == "contains":
                    passed = expected in resp_body
                elif operator == "not_contains":
                    passed = expected not in resp_body
                elif operator == "matches":
                    passed = bool(re.search(expected, resp_body))
                results.append({
                    "id": aid, "type": atype, "description": description,
                    "passed": passed, "actual": actual, "expected": expected,
                    "message": "" if passed else f"Body does not match '{expected}'",
                })
                continue

            if operator in ("gt", "lt", "gte", "lte"):
                try:
                    a_num = float(actual)
                    e_num = float(expected)
                    if operator == "gt":
                        passed = a_num > e_num
                    elif operator == "lt":
                        passed = a_num < e_num
                    elif operator == "gte":
                        passed = a_num >= e_num
                    elif operator == "lte":
                        passed = a_num <= e_num
                except ValueError:
                    passed = False
                    message = f"Cannot compare '{actual}' with '{expected}' numerically"
            elif operator == "eq":
                passed = actual == expected
            elif operator == "ne":
                passed = actual != expected
            elif operator == "contains":
                passed = expected in actual
            elif operator == "not_contains":
                passed = expected not in actual
            elif operator == "exists":
                passed = actual not in ("__NOT_FOUND__", "")
            elif operator == "not_exists":
                passed = actual in ("__NOT_FOUND__", "")
            elif operator == "matches":
                try:
                    passed = bool(re.search(expected, actual))
                except re.error:
                    passed = False
                    message = f"Invalid regex: {expected}"

            if not message and not passed:
                message = f"Expected '{expected}', got '{actual}'"

        except Exception as exc:
            passed = False
            message = str(exc)

        results.append({
            "id": aid, "type": atype, "description": description,
            "passed": passed, "actual": actual, "expected": expected,
            "message": message if not passed else "",
        })
    return results


@router.post("/{project_id}/scenarios/{scenario_id}/run", response_model=RunFlowResponse)
def run_scenario(
    project_id: str,
    scenario_id: str,
    env_slug: str = "stage",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    s = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.project_id == project_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found")

    slug_enum = _parse_env_slug(env_slug)
    env_row = (
        db.query(Environment)
        .filter(Environment.project_id == project_id, Environment.slug == slug_enum)
        .first()
    )
    project_base_url = (env_row.base_url or "").strip() if env_row else ""

    nodes = json.loads(s.nodes_json)
    edges = json.loads(s.edges_json)

    if not nodes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Scenario has no steps")

    node_ids = {n["id"] for n in nodes}
    order = _topo_sort(node_ids, edges)
    if order is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Scenario contains a cycle")

    node_map = {n["id"]: n for n in nodes}
    steps: list[RunStepResult] = []
    passed = 0
    failed = 0
    # Project Variables (same env as base URL) + per-run placeholders for unique values (e.g. email)
    pv_rows = (
        db.query(ProjectVariable)
        .filter(ProjectVariable.project_id == project_id, ProjectVariable.env_slug == slug_enum.value)
        .all()
    )
    ctx = {r.key: r.value for r in pv_rows}
    ctx["_run_ms"] = str(int(time.time() * 1000))
    ctx["_run_uuid"] = str(uuid.uuid4())
    total_a_passed = 0
    total_a_failed = 0

    with httpx.Client(timeout=30, follow_redirects=True, verify=False) as client:
        for nid in order:
            node = node_map[nid]
            data = node.get("data", {})
            ep_id = data.get("endpoint_id")
            overrides = data.get("overrides") or {}
            extract_rules = data.get("extracts", [])
            assertion_rules = data.get("assertions", [])

            step = RunStepResult(node_id=nid, endpoint_id=ep_id)

            if not ep_id:
                step.error = "No endpoint assigned to this step"
                failed += 1
                steps.append(step)
                continue

            ep = db.query(ApiEndpoint).filter(
                ApiEndpoint.id == ep_id,
                ApiEndpoint.project_id == project_id,
            ).first()
            if not ep:
                step.error = f"Endpoint {ep_id} not found"
                failed += 1
                steps.append(step)
                continue

            step.endpoint_name = ep.name
            step.method = ep.method.value if hasattr(ep.method, "value") else str(ep.method)

            run_url = overrides.get("url") or ep.url
            run_url = _render(run_url, ctx)
            run_url = _apply_project_base_url(run_url, project_base_url or None)
            step.url = run_url

            hdrs: dict[str, str] = {}
            try:
                hdrs = json.loads(ep.headers_json or "{}")
            except json.JSONDecodeError:
                pass
            if overrides.get("headers"):
                hdrs.update(overrides["headers"])
            req_headers = _render_dict({k: v for k, v in hdrs.items() if k and v}, ctx)

            qp: dict[str, str] = {}
            try:
                qp = json.loads(ep.query_params_json or "{}")
            except json.JSONDecodeError:
                pass
            if overrides.get("query_params"):
                qp.update(overrides["query_params"])
            params = _render_dict({k: v for k, v in qp.items() if k}, ctx) or None

            # body_type: omitted → use endpoint default, unless user overrode body only (then default json)
            # explicit null/"" → use endpoint body_type ("Use original" in UI)
            body_raw = overrides.get("body") if overrides.get("body") is not None else ep.body_json
            ep_bt = str(ep.body_type) if ep.body_type else "none"
            if "body_type" not in overrides:
                if overrides.get("body") is not None and str(overrides.get("body") or "").strip():
                    body_type = "json"
                else:
                    body_type = ep_bt
            else:
                _bt = overrides.get("body_type")
                if _bt is None or _bt == "":
                    body_type = ep_bt
                else:
                    body_type = _bt

            content: bytes | None = None
            if body_type != "none" and body_raw:
                rendered_body = _render(body_raw, ctx)
                content = rendered_body.encode("utf-8")
                if body_type == "json" and "Content-Type" not in req_headers:
                    req_headers["Content-Type"] = "application/json"

            try:
                t0 = time.perf_counter()
                resp = client.request(
                    method=step.method,
                    url=run_url,
                    headers=req_headers,
                    params=params,
                    content=content,
                )
                elapsed = (time.perf_counter() - t0) * 1000

                step.status_code = resp.status_code
                step.status_text = resp.reason_phrase or ""
                step.elapsed_ms = round(elapsed, 1)
                step.size_bytes = len(resp.content)
                body_text = resp.text
                if len(body_text) > 4096:
                    body_text = body_text[:4096] + "\n... (truncated)"
                step.response_body = body_text

                if extract_rules:
                    extracted = _extract_vars(
                        extract_rules, resp.text, dict(resp.headers), resp.status_code,
                    )
                    step.extracted_vars = extracted
                    ctx.update(extracted)

                if assertion_rules:
                    ar = _evaluate_assertions(
                        assertion_rules, resp.status_code, step.elapsed_ms,
                        resp.text, dict(resp.headers),
                        ctx=ctx,
                    )
                    step.assertion_results = [AssertionResult(**r) for r in ar]
                    step.assertions_passed = sum(1 for r in ar if r["passed"])
                    step.assertions_failed = len(ar) - step.assertions_passed
                    total_a_passed += step.assertions_passed
                    total_a_failed += step.assertions_failed

                # Step passes if status < 400 AND all assertions pass
                step_ok = resp.status_code < 400 and step.assertions_failed == 0
                if step_ok:
                    passed += 1
                else:
                    failed += 1
            except Exception as exc:
                step.error = str(exc)
                failed += 1

            steps.append(step)

    return RunFlowResponse(
        scenario_id=s.id,
        scenario_name=s.name,
        total_steps=len(steps),
        passed=passed,
        failed=failed,
        steps=steps,
        assertions_passed=total_a_passed,
        assertions_failed=total_a_failed,
    )
