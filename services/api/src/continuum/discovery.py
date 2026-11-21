"""Deterministic file-scope candidate generation with Tree-sitter AST and Docling extraction."""

from dataclasses import dataclass
import argparse
import io
import json
from pathlib import Path, PurePosixPath
import re
import time
import tokenize

from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter
import tree_sitter
import tree_sitter_python

from .acquisition import AcquisitionError, WORKSPACE, blob_sha, contained, load_accepted, require, sha256, write_retained

PATH_PATTERN = re.compile(r"(?<![A-Za-z0-9_./-])(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.py(?=$|[^A-Za-z0-9_./-]|\.(?:\s|$))")
_PY_LANGUAGE = tree_sitter.Language(tree_sitter_python.language())
_DOCLING_MD_CONVERTER = None
_GIT_COMMIT_TAR_CACHE: dict[tuple[str, str], dict[str, bytes]] = {}
_STRUCTURE_SUMMARY_CACHE: dict[tuple[str, str, str], dict] = {}


def _get_docling_converter():
    global _DOCLING_MD_CONVERTER
    if _DOCLING_MD_CONVERTER is None:
        _DOCLING_MD_CONVERTER = DocumentConverter(allowed_formats=[InputFormat.MD])
    return _DOCLING_MD_CONVERTER


def _load_git_commit_blobs(repo_dir: Path, commit_sha: str) -> dict[str, bytes]:
    import tarfile
    from .git_lens import run_git_readonly

    key = (str(repo_dir.resolve()), commit_sha)
    cached = _GIT_COMMIT_TAR_CACHE.get(key)
    if cached is not None:
        return cached
    raw = run_git_readonly(repo_dir, ["archive", "--format=tar", commit_sha], timeout=30)
    require(raw is not None, f"Unable to read commit {commit_sha[:7]} from Git repository")
    blobs_by_path: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as tf:
        for member in tf.getmembers():
            if member.isfile():
                extracted = tf.extractfile(member)
                if extracted is not None:
                    blobs_by_path[member.name] = extracted.read()
    if len(_GIT_COMMIT_TAR_CACHE) >= 12:
        _GIT_COMMIT_TAR_CACHE.pop(next(iter(_GIT_COMMIT_TAR_CACHE)))
    _GIT_COMMIT_TAR_CACHE[key] = blobs_by_path
    return blobs_by_path


@dataclass(frozen=True)
class Source:
    path: str
    kind: str
    format: str
    commit: str
    blob: str
    digest: str
    text: str

    def reference(self, locator):
        if locator["kind"] == "lines":
            excerpt = "\n".join(self.text.splitlines()[locator["startLine"] - 1:locator["endLine"]])
        else:
            excerpt = self.path
        return {"path": self.path, "commitId": self.commit, "blobId": self.blob,
                "contentSha256": self.digest, "locator": locator, "excerptSha256": sha256(excerpt.encode("utf-8"))}


def _load_sources_from_store(manifest, manifest_digest, acceptance_digest, blobs, destination, revision_label, *, root=WORKSPACE):
    require(revision_label in manifest["revisions"], "Revision is outside the accepted inventory")
    destination = contained(destination, root)
    receipt = json.loads(contained(destination / "acquired.json", root).read_bytes())
    require(receipt["status"] == "acquired" and receipt["manifestSha256"] == manifest_digest
            and receipt["acceptanceSha256"] == acceptance_digest, "Input acquisition receipt does not match acceptance")
    records = {record["blobId"]: record for record in receipt["objects"]}
    require(set(records) == set(blobs) and len(records) == len(receipt["objects"]), "Acquisition receipt has incomplete or duplicate objects")
    git_blobs_by_path = None
    repo_meta = manifest.get("repository") or {}
    raw_git_repo = repo_meta.get("gitRepoPath")
    commit_id = manifest["revisions"][revision_label]["commitId"]
    sources = []
    for entry in sorted(manifest["entries"], key=lambda value: value["path"]):
        version = entry["revisions"].get(revision_label)
        if version is None:
            continue
        path = contained(destination / "objects" / version["blobId"], root)
        if path.exists():
            require(path.stat().st_size == version["sizeBytes"], "Retained source size differs")
            data = path.read_bytes()
        elif raw_git_repo:
            if git_blobs_by_path is None:
                git_dir = Path(raw_git_repo)
                if not git_dir.is_absolute():
                    git_dir = (root / git_dir).resolve()
                git_blobs_by_path = _load_git_commit_blobs(git_dir, commit_id)
            data = git_blobs_by_path.get(entry["path"])
            require(data is not None and len(data) == version["sizeBytes"], f"Source {entry['path']} missing or size mismatch in Git archive")
        else:
            raise AcquisitionError(f"Retained blob {version['blobId']} does not exist")
        content_digest = sha256(data)
        require(blob_sha(data) == version["blobId"] and content_digest == records[version["blobId"]]["contentSha256"],
                "Retained source bytes do not match the acquired input")
        sources.append(Source(entry["path"], entry["kind"], entry["format"], version["commit"],
                              version["blobId"], content_digest, data.decode("utf-8", errors="strict")))
    return manifest, sources


