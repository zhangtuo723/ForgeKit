#!/usr/bin/env python3
"""ForgeKit Studio CLI. Python 3.10+, standard library only."""

import argparse
import http.client
import json
import math
import os
from pathlib import Path
import sys
from urllib import error, parse, request
from uuid import UUID, uuid4


API_BASE_URL = "https://forgekit.cn/api/studio"
SCRIPT_FIELDS = {"title", "synopsis", "genre", "status", "content"}
CHARACTER_FIELDS = {
    "name", "scriptId", "role", "description", "appearance", "personality", "coverAssetId"
}


class CliError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the bearer token to a redirect destination.
        return None


def emit(value, stream=None):
    stream = sys.stdout if stream is None else stream
    text = json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
    secret = os.environ.get("FORGE_API_KEY", "").strip()
    if secret:
        text = text.replace(secret, "[REDACTED]")
    print(text, file=stream)


class StudioClient:
    def __init__(self, timeout=30):
        self.token = os.environ.get("FORGE_API_KEY", "").strip()
        if not self.token:
            raise CliError("请在调用进程环境中配置 FORGE_API_KEY。")
        if any(char.isspace() for char in self.token):
            raise CliError("FORGE_API_KEY 格式无效，不能包含空白字符。")
        self.timeout = timeout
        self.opener = request.build_opener(NoRedirect())

    def send(self, method, path, *, payload=None, multipart=None, query=None, raw_type=None):
        url = API_BASE_URL + path
        if query:
            url += "?" + parse.urlencode(query)
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/json"}
        data = None
        if payload is not None:
            try:
                data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            except (TypeError, ValueError) as exc:
                raise CliError("请求内容必须是有效 JSON。") from exc
            if len(data) > 1024 * 1024:
                raise CliError("JSON 请求超过 1 MiB。")
            headers["Content-Type"] = "application/json"
        if multipart is not None:
            data, headers["Content-Type"] = multipart
        if raw_type:
            headers["Accept"] = ", ".join(raw_type)
        req = request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=self.timeout) as response:
                content = response.read()
                content_type = response.headers.get_content_type()
        except error.HTTPError as exc:
            with exc:
                message = f"HTTP {exc.code}"
                if 300 <= exc.code < 400:
                    message += "：固定服务地址返回重定向，已停止请求。"
                else:
                    try:
                        detail = json.loads(exc.read(65536)).get("error")
                        if isinstance(detail, str):
                            message += ": " + detail[:600]
                    except (ValueError, AttributeError):
                        pass
                raise CliError(message, exc.code) from exc
        except (error.URLError, OSError, http.client.HTTPException) as exc:
            raise CliError("网络请求失败或超时；写入结果可能不确定，请先读取核对，不要盲目重试。") from exc
        if raw_type:
            if content_type not in raw_type:
                raise CliError("服务返回了意外的文件类型，未保存文件。")
            return content
        if content_type != "application/json":
            raise CliError("服务没有返回 JSON，请检查服务状态。")
        try:
            return json.loads(content)
        except (ValueError, UnicodeError) as exc:
            raise CliError("服务返回的 JSON 无法解析。") from exc


def identifier(value):
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("请使用 API 返回的 UUID。") from exc


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("必须为正整数。")
    return number


