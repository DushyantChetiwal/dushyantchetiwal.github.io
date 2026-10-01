#!/usr/bin/env python3
"""Offline, standard-library checks for the deliberately small public artifact.

This is a static regression guard, not a browser, PDF reader or security audit.
It never reads outside site/, fetches URLs, builds assets or publishes anything.
"""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET
import zlib


SITE = Path(__file__).resolve().parents[1] / "site"
ORIGIN = "https://dushyantchetiwal.github.io"
CANONICAL = ORIGIN + "/"
# Review each new public file explicitly; an extension alone is not permission.
ALLOWED = {
    "index.html", "styles.css", "script.js", ".nojekyll", "robots.txt",
    "sitemap.xml", "assets/favicon.svg", "assets/social-preview.png",
    "assets/dushyant-chetiwal-resume.pdf",
}
EXTENSIONS = {".html", ".css", ".js", ".txt", ".xml", ".svg", ".png", ".pdf"}
PRIVATE = re.compile(
    r"-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----"
    r"|job-finding-ai-[\w.-]*\.json|\bprivate_key(?:_id)?\b"
    r"|\b(?:master[/\\]career-data\.yaml|applications[/\\]|prep[/\\])"
    r"|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})",
    re.I,
)
PHONE = re.compile(r"(?<![\w.])\+?\d(?:[\s().-]*\d){9,14}(?![\w.])")
ADDRESS = re.compile(
    r"\b(?:streetAddress|postalAddress|postalCode)\b"
    r"|\b(?:home|residential|mailing|street)\s+address\s*:"
    r"|\b\d+[A-Za-z]?\s+(?:[\w.-]+\s+){0,5}"
    r"(?:road|street|avenue|lane|sector|apartment|nagar)\b",
    re.I,
)
NETWORK_JS = re.compile(
    r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\("
    r"|\bsendBeacon\s*\(|\bimport\s*(?:\(|[\w*{])"
    r"|https?://|(?<!:)//[\w.-]+/",
    re.I,
)
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)


class Checks:
    def __init__(self):
        self.errors = []
        self.refs = []
        self.documents = {}

    def fail(self, path, message):
        # Never echo matched content: it may be the secret being detected.
        self.errors.append(f"{path}: {message}")

    def privacy(self, path, text):
        if PHONE.search(text) or re.search(r"(?:tel|sms):", text, re.I):
            self.fail(path, "possible phone number; remove or review privately")
        if ADDRESS.search(text):
            self.fail(path, "possible residential/postal address; review privately")

    def css(self, path, text):
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        # Escapes can conceal a URL or import from this intentionally small parser.
        if "\\" in text or re.search(r"@import\b", text, re.I):
            self.fail(path, "CSS imports/escapes are not allowed; use the local stylesheet")
        for match in CSS_URL.finditer(text):
            self.refs.append((path, match[2].strip(), True))

    def script(self, path, text):
        text = re.sub(r"/\*.*?\*/|(?m:^\s*//[^\n]*)", "", text, flags=re.S)
        if NETWORK_JS.search(text):
            self.fail(path, "network/import code is not allowed in local JavaScript")

    def reference(self, source, raw, resource):
        try:
            url = urlsplit(raw.strip())
        except ValueError:
            self.fail(source, "malformed URL")
            return
        if url.scheme == "mailto" and not resource:
            return
        if url.scheme or url.netloc:
            same_origin = url.scheme == "https" and url.netloc.lower() == urlsplit(ORIGIN).netloc
            if not same_origin:
                if resource or url.scheme not in {"http", "https"}:
                    self.fail(source, "external resource or unsupported URL scheme")
                return  # Ordinary external navigation is allowed, not fetched.
        decoded = unquote(url.path)
        if "\\" in decoded or "\x00" in decoded:
            self.fail(source, "unsafe URL path")
            return
        if decoded.startswith("/"):
            target = SITE / decoded.lstrip("/")
        elif decoded:
            target = SITE / source.parent / decoded
        else:
            target = SITE / source
        if decoded.endswith("/"):
            target /= "index.html"
        try:
            target = target.resolve()
            relative = target.relative_to(SITE.resolve())
        except (ValueError, OSError):
            self.fail(source, "URL escapes the public site")
            return
        if relative.as_posix() not in ALLOWED or not target.is_file():
            self.fail(source, "internal URL targets a missing or unapproved file")
            return
        if url.fragment and target.suffix in {".html", ".svg"}:
            document = self.documents.get(relative)
            if document is None or unquote(url.fragment) not in document.ids:
                self.fail(source, "internal URL targets a missing fragment")