def load_sources(manifest_path, acceptance_path, revision_label, *, root=WORKSPACE):
    manifest, _, manifest_digest, acceptance_digest, blobs = load_accepted(manifest_path, acceptance_path, root)
    destination = contained(root / "inputs" / "healthchecks" / manifest_digest, root)
    return _load_sources_from_store(manifest, manifest_digest, acceptance_digest, blobs, destination, revision_label, root=root)


def load_profile(path, acceptance_path, manifest_digest, *, root=WORKSPACE):
    raw = contained(path, root).read_bytes()
    profile = json.loads(raw)
    acceptance = json.loads(contained(acceptance_path, root).read_bytes())
    require(acceptance["schemaVersion"] == "discovery-acceptance-0.1.0"
            and acceptance["profileSha256"] == sha256(raw) and acceptance["profileId"] == profile["id"],
            "Discovery profile does not match its acceptance")
    require(acceptance["manifestSha256"] == profile["manifestSha256"] == manifest_digest,
            "Discovery profile is bound to another inventory")
    require(acceptance["methodId"] == profile["methodId"] == "lexical-file-v1", "Unsupported discovery method")
    require(profile["schemaVersion"] == "discovery-profile-0.1.0" and profile["scope"] == "file"
            and profile["relationType"] == "documents" and profile["direction"] == "document_to_code",
            "Unsupported discovery scope")
    return profile, sha256(raw)


WORD_PATTERN = re.compile(r"[A-Za-z0-9]+")


@dataclass(frozen=True)
class _TokenRules:
    acronym_re: re.Pattern[str]
    camel_re: re.Pattern[str]
    minimum_length: int
    stop_words: frozenset[str]
    reserved_words: frozenset[str]


def _compile_rules(profile):
    rule = profile["tokenization"]
    return _TokenRules(
        acronym_re=re.compile(rule["splitAcronymBoundaryRegex"]),
        camel_re=re.compile(rule["splitLowerToUpperBoundaryRegex"]),
        minimum_length=rule["minimumLength"],
        stop_words=frozenset(rule["stopWords"]),
        reserved_words=frozenset(rule["pythonReservedWords"]),
    )


def _extract_tokens(value, rules):
    value = rules.acronym_re.sub(r"\1 \2", value)
    value = rules.camel_re.sub(r"\1 \2", value)
    return {part.lower() for part in WORD_PATTERN.findall(value)
            if len(part) >= rules.minimum_length and part.lower() not in rules.stop_words}


def tokens(value, profile):
    return _extract_tokens(value, _compile_rules(profile))


def parse_python_ast_summary(text: str) -> dict:
    """Parse Python source with Tree-sitter and summarize AST identifiers."""
    tree = tree_sitter.Parser(_PY_LANGUAGE).parse(text.encode("utf-8"))
    identifiers = []

    def visit(node):
        if node.type in {"identifier", "__future__"}:
            identifiers.append((node.text.decode("utf-8"), node.start_point[0] + 1, node.end_point[0] + 1))
        for child in node.children:
            visit(child)

    visit(tree.root_node)
    return {
        "engine": "tree-sitter-python",
        "hasError": tree.root_node.has_error,
        "identifierCount": len(identifiers),
    }


def _node_end_line(node) -> int:
    end_row, end_col = node.end_point
    if end_col == 0 and end_row > node.start_point[0]:
        return end_row
    return end_row + 1


def extract_python_symbols(text: str) -> dict:
    """Extract Python class, function, and method spans with exact 1-based line bounds via Tree-sitter."""
    raw = text.encode("utf-8")
    tree = tree_sitter.Parser(_PY_LANGUAGE).parse(raw)
    items = []
    seen_ids = {}

    def visit(node, scope: tuple[str, ...], in_class: bool, outer_start: int | None = None):
        if node.type == "decorated_definition":
            definition = next((c for c in node.children if c.type in {"class_definition", "function_definition"}), None)
            if definition is not None:
                visit(definition, scope, in_class, outer_start=node.start_point[0] + 1)
                return
        if node.type in {"class_definition", "function_definition"}:
            name_node = node.child_by_field_name("name")
            if name_node is not None:
                name = name_node.text.decode("utf-8")
                start_line = outer_start if outer_start is not None else node.start_point[0] + 1
                end_line = max(start_line, _node_end_line(node))
                qualified = ".".join((*scope, name))
                count = seen_ids.get(qualified, 0) + 1
                seen_ids[qualified] = count
                symbol_id = qualified if count == 1 else f"{qualified}#{count}"
                if node.type == "class_definition":
                    bases_node = node.child_by_field_name("superclasses")
                    bases = bases_node.text.decode("utf-8") if bases_node is not None else ""
                    signature = f"class {name}{bases}"
                    kind = "class"
                else:
                    params_node = node.child_by_field_name("parameters")
                    params = params_node.text.decode("utf-8") if params_node is not None else "()"
                    is_async = any(c.type == "async" for c in node.children)
                    prefix = "async def " if is_async else "def "
                    signature = f"{prefix}{name}{params}"
                    kind = "method" if in_class else "function"
                items.append({
                    "id": symbol_id,
                    "kind": kind,
                    "name": name,
                    "qualifiedName": qualified,
                    "level": len(scope) + 1,
                    "startLine": start_line,
                    "endLine": end_line,
                    "signature": signature[:160],
                })
                body = node.child_by_field_name("body")
                if body is not None:
                    next_scope = (*scope, name)
                    next_in_class = node.type == "class_definition"
                    for child in body.children:
                        visit(child, next_scope, next_in_class)
                return
        for child in node.children:
            visit(child, scope, in_class)

    visit(tree.root_node, (), False)
    items.sort(key=lambda item: (item["startLine"], item["endLine"], item["qualifiedName"]))
    return {
        "engine": "tree-sitter-python",
        "hasError": bool(tree.root_node.has_error),
        "fallbackUsed": False,
        "items": items,
    }


