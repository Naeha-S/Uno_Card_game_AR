# Shared Table Cards — visual overhaul

## Presentation changes

- Updated the existing scene camera to a tighter field of view and a deep ink clear color.
- Added a subdued central felt play mat with a muted rim, plus individual soft shadow shapes under the player cards, opponent backs, draw deck, and discard card.
- Added visible stacked layers to the existing upright slate-teal draw deck.
- Refined the hand into a centered fan with a quadratic arc and adaptive spacing. Above ten cards, the cards scale down gradually while the hand stays within a fixed width.
- Added a small active-color marker, tightened status labels, and kept Funnel Display on the interface and card text.
- Preserved the existing card colors, slate-teal backs, wild card face, and all game/interaction logic.

## Verification

- TypeScript compilation: **passed**.
- Preview refreshed and started: **passed**, no runtime errors; the seven-card initial hand was reported.
- Preview screenshot: captured at `devpost/shared-table-visual-overhaul.jpg` and inspected. Seven cards remain individually readable, the active color is marked, the central mat and tabletop shadow treatment are visible, and the draw deck has layered edges.
- Eleven-card layout: the adaptive layout formula supports larger hands, but an 11-card preview state was not reached in this pass.
- Interaction retest: blocked because the Preview runtime inspection/interact agent did not respond after reset, so drag behavior could not be exercised from the tool in this pass.
- Background limitation: the preview continues to composite Lens content over its grey simulator environment despite the dark camera clear color and in-scene backdrop. The central felt mat is visible, but the simulator grey field remains around it.
