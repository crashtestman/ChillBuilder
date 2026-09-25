import { beforeEach, describe, expect, it } from 'vitest';
import type { MapDef } from '../data/mapDefs/slice01';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState } from '../state/GameState';
import { BuildingSystem } from './BuildingSystem';

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

describe('BuildingSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
    });

    it('places a building, deducts its cost, and emits events', () => {
        const system = new BuildingSystem(gameState, eventBus, makeMapDef(5, 5));
        const woodBefore = gameState.resources.wood;

        const resourceEvents: number[] = [];
        eventBus.on('resource:changed', (payload) => resourceEvents.push(payload.amount));
        let placedEvent: unknown;
        eventBus.on('building:placed', (payload) => {
            placedEvent = payload.building;
        });

        const result = system.place('farm', 2, 2);

        expect(result).toEqual({ ok: true });
        expect(gameState.resources.wood).toBe(woodBefore - 10);
        expect(resourceEvents).toEqual([woodBefore - 10]);
        expect(placedEvent).toMatchObject({ defId: 'farm', gridX: 2, gridY: 2 });
        expect(gameState.buildings).toHaveLength(1);
    });

    it('rejects placement onto an already-occupied cell', () => {
        const system = new BuildingSystem(gameState, eventBus, makeMapDef(5, 5));

        expect(system.place('farm', 2, 2)).toEqual({ ok: true });
        expect(system.canPlace('farm', 2, 2)).toEqual({ ok: false, reason: 'occupied' });
    });

    it('rejects placement outside the map bounds', () => {
        const system = new BuildingSystem(gameState, eventBus, makeMapDef(5, 5));

        expect(system.canPlace('farm', 5, 0)).toEqual({ ok: false, reason: 'out-of-bounds' });
        expect(system.canPlace('farm', -1, 0)).toEqual({ ok: false, reason: 'out-of-bounds' });
    });

    it('rejects a multi-cell footprint that would only partially fit', () => {
        const system = new BuildingSystem(gameState, eventBus, makeMapDef(5, 5));

        // House is 2x2; anchored at (4,4) on a 5x5 grid it hangs off the edge.
        expect(system.canPlace('house', 4, 4)).toEqual({ ok: false, reason: 'out-of-bounds' });
    });

    it('rejects placement the player cannot afford', () => {
        gameState.resources.wood = 5;
        const system = new BuildingSystem(gameState, eventBus, makeMapDef(5, 5));

        expect(system.canPlace('farm', 2, 2)).toEqual({ ok: false, reason: 'cannot-afford' });
    });

    it('does not mutate resources or the building list on a rejected placement', () => {
        gameState.resources.wood = 5;
        const system = new BuildingSystem(gameState, eventBus, makeMapDef(5, 5));

        expect(system.place('farm', 2, 2)).toEqual({ ok: false, reason: 'cannot-afford' });
        expect(gameState.resources.wood).toBe(5);
        expect(gameState.buildings).toHaveLength(0);
    });

    it('rejects a placement that would seal off the only path from spawn to the city core', () => {
        // A 5x5 field with spawn/core on the middle row; column x=2 is the
        // only place a wall could seal them apart.
        const mapDef = makeMapDef(5, 5, { gridX: 0, gridY: 2 }, { gridX: 4, gridY: 2 });
        const system = new BuildingSystem(gameState, eventBus, mapDef);

        // Wall off every row of column 2 except the middle (row 2) first —
        // the path through row 2 keeps every one of these legal.
        for (const gridY of [0, 1, 3, 4]) {
            expect(system.place('farm', 2, gridY)).toEqual({ ok: true });
        }

        // The only remaining gap is (2, 2) — sealing it would fully
        // disconnect spawn from the city core, so it must be rejected.
        expect(system.canPlace('farm', 2, 2)).toEqual({ ok: false, reason: 'would-block-path' });

        // A cell that doesn't touch the last gap is still placeable — the
        // rule only blocks the specific placement that would seal the route.
        expect(system.canPlace('farm', 1, 0)).toEqual({ ok: true });
    });

    it('rejects building directly on the spawn or city-core tile', () => {
        const mapDef = makeMapDef(5, 5, { gridX: 0, gridY: 2 }, { gridX: 4, gridY: 2 });
        const system = new BuildingSystem(gameState, eventBus, mapDef);

        expect(system.canPlace('farm', 0, 2)).toEqual({ ok: false, reason: 'would-block-path' });
        expect(system.canPlace('farm', 4, 2)).toEqual({ ok: false, reason: 'would-block-path' });
    });
});