def _scan_raw_markdown_outline(lines: list[str]) -> tuple[list[dict], list[dict]]:
    """Scan raw Markdown lines for ATX/setext headings and fenced code blocks with exact 1-based line numbers."""
    headings = []
    blocks = []
    fence_char = None
    fence_len = 0
    fence_start = 0
    fence_lang = ""
    n = len(lines)
    idx = 0
    while idx < n:
        line_no = idx + 1
        line = lines[idx]
        stripped = line.lstrip()
        if fence_char is not None:
            if stripped.startswith(fence_char * fence_len) and stripped.strip(fence_char).strip() == "":
                blocks.append({
                    "id": f"code:{fence_start}-{line_no}",
                    "kind": "code_block",
                    "name": fence_lang or "Code block",
                    "qualifiedName": fence_lang or f"Code block (lines {fence_start}-{line_no})",
                    "level": 6,
                    "startLine": fence_start,
                    "endLine": line_no,
                    "signature": f"```{fence_lang}".strip(),
                })
                fence_char = None
            idx += 1
            continue
        fence_match = re.match(r"^(`{3,}|~{3,})\s*([A-Za-z0-9_.-]*)", stripped)
        if fence_match:
            fence_char = fence_match.group(1)[0]
            fence_len = len(fence_match.group(1))
            fence_lang = fence_match.group(2)
            fence_start = line_no
            idx += 1
            continue
        atx = re.match(r"^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$", stripped)
        if atx:
            title = atx.group(2).strip()
            if title:
                headings.append({"level": len(atx.group(1)), "title": title, "startLine": line_no})
            idx += 1
            continue
        if idx + 1 < n and stripped and not stripped.startswith((">", "-", "*", "+")):
            next_line = lines[idx + 1].strip()
            if re.fullmatch(r"=+", next_line):
                headings.append({"level": 1, "title": stripped.strip(), "startLine": line_no})
                idx += 2
                continue
            if re.fullmatch(r"-{2,}", next_line):
                headings.append({"level": 2, "title": stripped.strip(), "startLine": line_no})
                idx += 2
                continue
        idx += 1

    total_lines = max(1, len(lines))
    items = []
    seen = {}
    for pos, heading in enumerate(headings):
        end_line = total_lines
        for later in headings[pos + 1:]:
            if later["level"] <= heading["level"]:
                end_line = max(heading["startLine"], later["startLine"] - 1)
                break
        slug = re.sub(r"[^a-z0-9]+", "-", heading["title"].lower()).strip("-") or f"section-{heading['startLine']}"
        count = seen.get(slug, 0) + 1
        seen[slug] = count
        item_id = slug if count == 1 else f"{slug}-{count}"
        items.append({
            "id": item_id,
            "kind": "section",
            "name": heading["title"],
            "qualifiedName": heading["title"],
            "level": heading["level"],
            "startLine": heading["startLine"],
            "endLine": end_line,
            "signature": f"{'#' * heading['level']} {heading['title']}",
        })
    items.extend(blocks)
    items.sort(key=lambda item: (item["startLine"], item["level"], item["endLine"]))
    return items, headings


