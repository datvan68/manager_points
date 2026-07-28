Task: `browser-injected-hydration-mismatch` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Load `/students/**` without hydration mismatch, `removeChild`, or maximum-update-depth errors by removing DOM injection before React hydrates.

Boundary: frontend runtime and the local browser profile used for reproduction | Write: None; preserve all repository source files

Targets: injected `<head>` node `.simulator-pre-loader.simulator`; Next.js metadata hydration boundary; browser extensions or simulator tooling active in the failing profile

Steps: reproduce the first error in the current profile -> confirm the injected node is absent from server response and source -> disable or exclude the responsible simulator/extension for the application origin -> clear site cache and reproduce in a clean Incognito/Guest profile -> if hydration still fails without injected DOM, capture the exact URL and first application-owned component stack, then amend scope before changing code

Verify: browser, extension-free profile :: open the affected `/students/**` URL, hard reload three times, and navigate away/back => no hydration mismatch, `removeChild`, or maximum-update-depth console errors; `D:\PROJECT\manager_points :: rg -n "simulator-pre-loader" frontend/src` => no application-owned match

Done: The extension-free browser run passes all reload/navigation checks; no source workaround such as broader hydration suppression or manual DOM removal is added.

Gate: None. Stop before editing the currently modified Students files or any application source unless the clean-profile reproduction provides an application-owned stack and the scope is amended.
