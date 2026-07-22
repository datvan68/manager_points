Task: prevent-stale-next-chunks | bug_fix | Risk: medium | Profile: Quick
Objective: Prevent the PWA service worker from serving stale Next.js client chunks while preserving offline fallback and icon caching.
Boundary: `frontend/**` | Write: `frontend/public/sw.js`, `docs/taskscope.md`
Targets: cache version, activation cleanup, and fetch routing in `frontend/public/sw.js`
Steps: Confirm stale chunk caching root cause -> bump the application cache version -> stop intercepting `/_next/static/*` so Next.js/browser cache headers control bundles -> retain cache-first behavior for icons and network-first navigation fallback -> verify service-worker syntax, focused PWA tests, production build, and final diff.
Verify: `frontend` :: `node --check public/sw.js` => service-worker syntax is valid; `frontend` :: `npm test -- src/components/pwa/PwaInstallPrompt.test.tsx` => focused tests pass; `frontend` :: `npm run build` => production build and its TypeScript phase succeed; repository root :: `git diff --check` => no whitespace errors.
Done: The service worker no longer responds to Next.js static chunk requests; activating the new worker deletes the previous `hssv-pwa-*` cache version; offline navigation and icon caching remain functional; required checks pass without unrelated changes.
Gate: None