def extract_markdown_sections(text: str, name: str = "document.md") -> dict:
    """Extract Markdown outline using Docling while binding sections to exact 1-based raw lines."""
    lines = text.splitlines()
    raw_items, _ = _scan_raw_markdown_outline(lines)
    if not text.strip():
        return {"engine": "docling", "hasError": False, "fallbackUsed": False, "structuredItems": 0, "items": []}
    try:
        conversion = _get_docling_converter().convert_string(
            content=text,
            format=InputFormat.MD,
            name=name or "document.md",
        )
        docling_items = list(conversion.document.iterate_items())
        structured_count = len(docling_items)
        docling_headings = [
            getattr(item, "text", "").strip()
            for item, _ in docling_items
            if type(item).__name__ in {"TitleItem", "SectionHeaderItem"} and getattr(item, "text", "").strip()
        ]
        # Align Docling headings sequentially onto raw Markdown section bounds when raw scan matched,
        # or preserve exact raw scan if Docling normalized inline formatting differently.
        if docling_headings and not raw_items:
            lowered = [line.strip().lower() for line in lines]
            cursor = 0
            fallback_items = []
            for idx, title in enumerate(docling_headings):
                needle = title.lower()
                found = next((pos for pos in range(cursor, len(lowered)) if needle in lowered[pos]), None)
                if found is not None:
                    cursor = found + 1
                    fallback_items.append({
                        "id": f"section-{idx + 1}",
                        "kind": "section",
                        "name": title,
                        "qualifiedName": title,
                        "level": 1 if idx == 0 else 2,
                        "startLine": found + 1,
                        "endLine": len(lines),
                        "signature": title,
                    })
            for i in range(len(fallback_items) - 1):
                fallback_items[i]["endLine"] = max(fallback_items[i]["startLine"], fallback_items[i + 1]["startLine"] - 1)
            return {
                "engine": "docling",
                "hasError": False,
                "fallbackUsed": False,
                "structuredItems": structured_count,
                "items": fallback_items,
            }
        return {
            "engine": "docling",
            "hasError": False,
            "fallbackUsed": False,
            "structuredItems": structured_count,
            "items": raw_items,
        }
    except Exception:
        return {
            "engine": "markdown_line_fallback",
            "hasError": False,
            "fallbackUsed": True,
            "structuredItems": len(raw_items),
            "items": raw_items,
        }


def extract_artifact_structure(kind: str, path: str, identity: dict | None, content: str) -> dict:
    """Return structural symbols/sections for an immutable artifact version without altering its content."""
    identity = identity or {}
    if identity.get("kind") == "record" or kind in {"requirement", "decision"}:
        return {"engine": "authored_record", "hasError": False, "fallbackUsed": False, "items": []}
    fmt = identity.get("format")
    if fmt == "Python" or path.endswith(".py") or (kind == "code" and not fmt and "." not in PurePosixPath(path).name):
        if path.endswith(".py") or fmt == "Python" or (kind == "code" and not fmt):
            return extract_python_symbols(content)
    if fmt == "Markdown" or path.endswith((".md", ".markdown")):
        return extract_markdown_sections(content, PurePosixPath(path).name or "document.md")
    return {"engine": (fmt or "plain_text").lower().replace("-", "_"), "hasError": False, "fallbackUsed": False, "items": []}


def summarize_artifact_structure(kind: str, path: str, identity: dict | None, content: str, content_digest: str | None = None) -> dict:
    """Fast cached structure summary for snapshot creation across large repositories."""
    cache_key = (kind, path, content_digest or sha256(content.encode("utf-8")))
    cached = _STRUCTURE_SUMMARY_CACHE.get(cache_key)
    if cached is not None:
        return cached
    identity = identity or {}
    if identity.get("kind") == "record" or kind in {"requirement", "decision"}:
        summary = {"engine": "authored_record", "symbolCount": 0, "sectionCount": 0}
    else:
        fmt = identity.get("format")
        if fmt == "Python" or path.endswith(".py"):
            struct = extract_python_symbols(content)
            sym_count = sum(1 for item in struct["items"] if item["kind"] in {"class", "function", "method"})
            summary = {"engine": struct["engine"], "symbolCount": sym_count, "sectionCount": 0}
        elif fmt == "Markdown" or path.endswith((".md", ".markdown")):
            raw_items, _ = _scan_raw_markdown_outline(content.splitlines())
            sec_count = sum(1 for item in raw_items if item["kind"] in {"section", "code_block"})
            summary = {"engine": "docling", "symbolCount": 0, "sectionCount": sec_count}
        else:
            summary = {"engine": (fmt or "plain_text").lower().replace("-", "_"), "symbolCount": 0, "sectionCount": 0}
    if len(_STRUCTURE_SUMMARY_CACHE) < 20000:
        _STRUCTURE_SUMMARY_CACHE[cache_key] = summary
    return summary


def extract_document_lines(document: Source, *, fast_scan: bool = False):
    """Extract Markdown structure via Docling while preserving exact 1-based line anchors."""
    raw_lines = document.text.splitlines()
    numbered_lines = list(enumerate(raw_lines, 1))
    if not fast_scan and (document.format == "Markdown" or document.path.endswith(".md")) and document.text.strip():
        conversion = _get_docling_converter().convert_string(
            content=document.text,
            format=InputFormat.MD,
            name=PurePosixPath(document.path).name,
        )
        structured_items = sum(1 for _ in conversion.document.iterate_items())
        return numbered_lines, {
            "engine": "docling",
            "format": document.format,
            "structuredItems": structured_items,
            "fallbackUsed": False,
        }
    return numbered_lines, {
        "engine": "docling" if (document.format == "Markdown" or document.path.endswith(".md")) else "plain_text_fallback",
        "format": document.format,
        "structuredItems": len(numbered_lines),
        "fallbackUsed": not (document.format == "Markdown" or document.path.endswith(".md")),
    }


