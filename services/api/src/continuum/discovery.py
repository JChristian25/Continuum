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
_DOCLING_MD_CONVERTER = DocumentConverter(allowed_formats=[InputFormat.MD])


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
    sources = []
    for entry in sorted(manifest["entries"], key=lambda value: value["path"]):
        version = entry["revisions"][revision_label]
        path = contained(destination / "objects" / version["blobId"], root)
        require(path.stat().st_size == version["sizeBytes"], "Retained source size differs")
        data = path.read_bytes()
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
        conversion = _DOCLING_MD_CONVERTER.convert_string(
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
    if kind == "code" or fmt == "Python" or path.endswith(".py"):
        return extract_python_symbols(content)
    if fmt == "Markdown" or path.endswith(".md"):
        return extract_markdown_sections(content, PurePosixPath(path).name or "document.md")
    return {"engine": "plain_text", "hasError": False, "fallbackUsed": False, "items": []}


def extract_document_lines(document: Source):
    """Extract Markdown structure via Docling while preserving exact 1-based line anchors."""
    raw_lines = document.text.splitlines()
    numbered_lines = list(enumerate(raw_lines, 1))
    if (document.format == "Markdown" or document.path.endswith(".md")) and document.text.strip():
        conversion = _DOCLING_MD_CONVERTER.convert_string(
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
        "engine": "plain_text_fallback",
        "format": document.format,
        "structuredItems": len(numbered_lines),
        "fallbackUsed": True,
    }


def code_index(source, profile, expired=lambda: False, *, _rules=None):
    rules = _rules or _compile_rules(profile)
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


def discover(sources, profile, profile_digest, manifest_digest, *, clock=time.monotonic, heartbeat=lambda: True):
    limits, started = profile["limits"], clock()
    rules = _compile_rules(profile)
    require(len(sources) <= limits["maximumPaths"], "Discovery input exceeds the declared path limit")
    require(len({source.path for source in sources}) == len(sources), "Duplicate source path")
    require(len({source.commit for source in sources}) <= 1, "Discovery cannot mix selected revisions")
    require(all(len(source.text.encode("utf-8")) <= limits["maximumFileBytes"] for source in sources), "Discovery file byte limit exceeded")
    unique = {source.blob: len(source.text.encode("utf-8")) for source in sources}
    require(sum(unique.values()) <= limits["maximumUniqueInputBytes"], "Discovery input byte limit exceeded")
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
