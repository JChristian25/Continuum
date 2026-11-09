# Continuum design system

## Direction
Claude-inspired light workspace: warm paper surfaces, quiet navigation, serif headings, and forest-green actions. The product remains a repository review tool; evidence and human judgment remain distinct.

## Foundations
- Canvas #faf9f5; sidebar #eeede6; cards #fffefa; ink #292e28.
- Forest green #346746 for primary actions, active navigation, and focus; pale green #e9f0e5 for supporting surfaces.
- DM Sans for interface text, Georgia for editorial headings, JetBrains Mono only for code and identifiers.
- A collapsible 256px sidebar and centered 860px home content; technical modules retain their task-specific layouts.
- Borders define input and review surfaces. Shadows are reserved for floating panels.

## Interaction and motion
- Home leads with the current change and Continue review. Search and exploration remain secondary.
- Motion for React (`motion/react`) animates module entry, the shared navigation highlight, the inspector, and context disclosure.
- Global MotionConfig honors reduced-motion preferences; height disclosures disable animation when requested.
- Sidebar collapses to icons on desktop and a compact header on mobile. Mobile navigation scrolls horizontally.
- Existing evidence, revision, persona, search, intent, and judgment controls retain their behavior.

## Implementation
`apps/web/src/redesign.css` owns the visual layer over existing module styles. Light mode is the initial appearance. Synthetic/demo provenance is visible on home and assistant screens.
