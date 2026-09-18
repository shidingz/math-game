# Classic browser home — visual QA, 2026-09-18

Reference: https://shidingz.github.io/math-game/?test=1
Implementation: `wechat/browser/`, built locally at http://127.0.0.1:8801/dev/ .

## Evidence

Captured the live reference at 390×744 and 1280×900 before implementation. Compared the same Wukong Lv.1 card after implementation at mobile/desktop widths. Sources and paired images are in ignored local `artifacts/classic-layout-20260918/`: `source-*.png`, `reference-matched-*.png`, `updated-matched-*.png`, `comparison-*.png`. Examined the final custom gray-cat home, equal-height greeting, and full-screen evolution screenshots.

Restored the pale theme background, original card shape/type/spacing, speech bubble, foreground pet, growth strip, and desktop two-column hierarchy. Mobile uses document flow instead of shrinking a whole Canvas to fit the viewport. Corrected inherited fixed-viewport CSS that initially compressed the new scene. The stage camera uses visible sprite bounds and preserves complete wide poses.

Intentional differences: retain photo creation/service links; keep custom naming; no food icon; no expanded developer panel above the pet; use current 200-point unlock and 30/100-question evolution milestones; retain approved sparse themed effects and equal-height greetings. Full bodies are fitted inside the scene, so differently proportioned pets do not all occupy exactly the same width.

## Validation

- 203 unit tests, runtime asset checks, regular build and WeChat export check pass.
- Browser checks at 375, 390 and 1280 widths: 729 pose/stage/pet bounds combinations fit the scene, with no horizontal overflow or page errors.
- Feed/save/reload, custom rename, grade/range selection returning home, quiz answer, photo file selection, connection-dialog cancellation, full-screen evolution, equal-height visitor and formal/test save isolation pass.
- `verification.json`, `final-*.png`, `greeting-*.png`, `upgrade-*.png`, `studio-*.png` document results. Browser tests use isolated storage and existing images; no paid generation calls.
- This is browser emulation, not native WeChat or physical phone verification. Remote generation internals/session formats are unchanged and were not retested with a paid job in this visual change.

final result: passed