class Document(HTMLParser):
    def __init__(self, path, checks):
        super().__init__(convert_charrefs=True)
        self.path, self.checks = path, checks
        self.ids = set()
        self.counts = Counter()
        self.meta = {}
        self.canonicals = []
        self.headings = []
        self.text = []
        self.title = []
        self.in_title = False
        self.in_script = None
        self.in_style = False
        self.script_text = []
        self.style_text = []
        self.active_heading = None
        self.lang = ""
        self.aria_refs = []

    def fail(self, message):
        self.checks.fail(self.path, message)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.counts[tag] += 1
        if len(a) != len(attrs):
            self.fail("duplicate HTML attributes")
        if "id" in a:
            identity = a["id"] or ""
            if not identity or identity in self.ids:
                self.fail("empty or duplicate ID")
            self.ids.add(identity)
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "title":
            self.in_title = True
        if re.fullmatch(r"h[1-6]", tag):
            self.active_heading = [int(tag[1]), []]
            self.headings.append(self.active_heading)
        if tag == "meta":
            key = a.get("name", a.get("property", "")).lower()
            self.meta[key] = a.get("content", "")
            if a.get("http-equiv", "").lower() == "refresh":
                self.fail("meta refresh is not allowed")
            if key in {"og:image", "twitter:image"}:
                self.checks.refs.append((self.path, a.get("content", ""), True))
        if tag == "link" and "canonical" in a.get("rel", "").split():
            self.canonicals.append(a.get("href", ""))
        if tag in {"base", "iframe", "object", "embed", "form"}:
            self.fail(f"{tag} is not permitted in this static portfolio")
        if tag == "script":
            self.in_script = a.get("type", "").lower()
            self.script_text = []
        if tag == "style":
            self.in_style = True
            self.style_text = []
        for key, value in attrs:
            value = value or ""
            if key in {"alt", "title", "aria-label", "content", "href"}:
                self.checks.privacy(self.path, value)
            if key.startswith("on") or key in {"ping", "srcdoc"}:
                self.fail("inline event handlers, ping and embedded documents are not allowed")
            if key == "style":
                self.checks.css(self.path, value)
            if key in {"href", "src", "poster", "xlink:href", "action", "data"}:
                self.checks.refs.append((self.path, value, tag not in {"a", "area"}))
            if key == "srcset":
                for candidate in value.split(","):
                    parts = candidate.split()
                    if parts:
                        self.checks.refs.append((self.path, parts[0], True))
            if key in {"aria-labelledby", "aria-describedby", "aria-controls", "for"}:
                self.aria_refs.extend(value.split())

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if re.fullmatch(r"h[1-6]", tag):
            self.active_heading = None
        if tag == "script" and self.in_script is not None:
            if self.in_script != "application/ld+json":
                self.checks.script(self.path, "".join(self.script_text))
            self.in_script = None
        if tag == "style":
            self.checks.css(self.path, "".join(self.style_text))
            self.in_style = False

    def handle_data(self, data):
        self.text.append(data)
        if self.in_title:
            self.title.append(data)
        if self.active_heading is not None:
            self.active_heading[1].append(data)
        if self.in_script is not None:
            self.script_text.append(data)
        if self.in_style:
            self.style_text.append(data)

    def validate(self):
        for identity in self.aria_refs:
            if identity not in self.ids:
                self.fail("ARIA/label reference targets a missing ID")
        self.checks.privacy(self.path, " ".join(self.text))
        if self.path.suffix != ".html":
            return
        if not self.lang:
            self.fail("html must declare a language")
        for tag in ("main", "h1", "title"):
            if self.counts[tag] != 1:
                self.fail(f"expected exactly one {tag}")
        if not "".join(self.title).strip():
            self.fail("title must not be empty")
        for key in ("description", "viewport", "og:title", "og:description", "og:image"):
            if not self.meta.get(key, "").strip():
                self.fail(f"missing or empty {key} metadata")
        if self.canonicals != [CANONICAL] or self.meta.get("og:url") != CANONICAL:
            self.fail("canonical and og:url must match the intended personal site")
        previous = 0
        for level, text in self.headings:
            if level > previous + 1:
                self.fail("heading levels must not skip a level")
            if not "".join(text).strip():
                self.fail("heading must not be empty")
            previous = level
        self.checks.privacy(self.path, " ".join(self.text))


