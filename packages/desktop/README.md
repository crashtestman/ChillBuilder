# @chillbuilder/desktop (stub)

Electron wrapper for Steam/desktop distribution, added in the post-vertical-slice milestone (M11). Wraps the production build of `packages/game` — no gameplay code lives here. Steam distribution does not require Steamworks SDK integration (only achievements/cloud saves/overlay do), so this can ship without `steamworks.js` if desired.
