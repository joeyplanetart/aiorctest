"""AI-driven scenario orchestration.

Given a natural-language prompt and the project's API endpoint
catalog, call an OpenAI-compatible LLM to generate a complete DAG
scenario (nodes, edges, overrides, extracts, assertions).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.db.models import ApiEndpoint, ApiFolder
from app.rag.config import LLM_MODEL, OPENAI_API_KEY

_OPENAI_BASE: str | None = None

log = logging.getLogger(__name__)


def _get_openai_base() -> str:
    global _OPENAI_BASE
    if _OPENAI_BASE is None:
        _OPENAI_BASE = (
            os.getenv("OPENAI_API_BASE")
            or os.getenv("OPENAI_BASE_URL")
            or "https://api.openai.com/v1"
        ).rstrip("/")
    return _OPENAI_BASE


SYSTEM_PROMPT = """\
You are an expert API test orchestration assistant.
The user will describe a test scenario in natural language.
Your job is to select the appropriate API endpoints from the \
catalog below, arrange them into an ordered flow, and for each \
step configure:
- overrides (url/headers/query_params/body/body_type) \
if the original values need modification
- extracts (extract variables from response for downstream steps)
- assertions (verify response correctness)

## Available Endpoints

{endpoint_catalog}

## Built-in template variables
- `{{{{_run_uuid}}}}` \u2014 unique UUID per run
- `{{{{_run_ms}}}}` \u2014 epoch-milliseconds timestamp

## Variable referencing
- Extract rules save values into named variables.
- Downstream steps reference them via `{{{{var_name}}}}` \
in any override field or assertion expected value.

## Authentication pattern (CRITICAL)
Most APIs require authentication. Follow this pattern:
1. If the flow includes a login/auth endpoint, extract the \
token from its response (e.g. `$.access_token` or `$.token`).
2. For ALL subsequent steps after login, you MUST add an \
Authorization header override:
   `"headers": {{"Authorization": "Bearer {{{{token}}}}"}}`
   where `token` is the variable name from the extract rule.
3. Even if the endpoint catalog already shows headers, you \
must still override the Authorization header with the \
extracted token variable so it uses the dynamic value.
4. If there is no login step in the flow but the endpoints \
clearly require auth (protected routes), add a note in the \
scenario name or first step label indicating auth is needed.

## Output format
Return **only** a JSON object (no markdown fences):
{{
  "name": "<scenario name>",
  "steps": [
    {{
      "endpoint_id": "<id from catalog>",
      "label": "<human-readable step name>",
      "overrides": {{
        "url": null,
        "headers": null,
        "query_params": null,
        "body": "<JSON string or null>",
        "body_type": "json | text | form | none | null"
      }},
      "extracts": [
        {{
          "var_name": "token",
          "source": "body|header|status",
          "json_path": "$.path"
        }}
      ],
      "assertions": [
        {{
          "type": "status_code",
          "operator": "eq",
          "expected": "200",
          "json_path": "",
          "header_name": ""
        }}
      ]
    }}
  ]
}}

