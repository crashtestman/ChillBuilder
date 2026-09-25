// 2:1 diamond projection shared by every grid-aligned sprite (ground tiles,
// and later buildings/enemies) so there is exactly one iso <-> world mapping
// to keep depth-sorting and input picking consistent.
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

export interface GridPoint {
    gridX: number;
    gridY: number;
}

export interface WorldPoint {
    x: number;
    y: number;
}

export function gridToWorld(gridX: number, gridY: number): WorldPoint {
    return {
        x: (gridX - gridY) * (TILE_WIDTH / 2),
        y: (gridX + gridY) * (TILE_HEIGHT / 2)
    };
}

export function worldToGrid(x: number, y: number): GridPoint {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    return {
        gridX: (x / halfW + y / halfH) / 2,
        gridY: (y / halfH - x / halfW) / 2
    };
}

// Multiplier leaves room for a per-layer sub-offset (below) without
// renumbering every tile once buildings/enemies land in later milestones.
const DEPTH_MULTIPLIER = 16;

// Layer sub-offsets break ties between things anchored on the same iso
// diagonal (gridX + gridY), e.g. an entity standing on the frontmost corner
// of a building's footprint — see the 2x2-building test in IsoMath.test.ts.
// Later layers always win a tie: an entity in front of/on a building, which
// is in front of/on bare ground.
export const DEPTH_LAYER_GROUND = 0;
export const DEPTH_LAYER_BUILDING = 1;
export const DEPTH_LAYER_ENTITY = 2;

export function tileDepth(gridX: number, gridY: number, subOffset = DEPTH_LAYER_GROUND): number {
    return (gridX + gridY) * DEPTH_MULTIPLIER + subOffset;
}

// Depth for a footprint anchored at its frontmost cell (max gridX, max
// gridY), not its origin — a building's origin cell is not where it visually
// extends furthest toward the camera, so sorting on the origin would let a
// unit standing in front of a multi-tile building draw behind it instead.
export function footprintDepth(
    gridX: number,
    gridY: number,
    width = 1,
    height = 1,
    subOffset = DEPTH_LAYER_BUILDING
): number {
    return tileDepth(gridX + width - 1, gridY + height - 1, subOffset);
}
