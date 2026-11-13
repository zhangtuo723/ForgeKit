"""Offline CLI checks using a loopback HTTP server and synthetic credentials."""

from contextlib import redirect_stderr, redirect_stdout
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import forge_studio as cli


TEST_KEY = "fg_agent_" + "a" * 64
RECORD_ID = "12345678-1234-4234-8234-123456789abc"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def handle_request(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self.server.calls.append((self.command, self.path, dict(self.headers), body))
        if self.server.redirect:
            self.send_response(307)
            self.send_header("Location", self.server.redirect)
            self.end_headers()
            return
        if self.server.status != 200:
            self.send_response(self.server.status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": self.server.message}).encode())
            return
        self.send_response(200)
        if self.path.endswith("/file"):
            self.send_header("Content-Type", "image/webp")
            content = b"RIFF\x04\x00\x00\x00WEBP"
        elif "/export?" in self.path:
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            content = "第一场\n保留空格  \n".encode()
        else:
            self.send_header("Content-Type", "application/json")
            result = {"data": {"revision": 8, "content": "第一场\n"}}
            if self.command == "GET" and urlsplit(self.path).path in ("/api/studio/scripts", "/api/studio/characters"):
                query = parse_qs(urlsplit(self.path).query)
                page, size = int(query.get("page", [1])[0]), int(query.get("pageSize", [12])[0])
                result = {"data": [{"id": RECORD_ID}], "pagination": {"page": page, "pageSize": size, "total": 25, "totalPages": (25 + size - 1) // size}}
            content = json.dumps(result).encode()
        self.end_headers()
        self.wfile.write(content)

    do_GET = do_POST = do_PATCH = do_DELETE = handle_request


class CliTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.server.calls = []
        self.server.status = 200
        self.server.redirect = None
        self.server.message = "failed"
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.base = f"http://127.0.0.1:{self.server.server_port}/api/studio"
        # Only the test changes the constant; the shipped CLI has no address override.
        self.base_patch = patch.object(cli, "API_BASE_URL", self.base)
        self.base_patch.start()
        self.addCleanup(self.base_patch.stop)
        self.env_patch = patch.dict(os.environ, {"FORGE_API_KEY": TEST_KEY})
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def run_cli(self, *args):
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = cli.main(list(args))
        return code, stdout.getvalue(), stderr.getvalue()

    def test_help_works_without_credentials(self):
        env = dict(os.environ)
        env.pop("FORGE_API_KEY", None)
        result = subprocess.run(
            [sys.executable, str(Path(cli.__file__)), "--help"],
            env=env, capture_output=True, encoding="utf-8", check=False,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("https://forgekit.cn/api/studio", result.stdout)

    def test_missing_key_does_not_send_request(self):
        with patch.dict(os.environ, {"FORGE_API_KEY": ""}):
            code, out, err = self.run_cli("overview")
        self.assertEqual(code, 1)
        self.assertEqual(out, "")
        self.assertIn("FORGE_API_KEY", err)
        self.assertEqual(self.server.calls, [])

    def test_bearer_auth_and_unicode_response(self):
        code, out, err = self.run_cli("scripts", "get", RECORD_ID)
        self.assertEqual(code, 0, err)
        self.assertEqual(json.loads(out)["data"]["content"], "第一场\n")
        method, path, headers, _ = self.server.calls[0]
        self.assertEqual((method, path), ("GET", "/api/studio/scripts/" + RECORD_ID))
        self.assertEqual(headers["Authorization"], "Bearer " + TEST_KEY)
        self.assertNotIn("Cookie", headers)
        self.assertNotIn("Origin", headers)
        self.assertNotIn(TEST_KEY, out + err)

    def test_update_preserves_draft_and_requires_explicit_revision(self):
        text = "第一场\n\n  对白  \n"
        source = self.folder / "story.md"
        source.write_bytes(text.encode("utf-8"))
        with self.assertRaises(SystemExit) as raised, redirect_stderr(io.StringIO()):
            cli.main(["scripts", "update", RECORD_ID, "--content-file", str(source)])
        self.assertEqual(raised.exception.code, 2)
        self.assertEqual(self.server.calls, [])
        code, _, err = self.run_cli("scripts", "update", RECORD_ID,
                                    "--revision", "7", "--content-file", str(source))
        self.assertEqual(code, 0, err)
        method, _, headers, body = self.server.calls[0]
        self.assertEqual(method, "PATCH")
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(json.loads(body), {"revision": 7, "content": text})

    def test_paginated_search_parameters_and_status(self):
        code, out, err = self.run_cli("scripts", "list", "--page", "2", "--page-size", "24", "--query", "雨夜 %_!", "--status", "创作中")
        self.assertEqual(code, 0, err)
        self.assertEqual(json.loads(out)["pagination"], {"page": 2, "pageSize": 24, "total": 25, "totalPages": 2})
        self.assertEqual(parse_qs(urlsplit(self.server.calls[-1][1]).query), {
            "page": ["2"], "pageSize": ["24"], "q": ["雨夜 %_!"], "status": ["创作中"]
        })
        code, _, err = self.run_cli("characters", "list", "--query", "林雾", "--script-id", "unlinked")
        self.assertEqual(code, 0, err)
        self.assertEqual(parse_qs(urlsplit(self.server.calls[-1][1]).query), {
            "page": ["1"], "pageSize": ["12"], "q": ["林雾"], "scriptId": ["unlinked"]
        })
        before = len(self.server.calls)
        code, _, _ = self.run_cli("scripts", "list", "--page-size", "101")
        self.assertEqual(code, 1)
        self.assertEqual(len(self.server.calls), before)

    def test_conflict_is_reported_once_and_draft_survives(self):
        self.server.status = 409
        self.server.message = "剧本已有更新"
        source = self.folder / "draft.md"
        source.write_text("我的修改", encoding="utf-8")
        code, out, err = self.run_cli("scripts", "update", RECORD_ID,
                                    "--revision", "7", "--content-file", str(source))
        self.assertEqual(code, 1)
        self.assertEqual(out, "")
        self.assertEqual(json.loads(err)["status"], 409)
        self.assertEqual(len(self.server.calls), 1)
        self.assertEqual(source.read_text(encoding="utf-8"), "我的修改")

    def test_auth_and_server_failures_do_not_retry_or_leak_key(self):
        for status in (401, 403, 500):
            with self.subTest(status=status):
                self.server.calls = []
                self.server.status = status
                self.server.message = "do not echo " + TEST_KEY
                code, out, err = self.run_cli("scripts", "create", "--title", "新故事")
                self.assertEqual(code, 1)
                self.assertEqual(json.loads(err)["status"], status)
                self.assertNotIn(TEST_KEY, out + err)
                self.assertEqual(len(self.server.calls), 1)

    def test_redirect_never_reaches_destination(self):
        destination = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        destination.calls = []
        thread = threading.Thread(target=destination.serve_forever, daemon=True)
        thread.start()
        try:
            self.server.redirect = f"http://127.0.0.1:{destination.server_port}/stolen"
            code, _, err = self.run_cli("overview")
            self.assertEqual(code, 1)
            self.assertEqual(json.loads(err)["status"], 307)
            self.assertEqual(len(self.server.calls), 1)
            self.assertEqual(destination.calls, [])
        finally:
            destination.shutdown()
            destination.server_close()
            thread.join()

    def test_character_null_fields_and_asset_filters(self):
        body = self.folder / "character.json"
        body.write_text('{"scriptId":null,"coverAssetId":null}', encoding="utf-8")
        code, _, err = self.run_cli("characters", "update", RECORD_ID, "--json-file", str(body))
        self.assertEqual(code, 0, err)
        self.assertEqual(json.loads(self.server.calls[-1][3]), {"scriptId": None, "coverAssetId": None})
        code, _, err = self.run_cli("assets", "list", "--script-id", RECORD_ID, "--character-id", RECORD_ID)
        self.assertEqual(code, 0, err)
        self.assertIn("scriptId=" + RECORD_ID, self.server.calls[-1][1])
        self.assertIn("characterId=" + RECORD_ID, self.server.calls[-1][1])

    def test_stdin_json_and_empty_update_validation(self):
        with patch("sys.stdin", io.StringIO('{"name":"林雨"}')):
            code, _, err = self.run_cli("characters", "create", "--json-file", "-")
        self.assertEqual(code, 0, err)
        self.assertEqual(json.loads(self.server.calls[-1][3]), {"name": "林雨"})
        before = len(self.server.calls)
        code, _, _ = self.run_cli("scripts", "update", RECORD_ID, "--revision", "8")
        self.assertEqual(code, 1)
        self.assertEqual(len(self.server.calls), before)

    def test_multipart_import_and_upload(self):
        for image in (False, True):
            with self.subTest(image=image):
                source = self.folder / ("人物.png" if image else "故事.md")
                content = b"\x89PNG\r\n\x1a\n" if image else "第一场\n对白".encode()
                source.write_bytes(content)
                command = (["assets", "upload", str(source), "--character-id", RECORD_ID, "--name", "人物正面"]
                           if image else ["scripts", "import", str(source), "--title", "我的故事"])
                code, _, err = self.run_cli(*command)
                self.assertEqual(code, 0, err)
                method, path, headers, data = self.server.calls[-1]
                self.assertEqual(method, "POST")
                self.assertEqual(path, "/api/studio/assets" if image else "/api/studio/scripts/import")
                message = BytesParser(policy=default).parsebytes(
                    f'Content-Type: {headers["Content-Type"]}\r\nMIME-Version: 1.0\r\n\r\n'.encode() + data
                )
                parts = {part.get_param("name", header="content-disposition"): part for part in message.iter_parts()}
                self.assertEqual(parts["file"].get_payload(decode=True), content)
                self.assertEqual(parts["file"].get_filename(), source.name)
                field = "characterId" if image else "title"
                self.assertEqual(parts[field].get_payload(decode=True).decode(), RECORD_ID if image else "我的故事")

    def test_download_export_and_existing_file_protection(self):
        for resource, action, suffix in (("assets", "download", ".webp"), ("scripts", "export", ".md")):
            with self.subTest(resource=resource):
                target = self.folder / (resource + suffix)
                code, out, err = self.run_cli(resource, action, RECORD_ID, "--output", str(target))
                self.assertEqual(code, 0, err)
                expected = b"RIFF\x04\x00\x00\x00WEBP" if resource == "assets" else "第一场\n保留空格  \n".encode()
                self.assertEqual(target.read_bytes(), expected)
                self.assertEqual(json.loads(out)["data"]["bytes"], len(expected))
                target.write_bytes(b"keep")
                code, _, _ = self.run_cli(resource, action, RECORD_ID, "--output", str(target))
                self.assertEqual(code, 1)
                self.assertEqual(target.read_bytes(), b"keep")

    def test_error_response_is_not_saved_as_download(self):
        self.server.status = 401
        target = self.folder / "image.webp"
        code, _, _ = self.run_cli("assets", "download", RECORD_ID, "--output", str(target))
        self.assertEqual(code, 1)
        self.assertFalse(target.exists())

    def test_large_upload_rejected_before_network(self):
        source = self.folder / "story.md"
        source.write_bytes(b"x" * (2 * 1024 * 1024 + 1))
        code, _, _ = self.run_cli("scripts", "import", str(source))
        self.assertEqual(code, 1)
        self.assertEqual(self.server.calls, [])


if __name__ == "__main__":
    unittest.main()
