import { BUILDINGS, type BuildingDef } from '../data/buildings';
import type { MapDef } from '../data/mapDefs/slice01';
import type { GridPoint } from '../iso/IsoMath';
import type { EventBus } from '../state/EventBus';
import type { GameState, PlacedBuilding } from '../state/GameState';

export type PlacementFailureReason =
    | 'unknown-building'
    | 'out-of-bounds'
    | 'blocked'
    | 'occupied'
    | 'cannot-afford'
    | 'would-block-path';

export type PlacementCheck = { ok: true } | { ok: false; reason: PlacementFailureReason };

// Shared with PathingSystem (M7) so A* walks the exact same adjacency the
// wall-off guarantee below was checked against — a stricter or different
// adjacency there would make "a path still exists" a lie enemies could
// stall on.
export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];

let nextBuildingId = 1;

function cellKey(gridX: number, gridY: number): string {
    return `${gridX},${gridY}`;
}

export class BuildingSystem {
    // The occupancy grid the plan calls for: which cells are covered by a
    // placed building, keyed separately from GameState.buildings (the list
    // other systems/UI iterate) since this is BuildingSystem's own lookup
    // structure for placement checks.
    private readonly occupied = new Map<string, string>();

    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus,
        private readonly mapDef: MapDef
    ) {
        for (const building of gameState.buildings) {
            const def = BUILDINGS[building.defId];
            if (!def) {
                continue;
            }
            for (const cell of this.footprintCells(def, building.gridX, building.gridY)) {
                this.occupied.set(cellKey(cell.gridX, cell.gridY), building.id);
            }
        }
    }

    footprintCells(def: BuildingDef, gridX: number, gridY: number): GridPoint[] {
        const cells: GridPoint[] = [];
        for (let dy = 0; dy < def.footprint.height; dy++) {
            for (let dx = 0; dx < def.footprint.width; dx++) {
                cells.push({ gridX: gridX + dx, gridY: gridY + dy });
            }
        }
        return cells;
    }

    canPlace(defId: string, gridX: number, gridY: number): PlacementCheck {
        const def = BUILDINGS[defId];
        if (!def) {
            return { ok: false, reason: 'unknown-building' };
        }

        const cells = this.footprintCells(def, gridX, gridY);

        for (const cell of cells) {
            if (!this.isInBounds(cell.gridX, cell.gridY)) {
                return { ok: false, reason: 'out-of-bounds' };
            }
            if (this.mapDef.blocked[cell.gridY][cell.gridX]) {
                return { ok: false, reason: 'blocked' };
            }
            if (this.occupied.has(cellKey(cell.gridX, cell.gridY))) {
                return { ok: false, reason: 'occupied' };
            }
        }

        if (!this.canAfford(def)) {
            return { ok: false, reason: 'cannot-afford' };
        }

        if (!this.pathSurvivesPlacement(cells)) {
            return { ok: false, reason: 'would-block-path' };
        }

        return { ok: true };
    }

    place(defId: string, gridX: number, gridY: number): PlacementCheck {
        const check = this.canPlace(defId, gridX, gridY);
        if (!check.ok) {
            return check;
        }

        const def = BUILDINGS[defId];

        for (const [resourceId, cost] of Object.entries(def.buildCost)) {
            this.gameState.resources[resourceId] -= cost;
            this.eventBus.emit('resource:changed', {
                resourceId,
                amount: this.gameState.resources[resourceId]
            });
        }

        const building: PlacedBuilding = { id: `b${nextBuildingId++}`, defId, gridX, gridY };
        this.gameState.buildings.push(building);
        for (const cell of this.footprintCells(def, gridX, gridY)) {
            this.occupied.set(cellKey(cell.gridX, cell.gridY), building.id);
        }

        this.eventBus.emit('building:placed', { building });
        return { ok: true };
    }

    private isInBounds(gridX: number, gridY: number): boolean {
        return gridX >= 0 && gridY >= 0 && gridX < this.mapDef.cols && gridY < this.mapDef.rows;
    }

    // The single definition of "walkable" — in bounds, not map-blocked, not
    // covered by a building. PathingSystem (M7) queries this directly
    // rather than keeping its own occupancy tracking, so enemy pathing can
    // never disagree with what the wall-off guarantee below already
    // verified was reachable.
    isWalkable(gridX: number, gridY: number): boolean {
        if (!this.isInBounds(gridX, gridY)) {
            return false;
        }
        if (this.mapDef.blocked[gridY][gridX]) {
            return false;
        }
        return !this.occupied.has(cellKey(gridX, gridY));
    }

    canAfford(def: BuildingDef): boolean {
        return Object.entries(def.buildCost).every(
            ([resourceId, cost]) => (this.gameState.resources[resourceId] ?? 0) >= cost
        );
    }

    // Named risk in the plan: full-grid pathing means a player could seal
    // the spawn -> city-core route entirely. Rejecting any placement that
    // would do so is the chosen fix — checked here, before the placement is
    // ever committed, rather than left for enemies to somehow resolve later.
    private pathSurvivesPlacement(newlyOccupied: readonly GridPoint[]): boolean {
        const extra = new Set(newlyOccupied.map((cell) => cellKey(cell.gridX, cell.gridY)));
        const isWalkableWithExtra = (gridX: number, gridY: number): boolean =>
            this.isWalkable(gridX, gridY) && !extra.has(cellKey(gridX, gridY));

        const { spawn, cityCore } = this.mapDef;
        if (!isWalkableWithExtra(spawn.gridX, spawn.gridY) || !isWalkableWithExtra(cityCore.gridX, cityCore.gridY)) {
            return false;
        }

        const queue: Array<[number, number]> = [[spawn.gridX, spawn.gridY]];
        const visited = new Set<string>([cellKey(spawn.gridX, spawn.gridY)]);

        while (queue.length > 0) {
            const [gridX, gridY] = queue.shift()!;
            if (gridX === cityCore.gridX && gridY === cityCore.gridY) {
                return true;
            }

            for (const [dx, dy] of NEIGHBOR_OFFSETS) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                const key = cellKey(nx, ny);
                if (!visited.has(key) && isWalkableWithExtra(nx, ny)) {
                    visited.add(key);
                    queue.push([nx, ny]);
                }
            }
        }

        return false;
    }
}