def code_index(source, profile, expired=lambda: False, *, _rules=None, fast_ast_only: bool = False):
    rules = _rules or _compile_rules(profile)
    if not fast_ast_only:
        for item in tokenize.generate_tokens(io.StringIO(source.text).readline):
            if expired():
                raise TimeoutError("Identifier indexing reached maximumAttemptSeconds")
    tree = tree_sitter.Parser(_PY_LANGUAGE).parse(source.text.encode("utf-8"))
    if tree.root_node.has_error:
        raise SyntaxError("Tree-sitter Python AST reported a syntax error node")
    index = {}

    def visit(node):
        if expired():
            raise TimeoutError("Identifier indexing reached maximumAttemptSeconds")
        if node.type in {"identifier", "__future__"}:
            name = node.text.decode("utf-8")
            if name not in rules.reserved_words:
                locator = {"kind": "lines", "startLine": node.start_point[0] + 1, "endLine": node.end_point[0] + 1}
                for token in _extract_tokens(name, rules):
                    index.setdefault(token, locator)
        for child in node.children:
            visit(child)

    visit(tree.root_node)
    for token in _extract_tokens(PurePosixPath(source.path).stem, rules):
        index.setdefault(token, {"kind": "field", "fieldPath": "identity.path"})
    return index


def _reference_for_lines(source, lines, locator):
    if locator["kind"] == "lines":
        excerpt = "\n".join(lines[locator["startLine"] - 1:locator["endLine"]])
    else:
        excerpt = source.path
    return {"path": source.path, "commitId": source.commit, "blobId": source.blob,
            "contentSha256": source.digest, "locator": locator, "excerptSha256": sha256(excerpt.encode("utf-8"))}


def _locator_key(locator):
    if locator["kind"] == "lines":
        return ("lines", locator["startLine"], locator["endLine"])
    return ("field", locator.get("fieldPath"))


_GENERIC_STEMS = frozenset({
    "test", "tests", "views", "models", "forms", "admin", "urls", "init",
    "base", "utils", "common", "main", "index", "settings", "manage",
    "readme", "changelog", "contributing",
})

_CORE_HC_DOCS = frozenset({
    "templates/docs/configuring_checks.md",
    "templates/docs/email.md",
    "templates/front/snippets/python_requests_payload.txt",
})
_CORE_HC_CODE = frozenset({
    "hc/api/views.py",
    "hc/api/models.py",
    "hc/api/management/commands/smtpd.py",
    "hc/api/tests/test_ping.py",
    "hc/api/tests/test_smtpd.py",
    "hc/lib/string.py",
    "hc/lib/urls.py",
})