def positive_timeout(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("超时必须为有限的正数。")
    return number


def json_file(value):
    try:
        text = sys.stdin.read() if value == "-" else Path(value).read_bytes().decode("utf-8-sig")
        result = json.loads(text)
    except (OSError, ValueError, UnicodeError) as exc:
        raise CliError("无法读取 JSON，请提供 UTF-8 JSON 文件或用 --json-file - 从 stdin 输入。") from exc
    if not isinstance(result, dict):
        raise CliError("JSON 输入必须是对象。")
    return result


def write_payload(args):
    payload = json_file(args.json_file) if args.json_file else {}
    allowed = SCRIPT_FIELDS if args.resource == "scripts" else CHARACTER_FIELDS
    if payload.keys() - allowed:
        raise CliError("JSON 含不支持的字段；剧本 revision 请通过 --revision 传入。")
    if args.resource == "scripts":
        for field in ("title", "synopsis", "genre", "status"):
            value = getattr(args, field)
            if value is not None:
                if field in payload:
                    raise CliError(f"{field} 同时出现在 JSON 和命令参数中，请只提供一次。")
                payload[field] = value
        if args.content_file:
            if "content" in payload:
                raise CliError("content 和 --content-file 请只提供一个。")
            try:
                payload["content"] = Path(args.content_file).read_bytes().decode("utf-8-sig")
            except (OSError, UnicodeError) as exc:
                raise CliError("无法读取正文，请提供 UTF-8 文本文件。") from exc
        if "content" in payload and (
            not isinstance(payload["content"], str)
            or len(payload["content"].encode("utf-16-le")) // 2 > 200000
        ):
            raise CliError("正文须为文本，最多 200000 个 UTF-16 字符。")
    if not payload:
        raise CliError("请提供需要创建或修改的字段。")
    if args.action == "create":
        field = "title" if args.resource == "scripts" else "name"
        if not isinstance(payload.get(field), str) or not payload[field].strip():
            raise CliError(f"创建记录必须提供非空 {field}。")
    if args.resource == "scripts" and args.action == "update":
        payload["revision"] = args.revision
    return payload


def multipart_file(path, fields, *, image=False):
    source = Path(path)
    types = (
        {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
        if image else {".txt": "text/plain", ".md": "text/markdown", ".markdown": "text/markdown"}
    )
    content_type = types.get(source.suffix.lower())
    if not content_type:
        raise CliError("不支持的文件扩展名。")
    limit = (10 if image else 2) * 1024 * 1024
    try:
        with source.open("rb") as file:
            content = file.read(limit + 1)
    except OSError as exc:
        raise CliError("无法读取上传文件。") from exc
    if not content or len(content) > limit:
        raise CliError(f"上传文件须为非空文件，且不能超过 {limit // (1024 * 1024)} MiB。")
    if any(char in source.name for char in '\r\n'):
        raise CliError("文件名不能包含换行。")
    filename = source.name.replace("\\", "\\\\").replace('"', '\\"')
    boundary = "forge-" + uuid4().hex
    chunks = []
    for name, value in fields.items():
        if value is not None:
            chunks.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode("utf-8")
            )
    chunks.extend([
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode("utf-8"),
        content,
        f"\r\n--{boundary}--\r\n".encode("ascii"),
    ])
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def save_file(path, content):
    destination = Path(path)
    try:
        with destination.open("xb") as file:
            file.write(content)
    except FileExistsError as exc:
        raise CliError("输出文件已存在，请选择新路径。") from exc
    except OSError as exc:
        raise CliError("无法保存文件，请检查目录和写入权限。") from exc
    return {"data": {"path": str(destination.resolve()), "bytes": len(content)}}


def build_parser():
    parser = argparse.ArgumentParser(
        description=f"幕间 Studio API CLI；固定地址 {API_BASE_URL}；仅从环境读取 FORGE_API_KEY。"
    )
    parser.add_argument("--timeout", type=positive_timeout, default=30, help="请求超时秒数，默认 30")
    commands = parser.add_subparsers(dest="resource", required=True)
    for name in ("overview", "activities", "openapi"):
        command = commands.add_parser(name)
        if name == "openapi":
            command.add_argument("--output", help="保存到新文件；省略时输出 JSON")
    for resource in ("scripts", "characters", "assets"):
        group = commands.add_parser(resource)
        actions = group.add_subparsers(dest="action", required=True)
        listing = actions.add_parser("list")
        if resource != "scripts":
            listing.add_argument("--script-id", type=identifier)
        if resource == "assets":
            listing.add_argument("--character-id", type=identifier)
        for action in ("get", "delete"):
            command = actions.add_parser(action)
            command.add_argument("id", type=identifier)
        if resource in ("scripts", "characters"):
            for action in ("create", "update"):
                command = actions.add_parser(action)
                if action == "update":
                    command.add_argument("id", type=identifier)
                    if resource == "scripts":
                        command.add_argument("--revision", type=positive_int, required=True)
                command.add_argument("--json-file", required=resource == "characters", help="UTF-8 JSON 文件；- 表示 stdin")
                if resource == "scripts":
                    for field in ("title", "synopsis", "genre"):
                        command.add_argument("--" + field)
                    command.add_argument("--status", choices=["草稿", "创作中", "已定稿", "已归档"])
                    command.add_argument("--content-file", help="UTF-8 正文文件")
        if resource == "scripts":
            command = actions.add_parser("import")
            command.add_argument("file")
            command.add_argument("--title")
            command = actions.add_parser("export")
            command.add_argument("id", type=identifier)
            command.add_argument("--format", choices=["txt", "md"], default="txt")
            command.add_argument("--output", required=True)
        if resource == "assets":
            command = actions.add_parser("upload")
            command.add_argument("file")
            command.add_argument("--character-id", type=identifier, required=True)
            command.add_argument("--name")
            command = actions.add_parser("rename")
            command.add_argument("id", type=identifier)
            command.add_argument("--name", required=True)
            command = actions.add_parser("download")
            command.add_argument("id", type=identifier)
            command.add_argument("--output", required=True)
    return parser


def execute(args):
    client = StudioClient(args.timeout)
    if args.resource in ("overview", "activities", "openapi"):
        result = client.send("GET", "/" + args.resource)
        if args.resource == "openapi" and args.output:
            return save_file(args.output, json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8"))
        return result
    path = "/" + args.resource
    action = args.action
    if action == "list":
        query = {}
        for option, field in (("script_id", "scriptId"), ("character_id", "characterId")):
            value = getattr(args, option, None)
            if value:
                query[field] = value
        return client.send("GET", path, query=query)
    if action in ("get", "delete"):
        return client.send("GET" if action == "get" else "DELETE", path + "/" + args.id)
    if action in ("create", "update"):
        payload = write_payload(args)
        if action == "update":
            path += "/" + args.id
        return client.send("POST" if action == "create" else "PATCH", path, payload=payload)
    if action == "import":
        return client.send("POST", path + "/import", multipart=multipart_file(args.file, {"title": args.title}))
    if action == "upload":
        return client.send("POST", path, multipart=multipart_file(
            args.file, {"characterId": args.character_id, "name": args.name}, image=True
        ))
    if action == "rename":
        return client.send("PATCH", path + "/" + args.id, payload={"name": args.name})
    if action == "export":
        content = client.send("GET", path + "/" + args.id + "/export",
                              query={"format": args.format}, raw_type=("text/plain", "text/markdown"))
    else:  # assets download
        content = client.send("GET", path + "/" + args.id + "/file", raw_type=("image/webp",))
    return save_file(args.output, content)


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        emit(execute(args))
        return 0
    except CliError as exc:
        result = {"error": str(exc)}
        if exc.status is not None:
            result["status"] = exc.status
        emit(result, sys.stderr)
        return 1
    except (ValueError, UnicodeError) as exc:
        emit({"error": "输入或响应中存在无效的 JSON 数值或文本编码。"}, sys.stderr)
        return 1


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    raise SystemExit(main())
