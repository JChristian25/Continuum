import json
from pathlib import Path

import pytest

from continuum.acquisition import AcquisitionError, sha256
from continuum.discovery import Source, code_index, discover, load_profile, load_sources, tokens
from test_acquisition import inputs, run as acquire_fixture, destination

PROFILE_PATH = Path(__file__).resolve().parents[3] / "openspec/changes/establish-versioned-continuity-core/discovery-profile.proposed.json"


@pytest.fixture
def profile():
    return json.loads(PROFILE_PATH.read_bytes())


def source(path, text, kind="code", commit="1" * 40):
    from continuum.acquisition import blob_sha
    raw = text.encode("utf-8")
    return Source(path, kind, "Python" if kind == "code" else "Markdown", commit, blob_sha(raw), sha256(raw), text)


def result(sources, profile, **kwargs):
    return discover(sources, profile, "synthetic-profile", "synthetic-inventory", **kwargs)


def test_frozen_token_rules_and_identifier_sources(profile):
    assert tokens("HTTPServer_failure_kw this True file abc", profile) == {"http", "server", "failure"}
    code = source("check.py", '# commentOnlyToken\ntext = "stringOnlyToken"\nfailure_kw = True\n')
    index = code_index(code, profile)
    assert "comment" not in index and "string" not in index and "only" not in index
    assert index["failure"] == {"kind": "lines", "startLine": 3, "endLine": 3}
    assert index["check"] == {"kind": "field", "fieldPath": "identity.path"}


def test_automatic_candidates_aggregate_exact_evidence_without_confirmation(profile):
    sources = [source("hc/check.py", "failure_kw = True\n"),
               source("docs/readme.md", "See hc/check.py for failure handling.\nFailure details.\n", "document")]
    output = result(sources, profile)
    assert output["status"] == "complete" and len(output["candidates"]) == 1
    candidate = output["candidates"][0]
    assert candidate["type"] == "documents" and candidate["validity"] == "candidate"
    assert candidate["origin"] == "automatic" and output["humanJudgmentsRecorded"] == 0
    assert {item["rule"] for item in candidate["evidence"]} == {"explicit_path", "lexical"}
    lexical = next(item for item in candidate["evidence"] if item["token"] == "failure")
    assert lexical["document"]["blobId"] == sources[1].blob
    assert lexical["code"]["locator"]["startLine"] == 1
    assert lexical["code"]["excerptSha256"] == sha256(b"failure_kw = True")
    assert result(list(reversed(sources)), profile) == output


def test_ambiguous_token_produces_multiple_unconfirmed_pairs(profile):
    output = result([source("a.py", "failure_kw = 1"), source("b.py", "failure_state = 2"),
                     source("README.md", "Failure details", "document")], profile)
    assert [candidate["targetPath"] for candidate in output["candidates"]] == ["a.py", "b.py"]
    assert all(candidate["validity"] == "candidate" for candidate in output["candidates"])


def test_unresolved_path_and_no_match_are_explicit(profile):
    output = result([source("a.py", "alpha_value = 1"), source("README.md", "See missing.py. unrelated", "document")], profile)
    assert output["status"] == "complete" and output["candidates"] == []
    assert output["unresolvedPaths"][0]["referencedPath"] == "missing.py"
    assert any("not complete" in limitation for limitation in output["limitations"])


@pytest.mark.parametrize("case", ["candidates", "evidence", "lines", "time", "parser"])
def test_limits_and_bad_source_report_incomplete_scope(profile, case):
    sources = [source("a.py", "failure_kw = 1"), source("b.py", "failure_state = 2"),
               source("README.md", "Failure details\nFailure again\n", "document")]
    kwargs = {}
    if case == "candidates":
        profile["limits"]["maximumCandidates"] = 1
    elif case == "evidence":
        profile["limits"]["maximumEvidenceItemsPerCandidate"] = 1
    elif case == "lines":
        profile["limits"]["maximumDocumentLinesPerFile"] = 1
    elif case == "time":
        current = iter(range(10000))
        profile["limits"]["maximumAttemptSeconds"] = 1
        kwargs["clock"] = lambda: next(current)
    else:
        sources[0] = source("a.py", "failure_kw = '''unterminated")
    output = result(sources, profile, **kwargs)
    assert output["status"] == "partial"
    assert output["humanJudgmentsRecorded"] == 0
    assert output["coverage"]


def test_future_revision_mixing_and_oversized_inputs_are_rejected(profile):
    with pytest.raises(AcquisitionError, match="mix selected revisions"):
        result([source("a.py", "pass"), source("README.md", "hello", "document", "2" * 40)], profile)
    profile["limits"]["maximumFileBytes"] = 3
    with pytest.raises(AcquisitionError, match="file byte"):
        result([source("a.py", "pass")], profile)


def test_acquired_sources_recheck_bytes_and_forbid_unknown_revision(inputs):
    acquire_fixture(inputs)
    _, sources = load_sources(inputs["manifest_path"], inputs["acceptance_path"], "base", root=inputs["root"])
    assert sources[0].text.encode() == inputs["content"]
    with pytest.raises(AcquisitionError, match="outside"):
        load_sources(inputs["manifest_path"], inputs["acceptance_path"], "future", root=inputs["root"])
    (destination(inputs) / "objects" / inputs["blob"]).write_bytes(b"x" * len(inputs["content"]))
    with pytest.raises(AcquisitionError, match="source bytes"):
        load_sources(inputs["manifest_path"], inputs["acceptance_path"], "base", root=inputs["root"])


def test_profile_acceptance_is_bound_to_exact_bytes_and_inventory(inputs, profile):
    profile["manifestSha256"] = inputs["acceptance"]["manifestSha256"]
    path = inputs["root"] / "profile.json"
    path.write_text(json.dumps(profile))
    acceptance_path = inputs["root"] / "discovery-acceptance.json"
    acceptance = {"schemaVersion": "discovery-acceptance-0.1.0", "profileSha256": sha256(path.read_bytes()),
                  "profileId": profile["id"], "manifestSha256": profile["manifestSha256"], "methodId": profile["methodId"]}
    acceptance_path.write_text(json.dumps(acceptance))
    assert load_profile(path, acceptance_path, profile["manifestSha256"], root=inputs["root"])[0] == profile
    path.write_text(json.dumps({**profile, "id": "changed"}))
    with pytest.raises(AcquisitionError, match="acceptance"):
        load_profile(path, acceptance_path, profile["manifestSha256"], root=inputs["root"])
