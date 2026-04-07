"""Parse a cURL command string into structured API endpoint data."""
from __future__ import annotations

import json
import re
import shlex
from urllib.parse import urlparse, parse_qs, unquote


SKIP_HEADERS = {
    "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
    "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
    "upgrade-insecure-requests", "priority",
}


def parse_curl(curl_cmd: str) -> dict:
    """Return a dict with keys: method, url, headers, query_params, body, body_type, name."""
    cmd = curl_cmd.strip()
    if cmd.lower().startswith("curl"):
        cmd = cmd[4:].strip()

    cmd = re.sub(r"\\\s*\n", " ", cmd)
    cmd = re.sub(r"\\\s*\r\n", " ", cmd)

    try:
        tokens = shlex.split(cmd)
    except ValueError:
        tokens = cmd.split()

    method = "GET"
    url = ""
    headers: dict[str, str] = {}
    body = ""
    body_type = "none"

    FLAGS_WITH_ARG = {
        "-b", "--cookie",
        "-c", "--cookie-jar",
        "-o", "--output",
        "-u", "--user",
        "-A", "--user-agent",
        "-e", "--referer",
        "-T", "--upload-file",
        "--connect-timeout", "--max-time",
        "-w", "--write-out",
        "--resolve", "--proxy",
        "--cert", "--key", "--cacert",
        "--retry", "--retry-delay",
        "-F", "--form",
    }

    FLAGS_NO_ARG = {
        "-k", "--insecure",
        "-L", "--location",
        "-s", "--silent",
        "-S", "--show-error",
        "-v", "--verbose",
        "-I", "--head",
        "--compressed",
        "-f", "--fail",
        "-N", "--no-buffer",
        "-G", "--get",
    }

    i = 0
    is_get_flag = False

    while i < len(tokens):
        tok = tokens[i]

        if tok in ("-X", "--request") and i + 1 < len(tokens):
            method = tokens[i + 1].upper()
            i += 2
            continue

        if tok in ("-H", "--header") and i + 1 < len(tokens):
            hdr = tokens[i + 1]
            if ":" in hdr:
                key, _, val = hdr.partition(":")
                headers[key.strip()] = val.strip()
            i += 2
            continue

        if tok in ("-d", "--data", "--data-raw", "--data-binary", "--data-urlencode") and i + 1 < len(tokens):
            body = tokens[i + 1]
            if method == "GET" and not is_get_flag:
                method = "POST"
            i += 2
            continue

        if tok in ("-b", "--cookie") and i + 1 < len(tokens):
            headers["Cookie"] = tokens[i + 1]
            i += 2
            continue

        if tok in ("-A", "--user-agent") and i + 1 < len(tokens):
            headers["User-Agent"] = tokens[i + 1]
            i += 2
            continue

        if tok in ("-e", "--referer") and i + 1 < len(tokens):
            headers["Referer"] = tokens[i + 1]
            i += 2
            continue

        if tok == "--url" and i + 1 < len(tokens):
            url = tokens[i + 1].strip("'\"")
            i += 2
            continue

        if tok in ("-G", "--get"):
            is_get_flag = True
            method = "GET"
            i += 1
            continue

        if tok in ("-I", "--head"):
            method = "HEAD"
            i += 1
            continue

        if tok in FLAGS_NO_ARG:
            i += 1
            continue

        if tok in FLAGS_WITH_ARG and i + 1 < len(tokens):
            i += 2
            continue

        if not tok.startswith("-") and not url:
            url = tok.strip("'\"")
            i += 1
            continue

        i += 1

    clean_headers: dict[str, str] = {}
    for k, v in headers.items():
        if k.lower() not in SKIP_HEADERS:
            clean_headers[k] = v
    headers = clean_headers

    query_params: dict[str, str] = {}
    if url:
        parsed_url = urlparse(url)
        if parsed_url.query:
            qs = parse_qs(parsed_url.query, keep_blank_values=True)
            for k, vals in qs.items():
                query_params[k] = vals[0] if len(vals) == 1 else ", ".join(vals)
            url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"

    if body:
        try:
            json.loads(body)
            body_type = "json"
            if "Content-Type" not in headers:
                headers["Content-Type"] = "application/json"
        except (json.JSONDecodeError, TypeError):
            body_type = "raw"

    name = _derive_name(method, url)

    return {
        "method": method,
        "url": url,
        "headers": headers,
        "query_params": query_params,
        "body": body,
        "body_type": body_type,
        "name": name,
    }


def _derive_name(method: str, url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    path = parsed.path.rstrip("/")
    last_seg = path.rsplit("/", 1)[-1] if path else ""
    if last_seg:
        return f"{method} /{last_seg}"
    if host:
        return f"{method} {host}"
    return f"{method} {url[:60]}" if url else method
