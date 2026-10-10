# alchemist-vr

A voxel alchemist game for WebXR on Meta Quest (game jam, theme: Magic). You stand at a table, 1 voxel = 1 cm,
and work with your hands (hand tracking) or controllers (fallback): strike a match, light a candle, melt lead,
pour mercury, make amalgam, add sulfur, stir, take out the gold. A desktop mouse mode exists for testing.

## Run
```
npm install
npm run dev      # https://localhost:5173/ (use the "Network" URL on the Quest, accept the certificate warning)
npm test         # unit tests of the pure logic
npm run build    # production build into dist/
npm run smoke    # runs the real game headless in Chromium with scripted mouse input (slow; fails on any console error)
```
On the Quest, enable hand tracking in the headset settings and press the VR button. Stand at a real table, rest a finger
on it and hold a pinch still for a second (not next to an object): the virtual table moves to that height and is remembered.
Pinch the status panel behind the table (or press B / Y, or R on the desktop) to start over.

## Controls
| | Hands | Controllers | Mouse |
|---|---|---|---|
| Hold a tool (vial, rod) | close the fist around it | grip button | drag |
| Hold with two fingers, take a match, a pinch of sulfur, the gold, snuff the candle | pinch | trigger | click |
| Tilt the vial to pour | turn the wrist | turn the wrist | Shift + drag up/down |

## Code
`src/main.js` composes the pieces and runs the loop. Rules are in `src/game/` (levels are data in `game/levels/`),
what you see in `src/view/`, what the player can do in `src/runtime/`, and **every tunable number in `src/config/`**.
The decisions, the current state, how to add a level and what is still unverified are in [CLAUDE.md](CLAUDE.md).

## Photo to voxel
```
npm run img2vox -- cutout.png out.vox --height 13 --colors 10 --crop-top 0.155 --stretch 1.2
```
Takes a transparent-background photo of a round object and makes a hollow voxel shell. The mercury vial is made this way.

## Deploy
A push to `main` builds and tests on GitHub and updates the `deploy` branch; a webhook makes the web server
(Plesk) pull it. Details in CLAUDE.md.
