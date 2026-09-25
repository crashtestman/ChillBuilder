import { describe, expect, it } from 'vitest';
import { DEPTH_LAYER_ENTITY, footprintDepth, gridToWorld, tileDepth, worldToGrid, worldToNearestGrid } from './IsoMath';

describe('gridToWorld / worldToGrid', () => {
    it('projects the origin onto itself', () => {
        expect(gridToWorld(0, 0)).toEqual({ x: 0, y: 0 });
    });

    it('is invertible for arbitrary grid cells', () => {
        for (const [gridX, gridY] of [[0, 0], [3, 0], [0, 5], [4, 4], [-2, 7]]) {
            const world = gridToWorld(gridX, gridY);
            expect(worldToGrid(world.x, world.y)).toEqual({ gridX, gridY });
        }
    });
});

describe('worldToNearestGrid', () => {
    it('snaps a point anywhere inside a tile back to that tile', () => {
        const center = gridToWorld(3, 2);
        for (const [dx, dy] of [[0, 0], [20, -10], [-20, 10], [0, 25]]) {
            expect(worldToNearestGrid(center.x + dx, center.y + dy)).toEqual({ gridX: 3, gridY: 2 });
        }
    });
});

describe('tileDepth', () => {
    it('increases moving away from the origin along either axis', () => {
        expect(tileDepth(1, 0)).toBeGreaterThan(tileDepth(0, 0));
        expect(tileDepth(0, 1)).toBeGreaterThan(tileDepth(0, 0));
    });

    it('treats cells on the same iso diagonal as equal before sub-offsets', () => {
        expect(tileDepth(2, 1)).toBe(tileDepth(1, 2));
    });

    it('lets a sub-offset break ties on the same diagonal', () => {
        expect(tileDepth(1, 1, 1)).toBeGreaterThan(tileDepth(2, 0));
    });
});

// M1 acceptance criterion from the plan: an entity walking a full circuit
// around a 2x2 building must never z-fight or pop through it. Verified here
// as a pure depth-ordering property, without needing real Building/Enemy
// game objects to exist yet.
describe('footprintDepth — 2x2 building depth-sort acceptance criterion', () => {
    const building = footprintDepth(0, 0, 2, 2);

    // Every cell immediately surrounding the building at (0,0)-(1,1).
    const ring: Array<[number, number]> = [
        [-1, -1], [0, -1], [1, -1], [2, -1],
        [-1, 0], [2, 0],
        [-1, 1], [2, 1],
        [-1, 2], [0, 2], [1, 2], [2, 2]
    ];

    it.each(ring)('sorts an entity at (%i, %i) relative to the building correctly', (gridX, gridY) => {
        const entity = tileDepth(gridX, gridY, DEPTH_LAYER_ENTITY);
        const frontmostSum = 1 + 1; // building's front corner is (1, 1)
        const cellSum = gridX + gridY;

        // Strictly behind the front corner -> entity draws behind the
        // building. Level with it or past it -> entity draws in front (ties
        // go to the entity layer by convention).
        if (cellSum < frontmostSum) {
            expect(entity).toBeLessThan(building);
        } else {
            expect(entity).toBeGreaterThan(building);
        }
    });
});
