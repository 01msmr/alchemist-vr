# alchemist-vr
Voxel alchemist game for WebXR (Meta Quest). See CLAUDE.md for the project notes.

```
npm install
npm run dev   # https://localhost:5173/
npm test
```

```
npm run img2vox -- cutout.png out.vox --height 13   # photo cut-out -> voxel shell, see CLAUDE.md
```

Deploy: a push to main builds on GitHub and updates the deploy branch; Plesk pulls it through a webhook.
Webhook check.
