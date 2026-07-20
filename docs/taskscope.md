Task: profile-menu-pwa-install-visibility | feature_development | Risk: LOW
Objective: Hide the profile-menu PWA install action while the application is installed, and make it available again when opened outside installed mode.
Scope:
- `frontend/src/components/layout/Header.tsx` :: profile-menu PWA action :: derive installed mode from the browser display mode, react to PWA installation, and conditionally render "Mở ứng dụng".
- `docs/taskscope.md` :: current taskscope :: record the visibility behavior and verification.
Out: Changes to PWA prompt handling, ConfirmModal implementation, backend/frontend startup, automatic browser installation, and unrelated files and behavior.
Context: Browsers do not expose an uninstall event; reopening the site after uninstall runs outside standalone mode and restores the action.
Steps:
1. Track installed display mode in Header and update it for installation and display-mode changes.
2. Render the existing confirmed install action only when the app is not installed.
Verify:
- `frontend` :: `npm run build` => Next.js production build succeeds.
- repository root :: `git diff --check` => no whitespace errors.
Done:
- "Mở ứng dụng" is hidden in the installed app, becomes hidden immediately after installation, and is shown again when the site is opened after the app has been removed.
Gate/Stop: None