def check_pdf(path, data, checks):
    if not data.startswith(b"%PDF-"):
        checks.fail(path, "invalid PDF signature")
    # Best effort only: compressed streams may contain readable text. Font maps,
    # image-only pages and non-Flate filters require an actual PDF review.
    streams = [data]
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\n?endstream", data, re.S):
        try:
            decoded = zlib.decompressobj().decompress(match[1], 8 * 1024 * 1024)
            streams.append(decoded)
        except zlib.error:
            pass
    for stream in streams:
        text = stream.decode("latin-1")
        if PRIVATE.search(text):
            checks.fail(path, "private marker in PDF")
        # Inspect literal strings, not drawing coordinates or PDF date metadata.
        # Text split into glyph codes cannot reliably be recovered without fonts.
        literals = []
        for match in re.finditer(r"\(((?:\\.|[^()\\])*)\)", text, re.S):
            value = match[1]
            if re.match(r"D:\d{8,}", value):
                continue
            value = re.sub(r"\\([0-7]{1,3})", lambda m: chr(int(m[1], 8)), value)
            value = re.sub(r"\\([()\\])", r"\1", value)
            literals.append(value)
        checks.privacy(path, " ".join(literals))


def main():
    checks = Checks()
    if not SITE.is_dir() or SITE.is_symlink():
        print("FAIL: site must be a real directory", file=sys.stderr)
        return 1
    found = set()
    for file in sorted(SITE.rglob("*")):
        path = file.relative_to(SITE)
        name = path.as_posix()
        if file.is_symlink() or (hasattr(file, "is_junction") and file.is_junction()):
            checks.fail(path, "symlinks/junctions are forbidden")
            continue
        if file.is_dir():
            if name != "assets":
                checks.fail(path, "directory is not on the public allowlist")
            continue
        if name not in ALLOWED or (name != ".nojekyll" and file.suffix not in EXTENSIONS):
            checks.fail(path, "file is not on the public path/extension allowlist")
            continue
        found.add(name)
        try:
            data = file.read_bytes()
            if file.suffix == ".pdf":
                check_pdf(path, data, checks)
                continue
            if file.suffix == ".png":
                if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                    checks.fail(path, "invalid PNG signature")
                continue
            text = data.decode("utf-8")
            if PRIVATE.search(text):
                checks.fail(path, "private marker in public file")
            if file.suffix in {".html", ".svg"}:
                document = Document(path, checks)
                document.feed(text)
                document.close()
                document.validate()
                checks.documents[path] = document
            elif file.suffix == ".css":
                checks.css(path, text)
            elif file.suffix == ".js":
                checks.script(path, text)
            elif name == "sitemap.xml":
                root = ET.fromstring(text)
                locations = [node.text for node in root.findall("{*}url/{*}loc")]
                if root.tag != "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset" or locations != [CANONICAL]:
                    checks.fail(path, "sitemap must contain only the intended canonical URL")
            elif name == "robots.txt":
                if "Sitemap: " + ORIGIN + "/sitemap.xml" not in text:
                    checks.fail(path, "missing canonical sitemap declaration")
        except (OSError, UnicodeError, ET.ParseError, ValueError) as error:
            checks.fail(path, f"could not parse/read file ({type(error).__name__})")
    for missing in sorted(ALLOWED - found):
        checks.fail(missing, "required public file is missing")
    for source, raw, resource in checks.refs:
        checks.reference(source, raw, resource)
    if checks.errors:
        print("Static validation failed:", file=sys.stderr)
        for error in checks.errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"PASS: {len(found)} allowlisted public files; local references and static checks passed.")
    print("Manual visual, PDF/image privacy and browser/network review are still required.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
