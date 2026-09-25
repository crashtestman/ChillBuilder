import { beforeEach, describe, expect, it } from 'vitest';
import type { MapDef } from '../data/mapDefs/slice01';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState } from '../state/GameState';
import { BuildingSystem } from './BuildingSystem';
import { PathingSystem } from './PathingSystem';

function makeMapDef(cols: number, rows: number, spawn = { gridX: 0, gridY: 0 }, cityCore = { gridX: cols - 1, gridY: rows - 1 }): MapDef {
    return {
        id: 'test',
        cols,
        rows,
        blocked: Array.from({ length: rows }, () => Array<boolean>(cols).fill(false)),
        spawn,
        cityCore
    };
}

function isAdjacent(a: { gridX: number; gridY: number }, b: { gridX: number; gridY: number }): boolean {
    const dx = Math.abs(a.gridX - b.gridX);
    const dy = Math.abs(a.gridY - b.gridY);
    return dx + dy === 1;
}

describe('PathingSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
    });

    it('finds a straight-line path on an open grid, start to goal inclusive', () => {
        const mapDef = makeMapDef(5, 5, { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 });
        const buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);

        const path = pathing.findPath(mapDef.spawn, mapDef.cityCore);

        expect(path).not.toBeNull();
        expect(path![0]).toEqual({ gridX: 0, gridY: 0 });
        expect(path![path!.length - 1]).toEqual({ gridX: 4, gridY: 0 });
        expect(path!.length).toBe(5); // Manhattan distance 4 + the start cell
    });

    it('every step of the path is 4-directionally adjacent to the last', () => {
        const mapDef = makeMapDef(6, 6);
        const buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);

        const path = pathing.findPath(mapDef.spawn, mapDef.cityCore)!;

        for (let i = 1; i < path.length; i++) {
            expect(isAdjacent(path[i - 1], path[i])).toBe(true);
        }
    });

    it('routes around a placed building rather than through it', () => {
        const mapDef = makeMapDef(5, 5, { gridX: 0, gridY: 2 }, { gridX: 4, gridY: 2 });
        const buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);

        buildingSystem.place('farm', 2, 2); // sits directly on the straight-line route

        const path = pathing.findPath(mapDef.spawn, mapDef.cityCore)!;

        expect(path).not.toBeNull();
        expect(path.some((cell) => cell.gridX === 2 && cell.gridY === 2)).toBe(false);
    });

    it('agrees with BuildingSystem: whenever placement says a path survives, A* actually finds one', () => {
        // Same maze as BuildingSystem's wall-off test: wall column x=2 on a
        // 5x5 field except the middle gap, which BuildingSystem's own rule
        // guarantees stays open.
        const mapDef = makeMapDef(5, 5, { gridX: 0, gridY: 2 }, { gridX: 4, gridY: 2 });
        const buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);

        for (const gridY of [0, 1, 3, 4]) {
            expect(buildingSystem.place('farm', 2, gridY)).toEqual({ ok: true });
        }

        const path = pathing.findPath(mapDef.spawn, mapDef.cityCore);

        expect(path).not.toBeNull();
        expect(path!.some((cell) => cell.gridX === 2 && cell.gridY === 2)).toBe(true);
    });

    it('returns null when no path exists', () => {
        const mapDef = makeMapDef(3, 3, { gridX: 0, gridY: 1 }, { gridX: 2, gridY: 1 });
        mapDef.blocked[0][1] = true;
        mapDef.blocked[1][1] = true;
        mapDef.blocked[2][1] = true;
        const buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);

        expect(pathing.findPath(mapDef.spawn, mapDef.cityCore)).toBeNull();
    });
});
