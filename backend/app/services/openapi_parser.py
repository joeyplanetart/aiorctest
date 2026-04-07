"""Parse an OpenAPI 3.x spec (JSON or YAML) into folder + endpoint structures."""
from __future__ import annotations

import json


def parse_openapi(spec_str: str) -> dict:
    """Return {title, folders: [{name, endpoints: [{method, url, name, ...}]}]}."""
    data = _load_spec(spec_str)
    title = data.get("info", {}).get("title", "Imported API")
    servers = data.get("servers", [])
    base_url = servers[0].get("url", "") if servers else ""

    tag_endpoints: dict[str, list[dict]] = {}

    for path, methods in data.get("paths", {}).items():
        if not isinstance(methods, dict):
            continue
        for method, operation in methods.items():
            if method.startswith("x-") or method == "parameters":
                continue
            if not isinstance(operation, dict):
                continue

            tags = operation.get("tags", ["default"])
            op_id = operation.get("operationId", "")
            summary = operation.get("summary", "")
            name = summary or op_id or f"{method.upper()} {path}"

            headers: dict[str, str] = {}
            query_params: dict[str, str] = {}
            for param in operation.get("parameters", []):
                p = _resolve_ref(param, data) if isinstance(param, dict) else param
                if not isinstance(p, dict):
                    continue
                loc = p.get("in", "")
                pname = p.get("name", "")
                schema = _resolve_ref(p.get("schema", {}), data)
                example = p.get("example", schema.get("default", ""))
                if loc == "header":
                    headers[pname] = str(example) if example != "" else ""
                elif loc == "query":
                    query_params[pname] = str(example) if example != "" else ""

            body = ""
            body_type = "none"
            req_body = _resolve_ref(operation.get("requestBody", {}), data)
            if isinstance(req_body, dict) and req_body:
                content = req_body.get("content", {})
                if "application/json" in content:
                    body_type = "json"
                    schema = _resolve_ref(content["application/json"].get("schema", {}), data)
                    example = content["application/json"].get("example")
                    if example is not None:
                        body = json.dumps(example, indent=2, ensure_ascii=False)
                    elif schema:
                        body = json.dumps(
                            _schema_stub(schema, data, set()),
                            indent=2,
                            ensure_ascii=False,
                        )
                elif content:
                    body_type = "raw"

            ep = {
                "method": method.upper(),
                "url": base_url + path,
                "name": name,
                "headers": headers,
                "query_params": query_params,
                "body": body,
                "body_type": body_type,
                "description": operation.get("description", ""),
            }
            for tag in tags:
                tag_endpoints.setdefault(tag, []).append(ep)

    folders = [
        {"name": tag, "endpoints": eps}
        for tag, eps in tag_endpoints.items()
    ]

    return {"title": title, "folders": folders}


def _load_spec(spec_str: str) -> dict:
    try:
        return json.loads(spec_str)
    except (json.JSONDecodeError, TypeError):
        pass
    try:
        import yaml  # type: ignore[import-untyped]
        return yaml.safe_load(spec_str) or {}
    except Exception:
        pass
    return {}


def _resolve_ref(obj: dict | None, root: dict) -> dict:
    """Resolve a JSON $ref pointer like '#/components/schemas/Foo'."""
    if not isinstance(obj, dict):
        return obj or {}
    ref = obj.get("$ref")
    if not ref or not isinstance(ref, str):
        return obj
    parts = ref.lstrip("#/").split("/")
    cur: dict = root
    for part in parts:
        if isinstance(cur, dict):
            cur = cur.get(part, {})
        else:
            return {}
    return cur if isinstance(cur, dict) else {}


def _schema_stub(schema: dict, root: dict, seen: set[str]) -> dict | list | str | int | float | bool:
    """Generate a minimal example object from a JSON Schema, resolving $ref."""
    ref = schema.get("$ref")
    if ref:
        if ref in seen:
            return {}
        seen = seen | {ref}
        schema = _resolve_ref(schema, root)

    if "example" in schema:
        return schema["example"]

    if "anyOf" in schema:
        for variant in schema["anyOf"]:
            resolved = _resolve_ref(variant, root)
            vtype = resolved.get("type")
            if vtype and vtype != "null":
                return _schema_stub(resolved, root, seen)
        return None  # type: ignore[return-value]

    if "oneOf" in schema:
        for variant in schema["oneOf"]:
            resolved = _resolve_ref(variant, root)
            vtype = resolved.get("type")
            if vtype and vtype != "null":
                return _schema_stub(resolved, root, seen)
        return None  # type: ignore[return-value]

    if "allOf" in schema:
        merged: dict = {}
        for sub in schema["allOf"]:
            resolved = _resolve_ref(sub, root)
            stub = _schema_stub(resolved, root, seen)
            if isinstance(stub, dict):
                merged.update(stub)
        return merged

    t = schema.get("type", "object")

    if t == "object":
        props = schema.get("properties", {})
        if not props:
            additional = schema.get("additionalProperties")
            if additional:
                return {"key": _schema_stub(_resolve_ref(additional, root), root, seen)} if isinstance(additional, dict) else {}
            return {}
        result = {}
        for k, v in props.items():
            resolved_v = _resolve_ref(v, root)
            if "default" in resolved_v:
                result[k] = resolved_v["default"]
            else:
                result[k] = _schema_stub(resolved_v, root, seen)
        return result

    if t == "array":
        items = _resolve_ref(schema.get("items", {}), root)
        return [_schema_stub(items, root, seen)]

    if t == "string":
        default = schema.get("default", "")
        fmt = schema.get("format", "")
        if fmt == "email":
            return default or "user@example.com"
        if fmt == "date-time":
            return default or "2025-01-01T00:00:00Z"
        if fmt == "date":
            return default or "2025-01-01"
        if fmt == "uri" or fmt == "url":
            return default or "https://example.com"
        return default or "string"

    if t == "integer":
        return schema.get("default", 0)

    if t == "number":
        return schema.get("default", 0.0)

    if t == "boolean":
        return schema.get("default", False)

    return ""
