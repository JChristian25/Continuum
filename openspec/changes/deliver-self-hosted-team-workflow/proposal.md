## Why

A development team needs to identify which documents and decisions to revisit after a code change, record who reviewed the evidence, and retrieve that decision on a later visit. The first developer release targets one team running Continuum on infrastructure it controls. The owner selected self-hosting on 2026-11-20.

## What Changes

- Provide a source-built HTTPS installation with a fresh database, named accounts and operator-managed repository grants.
- Let a developer start with a team repository and resume the last authorized revision on the same browser.
- Qualify import, interrupted processing, revision review, data recovery and upgrades through the normal team workflow.

## Capabilities

### New Capabilities

- `self-hosted-team-workflow` covers first installation, repeat use and recovery.

## Impact

This change covers distribution, operator instructions and the service frontend. It builds on C-03 artifact context, C-05 review decisions and C-08 knowledge access. The user's product instruction authorizes local implementation. Installation on a team's infrastructure and migration of its existing data require that operator's authorization.
