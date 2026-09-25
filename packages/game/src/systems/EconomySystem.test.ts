import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState, type PlacedBuilding } from '../state/GameState';
import { EconomySystem } from './EconomySystem';

function place(gameState: GameState, defId: string, gridX = 0, gridY = 0): PlacedBuilding {
    const building: PlacedBuilding = { id: `${defId}-${gridX}-${gridY}`, defId, gridX, gridY };
    gameState.buildings.push(building);
    return building;
}

describe('EconomySystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;
    let system: EconomySystem;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
        system = new EconomySystem(gameState, eventBus);
    });

    it("accrues a producing building's output over time", () => {
        place(gameState, 'woodcutter');
        const before = gameState.resources.wood;

        system.update(3);

        expect(gameState.resources.wood).toBe(before + 3);
    });

    it('emits resource:changed with the new amount when a resource actually changes', () => {
        place(gameState, 'farm');
        const events: number[] = [];
        eventBus.on('resource:changed', (payload) => events.push(payload.amount));

        system.update(2);

        expect(events).toEqual([gameState.resources.food]);
    });

    it('does not emit for a resource nothing produces or consumes', () => {
        place(gameState, 'farm');
        const goldEvents: number[] = [];
        eventBus.on('resource:changed', (payload) => {
            if (payload.resourceId === 'gold') {
                goldEvents.push(payload.amount);
            }
        });

        system.update(5);

        expect(goldEvents).toEqual([]);
    });

    it('nets multiple buildings touching the same resource into a single change', () => {
        place(gameState, 'woodcutter', 0, 0);
        place(gameState, 'woodcutter', 1, 0);
        const before = gameState.resources.wood;
        const events: number[] = [];
        eventBus.on('resource:changed', (payload) => events.push(payload.amount));

        system.update(1);

        expect(gameState.resources.wood).toBe(before + 2);
        expect(events).toEqual([before + 2]);
    });

    describe('with a consuming building', () => {
        // No shipped BuildingDef consumes anything yet, so register a
        // throwaway one just for this test rather than skipping coverage
        // of the zero-floor clamp.
        beforeEach(() => {
            BUILDINGS['test-sink'] = {
                id: 'test-sink',
                name: 'Test Sink',
                category: 'economy',
                footprint: { width: 1, height: 1 },
                buildCost: {},
                consumes: { wood: 10 }
            };
        });

        afterEach(() => {
            delete BUILDINGS['test-sink'];
        });

        it('never drives a resource below zero', () => {
            gameState.resources.wood = 1;
            place(gameState, 'test-sink');

            system.update(1);

            expect(gameState.resources.wood).toBe(0);
        });

        it('stops emitting once a resource is pinned at zero with no further change', () => {
            gameState.resources.wood = 0;
            place(gameState, 'test-sink');
            const events: number[] = [];
            eventBus.on('resource:changed', (payload) => events.push(payload.amount));

            system.update(1);

            expect(events).toEqual([]);
        });
    });
});
