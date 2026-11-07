---
status: approved
---

# Design brief: Shared Table AR Cards

## The one spatial moment
The player sees seven private AR cards in a gentle arc in front of them and a shared discard pile at the center of a virtual table. They drag a playable card onto the pile; an automated opponent answers with a +4, and four cards visibly join the player's hand, which updates from seven to eleven cards before “YOUR TURN” returns.

## Why it belongs on glasses
- Uses: draws in the world; leaves your body free.
- Why it's better than the phone or laptop version: cards and game effects occupy a shared tabletop space while players keep their eyes up and hands available.

## Product or overlay
- Type: product: the virtual card game is the experience.
- What the real version would sense: shared table placement, multiple players, and private hands visible only to each player.
- Stand-in for the preview: one simulated player and an automated opponent; no real table recognition or multiplayer synchronization is needed for this demo.

## Where things live
- Where the user is looking during the main task: down toward the cards and the center of the virtual table, within the central field of view.
- Player hand: a gentle horizontal arc in the lower-middle foreground, 35–45 cm away; cards are approximately 6 × 9 cm.
- Shared discard pile: centered on the virtual table, 70–90 cm away, with overlapping cards around 10–15% larger than the player's cards.
- Turn indicators and effects: near the discard pile and within the central field of view (default).
- Opponent's +4 cards: animate from the central pile toward the player's hand, then settle into a rearranged arc.
- Visual style: distinctive original card artwork, readable symbols, smooth animations, and a polished holographic appearance. Keep cards and effects integrated with the tabletop scene; avoid a conventional flat card-game interface floating in space.

## Hands and input
- Play a card: mouse-driven pinch-and-drag; hold on a card to lift it, enlarge it, and show a glow, drag it to the discard pile, then release.
- Valid card: snap onto the pile, update game state and hand, and advance the turn.
- Invalid card: return smoothly to its original position without changing game state.
- Wild colour choice: after the player plays a wild card, show a four-section wheel above the discard pile with red, blue, green, and yellow. Select a colour using the mouse, highlight it, set it as active, and dismiss the wheel. The opponent's next turn begins only after a colour is selected.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: none.

## When things show
- Player hand: visible during the player's turn and rearranges when cards are added or removed.
- “Opponent's Turn”: appears for about 1 second after the player's successful play.
- Opponent +4 card: animates onto the discard pile after the turn indicator.
- “+4 DRAW!” and draw counter: appear when the +4 lands; remain during the four-card animation and clear when all four arrive.
- “YOUR TURN”: appears after the draw resolves, with a subtle highlight around the player's hand.
- Wild colour wheel: appears after a wild card is played and stays until the player chooses a colour; do not begin the opponent's turn before that choice.
- If something needs attention out of view: none; keep gameplay elements near the center.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. The player starts with seven clearly visible, readable cards in a gentle arc; cards remain in the central field of view and can be selected individually.
2. Mouse-driven pinch-and-drag plays a valid card onto the central pile, updates the hand, and advances the turn; an invalid card returns to its original position without changing game state.
3. After the player's successful move, the automated opponent plays a +4; the effect is clear and exactly four cards animate into the player's hand. Verify game state separately from animation: the actual hand count changes from 7 to 11.
4. The hand rearranges without overlap or lost cards after the draw; the effect indicator clears, “YOUR TURN” appears, and the player can successfully play another valid card.
5. Playing a wild card opens a four-section wheel with red, blue, green, and yellow; the opponent's turn remains pending until mouse selection highlights a colour, updates the active game colour, and dismisses the wheel.

## Out of scope
- Live multiplayer synchronization for up to four people and player-specific private views; the preview uses a single player and an automated opponent.
- Real-world table recognition and real hand tracking; preview interactions use the mouse.
- Configurable stacking rules for +2/+4 penalties in this first demo (default): the primary flow is the automated opponent's +4 draw and the player's next turn.

## Risks and open questions
- Multiplayer shared state and private hands are part of the longer-term vision but cannot be demonstrated with multiple people in Lens Studio's preview.
- The +4 animation must correspond to an actual four-card increase in game state; decorative cards alone do not satisfy the criterion.
- Feel of real hand tracking and comfort over time remain unproven in preview.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Use distinctive original card artwork, smooth animations, readable symbols, and a polished holographic look; integrate the experience with the tabletop rather than presenting a conventional floating 2D card-game interface.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it

This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
