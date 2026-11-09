# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Authorized reviewers and contributors working through repository changes. Their immediate job is to understand what changed, inspect the evidence behind an affected artifact, and record an accountable judgment or follow-up.

## Product Purpose

Continuum is a synthetic prototype for a knowledge-continuity workflow. It keeps an inspectable chain between repository artifacts, documentation, requirements, decisions, and revision-aware review work.

## Positioning

Rather than treating candidate relationships as confirmed traceability, Continuum keeps evidence, human judgment, rationale, and revision context distinct and inspectable.

## Operating Context

Users switch repository and revision context, review change impacts, inspect evidence, record intent, and revisit current or historical decisions. The prototype uses synthetic repository and activity data.

## Capabilities and Constraints

- The working core is artifact/context capture, inspectable evidence-backed candidates, human decisions and rationale, change-triggered review/revalidation, and current/historical context retrieval.
- Candidate links, graph density, pipeline activity, and health indicators are demonstration data; they do not establish validated production traceability.
- The UI must explain its function, avoid clutter, preserve context, favor fast navigation, and use focused screens with progressive disclosure.

## Brand Commitments

Continuum uses a continuity/infinity identity with a Claude-inspired light interface, warm paper surfaces, and forest-green accents. Preserve focused review tasks and progressive disclosure.

## Evidence on Hand

- Synthetic state and interaction model: `apps/web/src/data/state.js`
- Current web prototype: `apps/web/src/`
- User-supplied visual references for STAR, STRIDE, and the incumbent Continuum implementation.

## Product Principles

- Make the next accountable action obvious.
- Keep a reviewer oriented in repository and revision context.
- Reveal technical detail at the moment it is needed.
- Keep human judgment separate from automated or candidate signals.
- Let each workspace serve one clear job.

## Accessibility & Inclusion

Use readable contrast, keyboard-visible focus, semantic controls, and responsive layouts that do not hide the primary action.

