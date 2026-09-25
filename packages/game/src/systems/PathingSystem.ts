import type { GridPoint } from '../iso/IsoMath';
import { NEIGHBOR_OFFSETS, type BuildingSystem } from './BuildingSystem';

interface AStarNode {
    gridX: number;
    gridY: number;
    g: number;
    f: number;
    parent: AStarNode | null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
    // Manhattan distance — matches the 4-directional adjacency below.
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

function cellKey(gridX: number, gridY: number): string {
    return `${gridX},${gridY}`;
}

// Grid A*, querying BuildingSystem.isWalkable() directly rather than
// tracking its own occupancy — see NEIGHBOR_OFFSETS' comment in
// BuildingSystem for why that matters. A linear scan for the lowest-f open
// node (no binary heap) is fine at this map's scale (a few hundred cells).
export class PathingSystem {
    constructor(private readonly buildingSystem: BuildingSystem) {}

    findPath(start: GridPoint, goal: GridPoint): GridPoint[] | null {
        const open = new Map<string, AStarNode>();
        const closed = new Set<string>();

        const startNode: AStarNode = {
            gridX: start.gridX,
            gridY: start.gridY,
            g: 0,
            f: heuristic(start.gridX, start.gridY, goal.gridX, goal.gridY),
            parent: null
        };
        open.set(cellKey(start.gridX, start.gridY), startNode);

        while (open.size > 0) {
            let current: AStarNode | null = null;
            for (const node of open.values()) {
                if (!current || node.f < current.f) {
                    current = node;
                }
            }
            if (!current) {
                break;
            }

            if (current.gridX === goal.gridX && current.gridY === goal.gridY) {
                return this.reconstructPath(current);
            }

            const currentKey = cellKey(current.gridX, current.gridY);
            open.delete(currentKey);
            closed.add(currentKey);

            for (const [dx, dy] of NEIGHBOR_OFFSETS) {
                const nx = current.gridX + dx;
                const ny = current.gridY + dy;
                const key = cellKey(nx, ny);

                if (closed.has(key) || !this.buildingSystem.isWalkable(nx, ny)) {
                    continue;
                }

                const tentativeG = current.g + 1;
                const existing = open.get(key);
                if (!existing || tentativeG < existing.g) {
                    open.set(key, {
                        gridX: nx,
                        gridY: ny,
                        g: tentativeG,
                        f: tentativeG + heuristic(nx, ny, goal.gridX, goal.gridY),
                        parent: current
                    });
                }
            }
        }

        return null;
    }

    private reconstructPath(node: AStarNode): GridPoint[] {
        const path: GridPoint[] = [];
        let current: AStarNode | null = node;
        while (current) {
            path.unshift({ gridX: current.gridX, gridY: current.gridY });
            current = current.parent;
        }
        return path;
    }
}
