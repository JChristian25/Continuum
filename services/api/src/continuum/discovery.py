"""Deterministic file-scope candidate generation; results never imply confirmation."""

from dataclasses import dataclass
import argparse
import io
import json
from pathlib import Path, PurePosixPath
import re
import time
import tokenize

from .acquisition import AcquisitionError, WORKSPACE, blob_sha, contained, load_accepted, require, sha256, write_retained

PATH_PATTERN = re.compile(r"(?<![A-Za-z0-9_./-])(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.py(?=$|[^A-Za-z0-9_./-]|\.(?:\s|$))")


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


def load_sources(manifest_path, acceptance_path, revision_label, *, root=WORKSPACE):
    manifest, _, manifest_digest, acceptance_digest, blobs = load_accepted(manifest_path, acceptance_path, root)
    require(revision_label in manifest["revisions"], "Revision is outside the accepted inventory")
    destination = contained(root / "inputs" / "healthchecks" / manifest_digest, root)
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


def code_index(source, profile, expired=lambda: False, *, _rules=None):
    rules = _rules or _compile_rules(profile)
    index = {}
    for item in tokenize.generate_tokens(io.StringIO(source.text).readline):
        if expired():
            raise TimeoutError("Identifier indexing reached maximumAttemptSeconds")
        if item.type != tokenize.NAME or item.string in rules.reserved_words:
            continue
        for token in _extract_tokens(item.string, rules):
            index.setdefault(token, {"kind": "lines", "startLine": item.start[0], "endLine": item.end[0]})
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
        lines = document.text.splitlines()
        doc_ref_cache = {}
        document_complete = True
        if len(lines) > limits["maximumDocumentLinesPerFile"]:
            complete = document_complete = False
            lines = lines[:limits["maximumDocumentLinesPerFile"]]
            limitations.add("maximumDocumentLinesPerFile reached for " + document.path)
        for number, line in enumerate(lines, 1):
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
