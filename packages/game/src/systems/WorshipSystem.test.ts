import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState, type PlacedBuilding } from '../state/GameState';
import { WorshipSystem } from './WorshipSystem';

function place(gameState: GameState, defId: string, gridX = 0, gridY = 0): PlacedBuilding {
    const building: PlacedBuilding = { id: `${defId}-${gridX}-${gridY}`, defId, gridX, gridY };
    gameState.buildings.push(building);
    return building;
}

describe('WorshipSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;
    let system: WorshipSystem;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
        system = new WorshipSystem(gameState, eventBus);
    });

    it('generates no faith without a temple, regardless of population', () => {
        gameState.population = { total: 100, happiness: 1 };

        system.update(10);

        expect(gameState.worship.faithTotal).toBe(0);
    });

    it('generates no faith without population, regardless of temples', () => {
        place(gameState, 'temple');
        gameState.population = { total: 0, happiness: 1 };

        system.update(10);

        expect(gameState.worship.faithTotal).toBe(0);
    });

    it('generates no faith at zero happiness', () => {
        place(gameState, 'temple');
        gameState.population = { total: 50, happiness: 0 };

        system.update(10);

        expect(gameState.worship.faithTotal).toBe(0);
    });

    it('scales faith generation with population, happiness, and temple count', () => {
        place(gameState, 'temple', 0, 0);
        gameState.population = { total: 10, happiness: 1 };

        system.update(1);
        const oneTemple = gameState.worship.faithTotal;
        expect(oneTemple).toBeGreaterThan(0);

        gameState.worship.faithTotal = 0;
        place(gameState, 'temple', 5, 5);
        system.update(1);

        expect(gameState.worship.faithTotal).toBeCloseTo(oneTemple * 2, 10);
    });

    it('accumulates faithTotal and emits faith:generated with running totals', () => {
        place(gameState, 'temple');
        gameState.population = { total: 10, happiness: 1 };
        const events: number[] = [];
        eventBus.on('faith:generated', (payload) => events.push(payload.total));

        system.update(2);
        const rate = gameState.worship.faithPerTick;
        system.update(3);

        expect(events).toHaveLength(2);
        expect(events[0]).toBeCloseTo(rate * 2, 10);
        expect(events[1]).toBeCloseTo(rate * 5, 10);
        expect(gameState.worship.faithTotal).toBeCloseTo(rate * 5, 10);
    });
});