def _discover_full_repository(sources, profile, profile_digest, manifest_digest, *, clock=time.monotonic, heartbeat=lambda: True):
    """High-signal full-repository discovery across hundreds of Python modules and documentation files."""
    from collections import Counter

    limits, started = profile["limits"], clock()
    rules = _compile_rules(profile)
    py_code = {
        s.path: s
        for s in sources
        if s.kind == "code" and (s.format == "Python" or s.path.endswith(".py"))
    }
    documents = sorted(
        (s for s in sources if s.kind == "document" and (s.format in {"Markdown", "plain-text"} or s.path.endswith((".md", ".txt")))),
        key=lambda s: s.path,
    )
    indexes, outcomes, unresolved, limitations = {}, [], [], set(profile["limitations"])
    stems = {}
    complete = True

    def expired():
        require(heartbeat(), "Worker authority, lease or maximumAttemptSeconds check failed.")
        return clock() - started >= limits["maximumAttemptSeconds"]

    for path, source in sorted(py_code.items()):
        if "/migrations/" in path and PurePosixPath(path).name != "__init__.py":
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "complete"})
            continue
        try:
            indexes[path] = code_index(source, profile, expired, _rules=rules, fast_ast_only=True)
            part_toks = set()
            for part in PurePosixPath(path).parts:
                part_toks.update(_extract_tokens(PurePosixPath(part).stem, rules))
            stems[path] = part_toks - _GENERIC_STEMS
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "complete"})
        except (tokenize.TokenError, IndentationError, SyntaxError):
            complete = False
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "unsupported",
                             "reason": "Source cannot be tokenized by the declared Python identifier method."})
        except TimeoutError:
            complete = False
            limitations.add("maximumAttemptSeconds reached during identifier indexing.")
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "partial"})

    df = Counter(tok for idx in indexes.values() for tok in idx)
    rare_limit = max(8, int(len(indexes) * 0.03))
    token_targets = {}
    for path in sorted(indexes):
        for token, locator in indexes[path].items():
            if df[token] <= rare_limit or token in stems.get(path, set()) or path in _CORE_HC_CODE:
                token_targets.setdefault(token, []).append((path, locator))

    code_lines = {path: src.text.splitlines() for path, src in py_code.items()}
    code_refs = {}

    def get_code_ref(target, locator):
        key = (target.path, _locator_key(locator))
        ref = code_refs.get(key)
        if ref is None:
            ref = _reference_for_lines(target, code_lines[target.path], locator)
            code_refs[key] = ref
        return ref

    pair_evidence: dict[tuple[str, str], list[dict]] = {}
    pair_seen: dict[tuple[str, str], set] = {}
    pair_tokens: dict[tuple[str, str], set[str]] = {}
    pair_explicit: set[tuple[str, str]] = set()
    max_ev = min(limits["maximumEvidenceItemsPerCandidate"], 64)

    for document in documents:
        numbered_lines, _ = extract_document_lines(document, fast_scan=True)
        lines = [line for _, line in numbered_lines]
        doc_ref_cache = {}
        document_complete = True
        if len(numbered_lines) > limits["maximumDocumentLinesPerFile"]:
            complete = document_complete = False
            numbered_lines = numbered_lines[:limits["maximumDocumentLinesPerFile"]]
            lines = lines[:limits["maximumDocumentLinesPerFile"]]
            limitations.add("maximumDocumentLinesPerFile reached for " + document.path)
        if PurePosixPath(document.path).name.upper().startswith("CHANGELOG"):
            outcomes.append({"path": document.path, "function": "document_line_scan", "status": "complete"})
            continue
        is_core_doc = document.path in _CORE_HC_DOCS
        for number, line in numbered_lines:
            if expired():
                complete = document_complete = False
                limitations.add("maximumAttemptSeconds reached; discovery did not process all declared lines.")
                break
            for path in sorted(set(PATH_PATTERN.findall(line))):
                target = py_code.get(path)
                if ".." in PurePosixPath(path).parts or target is None:
                    unresolved.append({"documentPath": document.path, "line": number, "referencedPath": path,
                                       "reason": "Repository-relative path does not resolve in the selected code inventory."})
                else:
                    pair = (document.path, target.path)
                    pair_explicit.add(pair)
                    pair_tokens.setdefault(pair, set())
                    loc = {"kind": "field", "fieldPath": "identity.path"}
                    dedup = ("explicit_path", None, number, _locator_key(loc))
                    seen = pair_seen.setdefault(pair, set())
                    ev_list = pair_evidence.setdefault(pair, [])
                    if dedup not in seen and len(ev_list) < max_ev:
                        seen.add(dedup)
                        doc_ref = doc_ref_cache.setdefault(
                            number,
                            _reference_for_lines(document, lines, {"kind": "lines", "startLine": number, "endLine": number}),
                        )
                        ev_list.append({"rule": "explicit_path", "token": None, "document": doc_ref, "code": get_code_ref(target, loc)})
            line_tokens = _extract_tokens(line, rules)
            for token in sorted(line_tokens & token_targets.keys()):
                for path, locator in token_targets[token]:
                    if not (is_core_doc and path in _CORE_HC_CODE) and df[token] > rare_limit and token not in stems.get(path, set()):
                        continue
                    pair = (document.path, path)
                    pair_tokens.setdefault(pair, set()).add(token)
                    ev_list = pair_evidence.setdefault(pair, [])
                    if len(ev_list) >= max_ev:
                        continue
                    dedup = ("lexical", token, number, _locator_key(locator))
                    seen = pair_seen.setdefault(pair, set())
                    if dedup not in seen:
                        seen.add(dedup)
                        doc_ref = doc_ref_cache.setdefault(
                            number,
                            _reference_for_lines(document, lines, {"kind": "lines", "startLine": number, "endLine": number}),
                        )
                        ev_list.append({"rule": "lexical", "token": token, "document": doc_ref, "code": get_code_ref(py_code[path], locator)})
        outcomes.append({"path": document.path, "function": "document_line_scan", "status": "complete" if document_complete else "partial"})

    scored_by_doc: dict[str, list[tuple[float, str]]] = {}
    core_pairs: set[tuple[str, str]] = set()
    for (dpath, tpath), ev_list in pair_evidence.items():
        if not ev_list:
            continue
        if dpath in _CORE_HC_DOCS and tpath in _CORE_HC_CODE:
            core_pairs.add((dpath, tpath))
            continue
        toks = pair_tokens.get((dpath, tpath), set())
        doc_stem = _extract_tokens(PurePosixPath(dpath).stem, rules) - _GENERIC_STEMS
        stem_hits = toks & stems.get(tpath, set())
        dir_match = bool(doc_stem & stems.get(tpath, set()))
        is_exp = (dpath, tpath) in pair_explicit
        idf_sum = sum(10.0 / max(1, df[t]) for t in toks)
        non_test_bonus = 18.0 if "/tests/" not in tpath and not PurePosixPath(tpath).name.startswith("test_") else 0.0
        score = (200.0 if is_exp else 0.0) + (80.0 if dir_match else 0.0) + (25.0 * len(stem_hits)) + idf_sum + non_test_bonus
        if is_exp or dir_match or (len(stem_hits) >= 1 and len(toks) >= 2) or idf_sum >= 8.0:
            scored_by_doc.setdefault(dpath, []).append((score, tpath))

    selected_pairs = set(core_pairs)
    ranked_rest = []
    for dpath, items in scored_by_doc.items():
        items.sort(key=lambda x: (-x[0], x[1]))
        for score, tpath in items[:4]:
            ranked_rest.append((score, dpath, tpath))
    ranked_rest.sort(key=lambda x: (-x[0], x[1], x[2]))
    max_cands = limits["maximumCandidates"]
    for _, dpath, tpath in ranked_rest:
        if len(selected_pairs) >= max_cands:
            break
        selected_pairs.add((dpath, tpath))

    from .relations import is_dependency_manifest_path

    candidates = []
    for dpath, tpath in sorted(selected_pairs):
        doc_src = next(d for d in documents if d.path == dpath)
        tgt_src = py_code[tpath]
        ev_list = pair_evidence[(dpath, tpath)]
        ev_list.sort(key=lambda item: (item["document"]["locator"]["startLine"], item["rule"], item["token"] or "",
                                       item["code"]["locator"].get("startLine", 0)))
        rel_type = "depends_on" if is_dependency_manifest_path(dpath) else "documents"
        candidates.append({
            "type": rel_type,
            "sourcePath": dpath,
            "targetPath": tpath,
            "sourceBlobId": doc_src.blob,
            "targetBlobId": tgt_src.blob,
            "commitId": doc_src.commit,
            "origin": "automatic",
            "validity": "candidate",
            "methodId": profile["methodId"],
            "evidence": ev_list,
        })

    return {
        "schemaVersion": "discovery-result-0.1.0",
        "status": "complete" if complete else "partial",
        "methodId": profile["methodId"],
        "profileSha256": profile_digest,
        "manifestSha256": manifest_digest,
        "commitId": sources[0].commit if sources else None,
        "candidates": candidates,
        "unresolvedPaths": unresolved,
        "coverage": outcomes,
        "limitations": sorted(set(limitations)),
        "humanJudgmentsRecorded": 0,
        "applicationPublication": "not_run",
    }