Rules:
- Only use endpoint_id values from the catalog.
- Steps are ordered: step N can reference vars from 0..N-1.
- At minimum check status_code for each step.
- Use {{{{_run_uuid}}}} for unique data.
- Set body_type to "json" when overriding body.
- Set unused override fields to null.
- After a login/auth step, ALWAYS add Authorization header \
to every subsequent step.
- Respond with ONLY the JSON object, no extra text.\
"""


def _build_endpoint_catalog(
    db: Session, project_id: str,
) -> str:
    """Build a textual catalog of all project endpoints."""
    endpoints = (
        db.query(ApiEndpoint)
        .filter(ApiEndpoint.project_id == project_id)
        .order_by(ApiEndpoint.folder_id, ApiEndpoint.sort_order)
        .all()
    )
    if not endpoints:
        return "(No endpoints available)"

    folder_ids = {ep.folder_id for ep in endpoints}
    folders = (
        db.query(ApiFolder)
        .filter(ApiFolder.id.in_(folder_ids))
        .all()
    )
    folder_map = {f.id: f.name for f in folders}

    lines: list[str] = []
    for ep in endpoints:
        folder_name = folder_map.get(ep.folder_id, "Unknown")
        body_preview = ""
        if ep.body_json and ep.body_json.strip():
            body_preview = ep.body_json[:300]
            if len(ep.body_json) > 300:
                body_preview += "..."

        method = (
            ep.method.value
            if hasattr(ep.method, "value")
            else ep.method
        )
        desc = ep.description or ""

        hdrs_preview = ""
        if ep.headers_json and ep.headers_json.strip():
            try:
                hdrs = json.loads(ep.headers_json)
                if hdrs:
                    hdrs_preview = json.dumps(
                        hdrs, ensure_ascii=False,
                    )
            except json.JSONDecodeError:
                pass

        lines.append(
            f"- id: {ep.id}\n"
            f"  folder: {folder_name}\n"
            f"  name: {ep.name}\n"
            f"  method: {method}\n"
            f"  url: {ep.url}\n"
            f"  headers: {hdrs_preview or '(none)'}\n"
            f"  body_type: {ep.body_type}\n"
            f"  body: {body_preview}\n"
            f"  description: {desc}"
        )
    return "\n".join(lines)


def _parse_llm_json(raw: str) -> dict[str, Any]:
    """Extract JSON from LLM output, tolerating markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        first_nl = text.index("\n")
        text = text[first_nl + 1:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def _get_ep_method(ep: ApiEndpoint) -> str:
    if hasattr(ep.method, "value"):
        return ep.method.value
    return str(ep.method)


def _steps_to_nodes_edges(
    steps: list[dict[str, Any]],
    endpoints_by_id: dict[str, ApiEndpoint],
) -> tuple[list[dict], list[dict]]:
    """Convert AI-generated steps into DAG nodes and edges."""
    nodes: list[dict] = []
    edges: list[dict] = []
    prev_id: str | None = None

    for idx, step in enumerate(steps):
        node_id = f"node_{uuid.uuid4().hex[:8]}"
        ep_id = step.get("endpoint_id", "")
        ep = endpoints_by_id.get(ep_id)

        overrides_raw = step.get("overrides") or {}
        overrides = {
            k: v for k, v in overrides_raw.items()
            if v is not None
        }

        extracts = step.get("extracts") or []
        assertions_raw = step.get("assertions") or []
        assertions = []
        for a in assertions_raw:
            assertions.append({
                "id": uuid.uuid4().hex[:8],
                "type": a.get("type", "status_code"),
                "json_path": a.get("json_path", ""),
                "header_name": a.get("header_name", ""),
                "operator": a.get("operator", "eq"),
                "expected": str(a.get("expected", "")),
            })

        fallback_label = (
            ep.name if ep else f"Step {idx + 1}"
        )
        data: dict[str, Any] = {
            "label": step.get("label") or fallback_label,
            "endpoint_id": ep_id,
            "method": _get_ep_method(ep) if ep else "GET",
            "name": ep.name if ep else "",
            "url": ep.url if ep else "",
        }
        if overrides:
            data["overrides"] = overrides
        if extracts:
            data["extracts"] = extracts
        if assertions:
            data["assertions"] = assertions

        node = {
            "id": node_id,
            "type": "apiStep",
            "position": {"x": 250, "y": 80 + idx * 160},
            "data": data,
        }
        nodes.append(node)

        if prev_id:
            edges.append({
                "id": f"e_{prev_id}_{node_id}",
                "source": prev_id,
                "target": node_id,
            })
        prev_id = node_id

    return nodes, edges


async def ai_generate_scenario(
    db: Session,
    project_id: str,
    prompt: str,
) -> dict[str, Any]:
    """Call LLM to generate a scenario from natural language.

    Returns dict with keys: name, nodes, edges.
    Raises ValueError on failure.
    """
    if not OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not configured"
        )

    catalog = _build_endpoint_catalog(db, project_id)
    if "(No endpoints available)" in catalog:
        raise ValueError(
            "项目中没有 API 端点，"
            "请先在「接口管理」中添加端点后再使用 AI 编排"
        )

    system_msg = SYSTEM_PROMPT.format(
        endpoint_catalog=catalog,
    )

    base = _get_openai_base()
    url = f"{base}/chat/completions"

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code != 200:
            log.error(
                "LLM API error %s: %s",
                resp.status_code,
                resp.text[:500],
            )
            raise ValueError(
                f"LLM API 调用失败 (HTTP {resp.status_code})"
            )

    result = resp.json()
    content = result["choices"][0]["message"]["content"]

    try:
        parsed = _parse_llm_json(content)
    except (json.JSONDecodeError, ValueError) as exc:
        log.error(
            "Failed to parse LLM JSON: %s\nRaw: %s",
            exc, content[:1000],
        )
        raise ValueError(
            "AI 返回的编排数据格式无效，请尝试重新描述"
        ) from exc

    steps = parsed.get("steps", [])
    if not steps:
        raise ValueError(
            "AI 未生成任何步骤，请尝试更详细地描述你的测试场景"
        )

    all_endpoints = (
        db.query(ApiEndpoint)
        .filter(ApiEndpoint.project_id == project_id)
        .all()
    )
    ep_map = {ep.id: ep for ep in all_endpoints}

    valid_steps = [
        s for s in steps
        if s.get("endpoint_id") in ep_map
    ]
    if not valid_steps:
        raise ValueError(
            "AI 生成的步骤中没有匹配到有效端点，"
            "请检查端点库或重新描述"
        )

    nodes, edges = _steps_to_nodes_edges(
        valid_steps, ep_map,
    )

    return {
        "name": parsed.get("name", "AI 生成场景"),
        "nodes": nodes,
        "edges": edges,
    }
