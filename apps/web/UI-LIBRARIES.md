# Frontend component libraries

The user authorized replacing hand-built frontend controls with Radix, shadcn/ui and Base UI on 2026-11-13. The migration keeps the existing Continuum palette, screen layouts and application state contracts. `PRODUCT.md` and `DESIGN.md` remain unchanged.

## Component ownership

| Surface | Implementation |
| --- | --- |
| Shared controls and styling | Existing local shadcn-style source components in `src/components/ui/`, using CVA, Radix Slot and `cn` |
| Dialogs, selects, checkboxes and buttons | Base UI primitives behind those local components |
| Workspace, persona and code-viewer menus | Base UI Menu |
| Tabs and tooltips | Radix primitives |
| Demo command search | Existing cmdk, now inside the shared dialog |
| Demo notifications | Existing Sonner |
| Inputs, textareas, cards and badges | Local shadcn-style source components with Continuum classes |

These are editable local component sources, rather than an installed package named `shadcn/ui`. Their styles remain in the existing CSS system. This change does not run the shadcn generator or replace the project's stylesheet with a preset.

Base UI owns both dialogs and nested selectors/menus, so nested focus and Escape handling share one popup system. The application Escape shortcuts defer to active library popups. Tooltips keep the same trigger mounted when disabled. The command input lets the dialog move focus rather than using a competing `autoFocus`.

`Select` retains the existing option-based JSX and value-only `onChange` call sites; Base UI owns selection, keyboard navigation, popup positioning and form behavior. The adapter supplies `target.value` and `currentTarget.value`, not a full DOM change event. `Checkbox` similarly supplies `target.checked`. The existing callers only read these fields. Plain action buttons use the shared Button's `unstyled` variant to retain their existing classes. Form submission actions have explicit `type="submit"`.

## Verification

From the repository root:

```powershell
npm --prefix apps/web run build
npm --prefix apps/web run lint
node --test apps/web/src/data/workflow.test.js apps/web/src/data/service.test.js
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5175
# In another terminal, with that Vite server running:
node apps/web/tests/ui-library-browser.mjs
```

Set `CONTINUUM_WEB_URL` to use another already-running frontend URL. The browser suite uses an isolated Chromium context and synthetic demo data. It checks entry, explicit form submission, menu focus return, selector keyboard navigation, nested Escape, checkbox state, dialog focus containment, outside dismissal, command search, tabs, Sonner notifications, the code viewer, follow-up submission and mobile bounds. Screenshots are saved under `outputs/ui-library/`.

Observed build, all 11 workflow/service unit tests, and the Chromium browser suite pass. Desktop and mobile screenshots were inspected. Lint exits successfully with the pre-existing `set-state-in-effect` warning in `DemoContinuumProvider.jsx`. The mechanical design detector returned an empty findings array. The production build still reports large chunks in the existing graph/code-highlighting stack.

The authenticated service browser test was updated for comboboxes and tabs but was not rerun against a backend in this migration. Source changes on the service screens do not establish live service verification. No backend was started, no database migration or deployment was performed, and no additional repositories were acquired. Existing dependency edits present at the start of this task were preserved; this migration added no packages.

## Future additions

### Development-server regression

The existing server on port 5173 initially rendered a blank page after this migration. Browser inspection reproduced `Invalid hook call` and a null `useRef` dispatcher inside Base UI Button. Its optimized modules loaded two different React chunks even though `npm ls` showed one installed React version. `vite.config.js` now deduplicates React/React DOM and explicitly prebundles the UI primitive entry points together. After the configuration reload, both service and demo sign-in screens rendered on that same server with no runtime errors, and the full UI browser suite passed against `http://localhost:5173`. The suite now checks the default service entry as well as the demo. This verifies entry rendering, not an authenticated backend workflow.

Use the shared components before adding new primitives. Keep the same primitive family within a nested popup interaction. The other supplied libraries remain options for a concrete requirement; this migration does not add decorative effects, animated counters or an extra drawer system.

References: [shadcn/ui](https://ui.shadcn.com/docs), [Base UI](https://base-ui.com/react/overview/quick-start), [Radix](https://www.radix-ui.com/primitives/docs/overview/introduction), and the user's [pick-ui-library guidance](https://github.com/emilkowalski/skills/blob/main/skills/pick-ui-library/SKILL.md).


## Live service interface repair, 2026-11-13

The user's authenticated-service screenshots exposed a gap in the earlier migration checks: entry rendering and the demo journey did not verify the service workspaces. The visual reference supplied for this repair is `C:\Users\JC Linaban\Downloads\Continuum Prototype Screenshots _ Group 12-1.pdf`, SHA-256 `46a6cf08269ad29ea6b8b80e4381fb0e5b4924f12c84011d78db8d3ba0d7ffd6`. The current frontend screenshots on pages 4–8 informed spacing, hierarchy and source inspection; the early concepts marked OLD are not the target.

Observed defects included `.service-dialog` overriding the library's fixed positioning with `position: relative`, code readers inheriting dark body text on dark surfaces, large repeated limitation notices ahead of evidence, oversized file/relationship cards, and repeated full-width context controls. An empty error paragraph also painted a red strip in the record dialog.

The repair is confined to presentation and read-only navigation in `ServiceApp.jsx`, `service.css`, and the optional compact mode in `TraceabilityFlow.jsx`. It adds compact relationship rows and filters, a file list beside a readable source reader, grouped coverage rows, consistent page/context headers, a source-first inspector, and centered search/record dialogs. All limitation text and version identities remain inspectable through disclosures. Files open their first captured artifact automatically; selecting the already-open file preserves its loaded source. Search results close the search dialog when opening relationship context. Home shortcuts include only open review contexts. The command, authority, snapshot and judgment contracts remain unchanged. The selected source content is displayed verbatim; no unsupported research metrics or demo results were introduced into service data.

Verification:

- `node --test apps/web/src/data/workflow.test.js apps/web/src/data/service.test.js`: all 11 tests pass.
- `node apps/web/tests/service-layout-browser.mjs`: service components render with an explicitly synthetic context, with checks for queue density, source contrast, review controls, dialogs after scrolling, selection dismissal, files, coverage, graph, summary, and desktop/mobile bounds. No backend writes are made.
- `CONTINUUM_WEB_URL=http://localhost:5173 node apps/web/tests/ui-library-browser.mjs` (set the environment variable using the host shell): default entry and the existing demo journey pass with no runtime errors.
- Build passes. Lint exits successfully with the existing demo-provider warning; the existing large-chunk build warning remains. The mechanical design detector returned no findings.
- Screenshots for the service fixture were visually inspected under `outputs/ui-repair/`. The fixture is at `/tests/service-layout.html` on Vite only and is not imported by the production entry point.

The current signed-in browser could not be attached through the available computer-use host. These checks establish the service components' rendered layout with synthetic data; they do not establish a rerun of the authenticated backend workflow or approval of the new appearance by the owner.
