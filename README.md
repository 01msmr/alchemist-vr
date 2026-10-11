# alchemist-vr

A voxel alchemist game for WebXR on Meta Quest (game jam, theme: Magic). You stand at a table, 1 voxel = 0.75 cm,
and work with controllers (hand tracking works as a fallback, a mouse mode on the desktop). Three experiments:
lead + mercury = amalgam, amalgam + sulfur + heat + stirring = gold, and a ghost caught in a salt ring that brings a straw cat to life.

**Play and screenshots:** the page `about.html` (source in `public/`) is the short project page; the game is `index.html`. The text for the itch.io page (fields, description, controls, cover) is in [docs/itch.md](docs/itch.md).

## Run
```
npm install
npm run dev      # https://localhost:5173/ (use the "Network" URL on the Quest, accept the certificate warning)
npm test         # unit tests of the pure logic
npm run build    # production build into dist/
npm run smoke    # runs the real game headless in Chromium (mouse, simulated controllers; slow; fails on any console error)
```
`?trigger` in the URL shows the raw trigger and grip values on the status panel (for tuning the controllers).

## Play
- **Quest:** open the page, press the VR button. Hold the controllers; the grip button at the shelf takes the tongs or the spoon,
  the trigger closes the tongs (vial, match, gold) or scoops with the spoon (sulfur, herbs, salt), the rod is taken directly.
- **Set the table:** tap the real table's top with the end of a tool, three quick taps at its front edge, then three more farther along
  the edge. The lowest tap sets the height, the two places the front edge. It is remembered. White areas show where a tap does not count.
- **Settings** on the table's right edge (tap): look, background, difficulty. The cord of the lamp: pull to start over, push up for the perfect
  preconditions of the level whose page is open in the book (to try a level without the ones before).
- **Sound:** synthesized in the browser, starts after the first click or the VR session: warning crackle and hiss on a failure, match scratch,
  candle whoosh, the pour, a chime for a finished experiment (a longer one at the end). Not yet tuned on the headset (`HAZARD.sounds`).
- **Desktop:** drag to move things, Shift + drag tilts the vial, Space + drag spills salt, arrow keys turn the book, R starts over.

## Code
`src/main.js` composes the pieces and runs the loop. Rules are in `src/game/` (levels are data in `game/levels/`),
what you see in `src/view/`, what the player can do in `src/runtime/`, and **every tunable number in `src/config/`**.
The decisions, the current state, how to add a level and what is still unverified are in [CLAUDE.md](CLAUDE.md).

## Photo to voxel, 3D model to voxel
```
npm run img2vox -- cutout.png out.vox --height 13 --colors 10 --crop-top 0.155 --stretch 1.2
npm run mesh2vox -- model.glb out.vox --height 21 --colors 24
```
The first makes a hollow voxel shell from a photo of a round object (the mercury vial is made this way), the second voxelizes a `.glb` or `.obj`.

## Deploy
A push to `main` builds and tests on GitHub and updates the `deploy` branch; a webhook makes the web server
(Plesk) pull it. Details in CLAUDE.md.

## Credits
three.js, cannon-es, Vite. Icons: Font Awesome Free (CC BY 4.0). Font: UnifrakturCook (SIL OFL).
