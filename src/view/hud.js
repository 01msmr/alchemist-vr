import * as THREE from 'three';
import { CFG, LAYOUT, VIEW } from '../config/index.js';

// The status text. On the desktop it is a text block in the corner; in the headset the only readable thing is
// a panel behind the table. The panel is also the "pinch here to reset" target.
export function createHud(view) {
  const { world, renderer } = view;
  const p = VIEW.panel;
  const dom = document.getElementById('hud');

  const canvas = document.createElement('canvas');
  canvas.width = p.canvasWidth;
  canvas.height = p.canvasHeight;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(LAYOUT.statusPanel.width, LAYOUT.statusPanel.height), new THREE.MeshBasicMaterial({ map: texture }));
  panel.position.set(0, LAYOUT.statusPanel.y, LAYOUT.tableBounds.minZ + LAYOUT.statusPanel.fromBack);
  panel.visible = false;
  world.add(panel);
  renderer.xr.addEventListener('sessionstart', () => { panel.visible = true; });
  renderer.xr.addEventListener('sessionend', () => { panel.visible = false; });

  let drawnAt = 0;
  const colors = { background: VIEW.themes.dark.panelBackground, text: VIEW.themes.dark.panelText };
  function draw(lines) {
    const g = canvas.getContext('2d');
    g.fillStyle = colors.background;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = colors.text;
    g.font = p.font;
    lines.forEach((line, i) => g.fillText(line, 16, 38 + i * p.lineHeight));
    texture.needsUpdate = true;
  }

  const help = [
    'matchbox: click for a match, rub it fast over the striker | light candle: lit match at the wick | snuff: click candle',
    'tools: drag with left mouse (vial: Shift + drag up/down tilts) | level 2: click the dish for sulfur, stir with the rod, click the finished gold | reset: R',
    'VR (hands or controllers): closed fist / grip button = full hand (tool), pinch / trigger = two fingers (tool, match, sulfur, gold, wick), pinch the panel / B or Y = reset',
  ];

  return {
    panel,
    // the panel's colors for a theme; redrawn at the next update
    setTheme(theme) {
      colors.background = theme.panelBackground;
      colors.text = theme.panelText;
      drawnAt = 0;
      dom.style.color = theme.pageText;
      document.body.style.background = theme.page;
    },
    // lines: the status lines; time: seconds (the panel is redrawn a few times a second)
    update(lines, time) {
      if (renderer.xr.isPresenting) {
        if (time - drawnAt > 0.25) {
          drawnAt = time;
          draw([...lines, 'pinch this panel to reset']);
        }
      } else {
        dom.textContent = `${help.join('\n')}\n${lines.join('\n')}`;
      }
    },
  };
}

// The status lines: the generic ones, the level's own, the heat, and the fingers as the game sees them
// (mode, pinch, grip) for tuning the recognition on the headset.
export function statusLines(state, level, hands, puddleTotal, tableLine) {
  const c = state.crucible;
  const m = state.match;
  const matchText = m ? `  in hand: ${m.broken ? 'head broke off' : m.lit > 0 ? `lit ${m.lit.toFixed(1)}s` : 'unlit'}` : '';
  return [
    `level ${state.level}  candle ${state.candleLit ? 'LIT' : 'out'}  matches ${state.matches}${matchText}`,
    ...level.status(state, { puddleTotal }),
    `temp ${c.temp.toFixed(2)} (melt ${CFG.MELT} / burn ${CFG.BURN})${c.quality !== null ? `  quality ${c.quality.toFixed(2)}` : ''}`,
    hands.map((h) => `${h.handedness[0].toUpperCase()}:${h.mode} p${h.pinch.toFixed(2)} g${h.squeeze.toFixed(2)}`).join('   '),
    tableLine,
  ];
}
