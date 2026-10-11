# itch.io project page: Alchemist VR

Copy the sections below into the itch.io project editor. The images are in `public/media/` (upload them as screenshots); the cover is `docs/itch-cover.png`.

## Fields

| Field | Value |
|---|---|
| Title | Alchemist VR |
| Short description | Make gold, catch a ghost, wake a cat. A voxel alchemist for Meta Quest (WebXR). |
| Classification | Games |
| Kind of project | HTML (or "Downloadable" with a text file that links to the game, see "Play in VR" below) |
| Genre | Puzzle |
| Tags | VR, WebXR, voxel, alchemy, magic, meta-quest, atmospheric, puzzle, game-jam, three-js |
| Inputs | Meta Quest controllers (hand tracking works as a fallback), mouse |
| Made with | three.js |
| Cover image | `docs/itch-cover.png` (630 x 500) |
| Screenshots | `public/media/the-end.png` (the success screen), `public/media/table.png`, `public/media/cat-alive.png` |
| Link to play | https://alchemist.msmr.co (project page: https://alchemist.msmr.co/about.html) |
| Source | https://github.com/01msmr/alchemist-vr |

## Description (paste this)

**Alchemist VR** is a voxel alchemist's workshop in virtual reality, made for a game jam (theme: *Magic*).
You stand at a real table with a virtual one on top of it: a candle, a crucible, a shelf of tools and an old, thick book of instructions with a wax seal.
Three experiments, one after the other:

1. **Lead and mercury.** Strike a match, light the candle, melt the lead and pour the mercury into the green window. Too hot, too long, and it burns.
2. **The gold.** Add sulfur with the long spoon, keep it hot, stir with the rod, take the gold out with the tongs.
3. **The ghost and the cat.** Burn herbs for smoke, draw a closed ring of salt around the gold, catch the ghost with the upside-down vial, give the straw cat its golden eyes and let the ghost in. The cat comes to life, voxel by voxel.

Everything is made of voxels (1 voxel = 0.75 cm), the book is written in German Fraktur, and the table is oak.

### Play in VR (Meta Quest)

Open **https://alchemist.msmr.co** in the Quest browser and press the VR button. The browser window on this page may not allow VR, so use the link.
No headset? It also runs on the desktop with the mouse.

### How to play

- **Set your table.** Tap the real table's top with the end of a tool, three quick taps at its front edge, then three more farther along the edge. The game remembers it. If a tap does not count, a second try shows white areas where it is too close to an object.
- **Take your tools from the shelf.** The grip button at a compartment takes the tongs or the spoon (or puts them back). The trigger closes the tongs (vial, match, gold) or scoops with the spoon (sulfur, herbs, salt). The stirring rod is taken directly with the trigger.
- **Follow the book.** It turns to the page of the current experiment; tap its lower corners to turn it yourself. A symbol over the next thing you need shows when you are stuck.
- **Settings** are buttons set into the table's right edge: dark or light look, the background, three difficulty levels. Pull the cord of the lamp to start over.

| | Controllers | Desktop |
|---|---|---|
| Take a hand tool | grip button at the shelf | - |
| Hold the vial, take a match or the gold | trigger, with the tongs | drag / click |
| Scoop sulfur, herbs, salt | trigger at the dish, with the spoon | click the dish |
| Pour | tilt the vial | Shift + drag up/down |
| Turn the book | tap its lower corners | arrow keys |
| Start over | pull the cord | R |

### Notes

- Made in a few days for the jam. The feel of the controllers (grip, tap thresholds, reach) and the difficulty numbers were tuned in simulation and are still being adjusted on the headset.
- Sound is synthesized in the browser (no files): a crackle and hiss when an experiment goes wrong, the match scratch and candle whoosh, the pour, and a chime when an experiment is done (a longer one at the end). Not yet tuned on the headset.

### Credits

three.js, cannon-es, Vite. Icons: Font Awesome Free (CC BY 4.0). Font: UnifrakturCook (SIL OFL).