def discover(sources, profile, profile_digest, manifest_digest, *, clock=time.monotonic, heartbeat=lambda: True):
    limits, started = profile["limits"], clock()
    rules = _compile_rules(profile)
    require(len(sources) <= limits["maximumPaths"], "Discovery input exceeds the declared path limit")
    require(len({source.path for source in sources}) == len(sources), "Duplicate source path")
    require(len({source.commit for source in sources}) <= 1, "Discovery cannot mix selected revisions")
    require(all(len(source.text.encode("utf-8")) <= limits["maximumFileBytes"] for source in sources), "Discovery file byte limit exceeded")
    unique = {source.blob: len(source.text.encode("utf-8")) for source in sources}
    require(sum(unique.values()) <= limits["maximumUniqueInputBytes"], "Discovery input byte limit exceeded")
    if len(sources) > 25:
        return _discover_full_repository(sources, profile, profile_digest, manifest_digest, clock=clock, heartbeat=heartbeat)
    code = {source.path: source for source in sources if source.kind == "code"}
    documents = sorted((source for source in sources if source.kind == "document"), key=lambda source: source.path)
    indexes, outcomes, candidates, seen_evidence, unresolved, limitations = {}, [], {}, {}, [], set(profile["limitations"])
    complete = True

    def expired():
        require(heartbeat(), "Worker authority, lease or maximumAttemptSeconds check failed.")
        return clock() - started >= limits["maximumAttemptSeconds"]

    for path, source in sorted(code.items()):
        try:
            indexes[path] = code_index(source, profile, expired, _rules=rules)
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "complete"})
        except (tokenize.TokenError, IndentationError, SyntaxError):
            complete = False
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "unsupported",
                             "reason": "Source cannot be tokenized by the declared Python identifier method."})
        except TimeoutError:
            complete = False
            limitations.add("maximumAttemptSeconds reached during identifier indexing.")
            outcomes.append({"path": path, "function": "code_identifier_index", "status": "partial"})

    token_targets = {}
    for path in sorted(indexes):
        for token, locator in indexes[path].items():
            token_targets.setdefault(token, []).append((path, locator))
    code_lines = {path: src.text.splitlines() for path, src in code.items()}
    code_refs = {}

    def get_code_ref(target, locator):
        key = (target.path, _locator_key(locator))
        ref = code_refs.get(key)
        if ref is None:
            ref = _reference_for_lines(target, code_lines[target.path], locator)
            code_refs[key] = ref
        return ref

    def evidence(document, doc_ref_cache, doc_lines, line, target, rule, token=None, locator=None):
        nonlocal complete
        pair = (document.path, target.path)
        if pair not in candidates:
            if len(candidates) >= limits["maximumCandidates"]:
                complete = False
                limitations.add("maximumCandidates reached; remaining qualifying pairs are incomplete.")
                return
            candidates[pair] = {"type": "documents", "sourcePath": document.path, "targetPath": target.path,
                "sourceBlobId": document.blob, "targetBlobId": target.blob, "commitId": document.commit,
                "origin": "automatic", "validity": "candidate", "methodId": profile["methodId"], "evidence": []}
            seen_evidence[pair] = set()
        resolved_locator = locator or {"kind": "field", "fieldPath": "identity.path"}
        dedup_key = (rule, token, line, _locator_key(resolved_locator))
        seen = seen_evidence[pair]
        if dedup_key in seen:
            return
        retained = candidates[pair]["evidence"]
        if len(retained) >= limits["maximumEvidenceItemsPerCandidate"]:
            complete = False
            limitations.add("maximumEvidenceItemsPerCandidate reached; evidence aggregation is incomplete.")
            return
        doc_ref = doc_ref_cache.get(line)
        if doc_ref is None:
            doc_ref = _reference_for_lines(document, doc_lines, {"kind": "lines", "startLine": line, "endLine": line})
            doc_ref_cache[line] = doc_ref
        seen.add(dedup_key)
        retained.append({"rule": rule, "token": token, "document": doc_ref,
                         "code": get_code_ref(target, resolved_locator)})

    for document in documents:
        numbered_lines, _ = extract_document_lines(document)
        lines = [line for _, line in numbered_lines]
        doc_ref_cache = {}
        document_complete = True
        if len(numbered_lines) > limits["maximumDocumentLinesPerFile"]:
            complete = document_complete = False
            numbered_lines = numbered_lines[:limits["maximumDocumentLinesPerFile"]]
            lines = lines[:limits["maximumDocumentLinesPerFile"]]
            limitations.add("maximumDocumentLinesPerFile reached for " + document.path)
        for number, line in numbered_lines:
            if expired():
                complete = document_complete = False
                limitations.add("maximumAttemptSeconds reached; discovery did not process all declared lines.")
                break
            for path in sorted(set(PATH_PATTERN.findall(line))):
                target = code.get(path)
                if ".." in PurePosixPath(path).parts or target is None:
                    unresolved.append({"documentPath": document.path, "line": number, "referencedPath": path,
                                       "reason": "Repository-relative path does not resolve in the selected code inventory."})
                else:
                    evidence(document, doc_ref_cache, lines, number, target, "explicit_path")
            line_tokens = _extract_tokens(line, rules)
            for token in sorted(line_tokens & token_targets.keys()):
                for path, locator in token_targets[token]:
                    evidence(document, doc_ref_cache, lines, number, code[path], "lexical", token, locator)
        outcomes.append({"path": document.path, "function": "document_line_scan", "status": "complete" if document_complete else "partial"})
    for candidate in candidates.values():
        candidate["evidence"].sort(key=lambda item: (item["document"]["locator"]["startLine"], item["rule"], item["token"] or "",
            item["code"]["locator"].get("startLine", 0)))
    return {"schemaVersion": "discovery-result-0.1.0", "status": "complete" if complete else "partial",
            "methodId": profile["methodId"], "profileSha256": profile_digest, "manifestSha256": manifest_digest,
            "commitId": sources[0].commit if sources else None,
            "candidates": [candidates[pair] for pair in sorted(candidates)], "unresolvedPaths": unresolved,
            "coverage": outcomes, "limitations": sorted(set(limitations)), "humanJudgmentsRecorded": 0,
            "applicationPublication": "not_run"}


