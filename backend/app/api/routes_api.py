from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import ApiEndpoint, ApiFolder, HttpMethodEnum, ProjectMember, ProjectVariable, User
from app.schemas.api_endpoint import (
    AssertionIn,
    AssertionResult,
    CurlImportRequest,
    EndpointCreate,
    EndpointOut,
    EndpointUpdate,
    FolderCreate,
    FolderOut,
    FolderTree,
    FolderUpdate,
    OpenApiImportRequest,
    RunRequest,
    RunResponse,
    VariableBulkSave,
    VariableOut,
)
from app.services.curl_parser import parse_curl
from app.services.openapi_parser import parse_openapi

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


def _safe_method(m: str) -> HttpMethodEnum:
    try:
        return HttpMethodEnum(m.upper())
    except ValueError:
        return HttpMethodEnum.GET


# ---- Folder CRUD ----

@router.get("/{project_id}/folders", response_model=list[FolderOut])
def list_folders(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folders = (
        db.query(ApiFolder)
        .filter(ApiFolder.project_id == project_id)
        .order_by(ApiFolder.sort_order, ApiFolder.created_at)
        .all()
    )
    return folders


@router.get("/{project_id}/folders/tree", response_model=list[FolderTree])
def folder_tree(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folders = (
        db.query(ApiFolder)
        .filter(ApiFolder.project_id == project_id)
        .order_by(ApiFolder.sort_order, ApiFolder.created_at)
        .all()
    )
    endpoints = (
        db.query(ApiEndpoint)
        .filter(ApiEndpoint.project_id == project_id)
        .order_by(ApiEndpoint.sort_order, ApiEndpoint.created_at)
        .all()
    )

    ep_map: dict[str, list[EndpointOut]] = {}
    for ep in endpoints:
        ep_map.setdefault(ep.folder_id, []).append(EndpointOut.model_validate(ep))

    folder_map: dict[str, FolderTree] = {}
    for f in folders:
        folder_map[f.id] = FolderTree(
            id=f.id, name=f.name, parent_id=f.parent_id,
            sort_order=f.sort_order,
            children=[], endpoints=ep_map.get(f.id, []),
        )

    roots: list[FolderTree] = []
    for ft in folder_map.values():
        if ft.parent_id and ft.parent_id in folder_map:
            folder_map[ft.parent_id].children.append(ft)
        else:
            roots.append(ft)

    return roots


@router.post("/{project_id}/folders", response_model=FolderOut, status_code=201)
def create_folder(
    project_id: str,
    body: FolderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folder = ApiFolder(
        project_id=project_id,
        parent_id=body.parent_id,
        name=body.name,
        sort_order=body.sort_order,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.patch("/{project_id}/folders/{folder_id}", response_model=FolderOut)
def update_folder(
    project_id: str,
    folder_id: str,
    body: FolderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folder = db.query(ApiFolder).filter(
        ApiFolder.id == folder_id, ApiFolder.project_id == project_id
    ).first()
    if not folder:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
    if body.name is not None:
        folder.name = body.name
    if body.parent_id is not None:
        folder.parent_id = body.parent_id or None
    if body.sort_order is not None:
        folder.sort_order = body.sort_order
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{project_id}/folders/{folder_id}", status_code=204)
def delete_folder(
    project_id: str,
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folder = db.query(ApiFolder).filter(
        ApiFolder.id == folder_id, ApiFolder.project_id == project_id
    ).first()
    if not folder:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
    db.delete(folder)
    db.commit()


# ---- Endpoint CRUD ----

@router.get("/{project_id}/endpoints", response_model=list[EndpointOut])
def list_endpoints(
    project_id: str,
    folder_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    q = db.query(ApiEndpoint).filter(ApiEndpoint.project_id == project_id)
    if folder_id:
        q = q.filter(ApiEndpoint.folder_id == folder_id)
    return q.order_by(ApiEndpoint.sort_order, ApiEndpoint.created_at).all()


@router.get("/{project_id}/endpoints/{endpoint_id}", response_model=EndpointOut)
def get_endpoint(
    project_id: str,
    endpoint_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    ep = db.query(ApiEndpoint).filter(
        ApiEndpoint.id == endpoint_id, ApiEndpoint.project_id == project_id
    ).first()
    if not ep:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint not found")
    return ep


@router.post("/{project_id}/endpoints", response_model=EndpointOut, status_code=201)
def create_endpoint(
    project_id: str,
    body: EndpointCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folder = db.query(ApiFolder).filter(
        ApiFolder.id == body.folder_id, ApiFolder.project_id == project_id
    ).first()
    if not folder:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")

    ep = ApiEndpoint(
        project_id=project_id,
        folder_id=body.folder_id,
        name=body.name,
        method=_safe_method(body.method),
        url=body.url,
        headers_json=body.headers_json,
        query_params_json=body.query_params_json,
        body_json=body.body_json,
        body_type=body.body_type,
        description=body.description,
        sort_order=body.sort_order,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


@router.patch("/{project_id}/endpoints/{endpoint_id}", response_model=EndpointOut)
def update_endpoint(
    project_id: str,
    endpoint_id: str,
    body: EndpointUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    ep = db.query(ApiEndpoint).filter(
        ApiEndpoint.id == endpoint_id, ApiEndpoint.project_id == project_id
    ).first()
    if not ep:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint not found")

    for field in ("name", "url", "headers_json", "query_params_json", "body_json", "body_type", "description", "sort_order", "folder_id"):
        val = getattr(body, field, None)
        if val is not None:
            if field == "method":
                setattr(ep, field, _safe_method(val))
            else:
                setattr(ep, field, val)
    if body.method is not None:
        ep.method = _safe_method(body.method)

    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/{project_id}/endpoints/{endpoint_id}", status_code=204)
def delete_endpoint(
    project_id: str,
    endpoint_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    ep = db.query(ApiEndpoint).filter(
        ApiEndpoint.id == endpoint_id, ApiEndpoint.project_id == project_id
    ).first()
    if not ep:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint not found")
    db.delete(ep)
    db.commit()


# ---- Import: cURL ----

@router.post("/{project_id}/import/curl", response_model=EndpointOut, status_code=201)
def import_curl(
    project_id: str,
    body: CurlImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    folder = db.query(ApiFolder).filter(
        ApiFolder.id == body.folder_id, ApiFolder.project_id == project_id
    ).first()
    if not folder:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")

    parsed = parse_curl(body.curl_command)

    hdrs = parsed.get("headers", {})
    qp = parsed.get("query_params", {})

    ep = ApiEndpoint(
        project_id=project_id,
        folder_id=body.folder_id,
        name=parsed["name"],
        method=_safe_method(parsed["method"]),
        url=parsed["url"],
        headers_json=json.dumps(hdrs, ensure_ascii=False, indent=2) if hdrs else "{}",
        query_params_json=json.dumps(qp, ensure_ascii=False, indent=2) if qp else "{}",
        body_json=parsed["body"],
        body_type=parsed["body_type"],
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


# ---- Import: OpenAPI ----

@router.post("/{project_id}/import/openapi", status_code=201)
def import_openapi(
    project_id: str,
    body: OpenApiImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)

    result = parse_openapi(body.openapi_spec)
    created_folders = 0
    created_endpoints = 0

    for folder_data in result.get("folders", []):
        parent_id = body.target_folder_id
        folder = ApiFolder(
            project_id=project_id,
            parent_id=parent_id,
            name=folder_data["name"],
        )
        db.add(folder)
        db.flush()
        created_folders += 1

        for ep_data in folder_data.get("endpoints", []):
            ep = ApiEndpoint(
                project_id=project_id,
                folder_id=folder.id,
                name=ep_data["name"],
                method=_safe_method(ep_data["method"]),
                url=ep_data.get("url", ""),
                headers_json=json.dumps(ep_data.get("headers", {}), ensure_ascii=False),
                query_params_json=json.dumps(ep_data.get("query_params", {}), ensure_ascii=False),
                body_json=ep_data.get("body", ""),
                body_type=ep_data.get("body_type", "none"),
                description=ep_data.get("description", ""),
            )
            db.add(ep)
            created_endpoints += 1

    db.commit()
    return {
        "title": result.get("title", ""),
        "folders_created": created_folders,
        "endpoints_created": created_endpoints,
    }


# ---- Project Variables ----

@router.get("/{project_id}/variables", response_model=list[VariableOut])
def list_variables(
    project_id: str,
    env_slug: str = "stage",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    rows = (
        db.query(ProjectVariable)
        .filter(ProjectVariable.project_id == project_id, ProjectVariable.env_slug == env_slug)
        .order_by(ProjectVariable.key)
        .all()
    )
    return rows


@router.put("/{project_id}/variables", response_model=list[VariableOut])
def bulk_save_variables(
    project_id: str,
    body: VariableBulkSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)
    db.query(ProjectVariable).filter(
        ProjectVariable.project_id == project_id,
        ProjectVariable.env_slug == body.env_slug,
    ).delete()
    for k, v in body.variables.items():
        if not k.strip():
            continue
        db.add(ProjectVariable(
            project_id=project_id,
            env_slug=body.env_slug,
            key=k.strip(),
            value=v,
        ))
    db.commit()
    return (
        db.query(ProjectVariable)
        .filter(ProjectVariable.project_id == project_id, ProjectVariable.env_slug == body.env_slug)
        .order_by(ProjectVariable.key)
        .all()
    )


# ---- Run / Send request ----

def _render(text: str, ctx: dict[str, str]) -> str:
    for k, v in ctx.items():
        text = text.replace("{{" + k + "}}", v)
    return text


def _render_dict(d: dict[str, str], ctx: dict[str, str]) -> dict[str, str]:
    return {_render(k, ctx): _render(v, ctx) for k, v in d.items()}


def _extract_vars(
    rules: list[dict],
    resp_body: str,
    resp_headers: dict[str, str],
    status_code: int,
) -> dict[str, str]:
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
            except Exception:
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
    """Evaluate assertion rules and return list of AssertionResult dicts.
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
                # body_contains uses contains/not_contains operators only
                if operator == "contains":
                    passed = expected in resp_body
                elif operator == "not_contains":
                    passed = expected not in resp_body
                elif operator == "matches":
                    passed = bool(re.search(expected, resp_body))
                results.append({
                    "id": aid, "type": atype, "description": description,
                    "passed": passed, "actual": actual, "expected": expected,
                    "message": "" if passed else f"Body does not match: expected to {operator} '{expected}'",
                })
                continue

            # Numeric comparison for status_code and response_time
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
                passed = actual != "__NOT_FOUND__" and actual != ""
            elif operator == "not_exists":
                passed = actual == "__NOT_FOUND__" or actual == ""
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


@router.post("/{project_id}/run", response_model=RunResponse)
def run_request(
    project_id: str,
    body: RunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(db, project_id, current_user)

    import httpx
    import time

    ctx = dict(body.variables)

    url = _render(body.url, ctx)
    req_headers = _render_dict({k: v for k, v in body.headers.items() if k and v}, ctx)
    params = _render_dict({k: v for k, v in body.query_params.items() if k}, ctx) or None

    content: bytes | None = None
    if body.body_type != "none" and body.body:
        rendered_body = _render(body.body, ctx)
        content = rendered_body.encode("utf-8")
        if body.body_type == "json" and "Content-Type" not in req_headers:
            req_headers["Content-Type"] = "application/json"

    try:
        t0 = time.perf_counter()
        with httpx.Client(timeout=body.timeout, follow_redirects=True, verify=False) as client:
            resp = client.request(
                method=body.method,
                url=url,
                headers=req_headers,
                params=params,
                content=content,
            )
        elapsed = (time.perf_counter() - t0) * 1000
    except httpx.TimeoutException:
        raise HTTPException(
            status.HTTP_504_GATEWAY_TIMEOUT,
            f"Request timed out after {body.timeout}s",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Request failed: {exc}",
        )

    resp_headers = dict(resp.headers)
    resp_body = resp.text
    max_body = 2 * 1024 * 1024
    if len(resp_body) > max_body:
        resp_body = resp_body[:max_body] + "\n\n... (truncated, total length exceeds 2MB)"

    extracted: dict[str, str] = {}
    if body.extract_rules:
        extracted = _extract_vars(
            [r.model_dump() for r in body.extract_rules],
            resp.text,
            resp_headers,
            resp.status_code,
        )

    assertion_results: list[dict] = []
    if body.assertions:
        assertion_results = _evaluate_assertions(
            [a.model_dump() for a in body.assertions],
            resp.status_code,
            round(elapsed, 1),
            resp.text,
            resp_headers,
            ctx=ctx,
        )
    a_passed = sum(1 for r in assertion_results if r["passed"])
    a_failed = len(assertion_results) - a_passed

    return RunResponse(
        status_code=resp.status_code,
        status_text=resp.reason_phrase or "",
        headers=resp_headers,
        body=resp_body,
        elapsed_ms=round(elapsed, 1),
        size_bytes=len(resp.content),
        extracted_vars=extracted,
        assertion_results=[AssertionResult(**r) for r in assertion_results],
        assertions_passed=a_passed,
        assertions_failed=a_failed,
    )
