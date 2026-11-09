# Continuum frontend

The existing React 19 / Vite 8 prototype uses synthetic fixtures and browser storage. See the [repository README](../../README.md), [product reference](../../PRODUCT.md) and [design reference](../../DESIGN.md).

Run from this directory:

```powershell
npm ci
npm run dev
npm run build
npm run lint
node --test src/data/workflow.test.js
```

From the repository root, use `npm --prefix apps/web` for npm commands and `node --test apps/web/src/data/workflow.test.js` for the existing workflow suite. Vite writes build output to this package's `dist/` directory. Application dependencies and both existing lockfiles belong to this package.

Root-level project instructions still apply. Moving the frontend does not implement or connect a backend.