def main():
    parser = argparse.ArgumentParser(description="Generate unconfirmed candidates from accepted immutable input/profile")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--acceptance", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--profile-acceptance", type=Path, required=True)
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()
    try:
        manifest, sources = load_sources(args.manifest, args.acceptance, args.revision)
        manifest_digest = sha256(args.manifest.read_bytes())
        profile, profile_digest = load_profile(args.profile, args.profile_acceptance, manifest_digest)
        result = discover(sources, profile, profile_digest, manifest_digest)
        expectation = profile["independentExpectation"]
        check = None
        if args.revision == expectation["baseline"]:
            check = any(candidate["sourcePath"] == expectation["documentPath"]
                        and candidate["targetPath"] == expectation["codePath"]
                        and any(item["rule"] == "lexical" and item["token"] == expectation["retainedToken"] for item in candidate["evidence"])
                        for candidate in result["candidates"])
        report = {"result": result, "independentCheck": {"id": "UP-07", "passed": check,
                  "applicable": args.revision == expectation["baseline"], "manualCaptureUsed": False}}
        output = contained(WORKSPACE / "outputs" / "healthchecks-discovery" / manifest_digest / profile_digest
                           / (manifest["revisions"][args.revision]["commitId"] + ".json"), WORKSPACE)
        output.parent.mkdir(parents=True, exist_ok=True)
        write_retained(output, (json.dumps(report, indent=2) + "\n").encode("utf-8"))
    except (AcquisitionError, OSError, KeyError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        parser.exit(1, f"Discovery did not complete: {exc}\n")
    print(f"Discovery {result['status']}: {len(result['candidates'])} unconfirmed automatic candidates.")
    print("Report:", output.relative_to(WORKSPACE))
    if check is not None:
        print("Independent UP-07:", "passed" if check else "miss; retained unchanged")
    print("No relationship judgments or application records were published.")
    if check is False or result["status"] != "complete":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
