import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState, type PlacedBuilding } from '../state/GameState';
import { PopulationSystem } from './PopulationSystem';

function place(gameState: GameState, defId: string, gridX = 0, gridY = 0): PlacedBuilding {
    const building: PlacedBuilding = { id: `${defId}-${gridX}-${gridY}`, defId, gridX, gridY };
    gameState.buildings.push(building);
    return building;
}

describe('PopulationSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;
    let system: PopulationSystem;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
        system = new PopulationSystem(gameState, eventBus);
    });

    it('reports housing capacity as the sum of placed housing buildings', () => {
        expect(system.housingCapacity()).toBe(0);

        place(gameState, 'house');
        expect(system.housingCapacity()).toBe(4);

        place(gameState, 'house', 5, 5);
        expect(system.housingCapacity()).toBe(8);
    });

    it('never grows population without any housing', () => {
        gameState.resources.food = 1000;

        system.update(100);

        expect(gameState.population.total).toBe(0);
    });

    it('grows population toward housing capacity when well fed', () => {
        place(gameState, 'house');
        gameState.resources.food = 1000;

        system.update(50);

        expect(gameState.population.total).toBeGreaterThan(0);
        expect(gameState.population.total).toBeLessThanOrEqual(4);
    });

    it('never grows population past housing capacity', () => {
        place(gameState, 'house');
        gameState.resources.food = 100000;

        system.update(10000);

        expect(gameState.population.total).toBeLessThanOrEqual(4);
    });

    it('consumes food proportional to population and time', () => {
        gameState.population.total = 10;
        gameState.resources.food = 50;

        system.update(2); // 10 pop * 0.1/sec * 2s = 2 food

        expect(gameState.resources.food).toBe(48);
    });

    it('never drives food below zero from population upkeep', () => {
        gameState.population.total = 1000;
        gameState.resources.food = 1;

        system.update(1);

        expect(gameState.resources.food).toBe(0);
    });

    it('is fully happy with no population regardless of food', () => {
        gameState.resources.food = 0;

        system.update(1);

        expect(gameState.population.happiness).toBe(1);
    });

    it('derives lower happiness from a thinner food buffer relative to population', () => {
        place(gameState, 'house');
        gameState.population.total = 4;
        gameState.resources.food = 1000; // huge buffer

        system.update(0.001); // negligible time step, isolates the happiness calc

        const wellFedHappiness = gameState.population.happiness;

        gameState.resources.food = 5; // thin but not starvation-level buffer
        system.update(0.001);

        expect(gameState.population.happiness).toBeLessThan(wellFedHappiness);
    });

    it('shrinks a starving population instead of growing it', () => {
        gameState.population.total = 10;
        gameState.resources.food = 0; // happiness will be 0, below the starvation threshold

        system.update(1);

        expect(gameState.population.total).toBeLessThan(10);
    });

    it('emits population:changed only when total or happiness actually changes', () => {
        const events: unknown[] = [];
        eventBus.on('population:changed', (payload) => events.push(payload));

        // No housing, no population, no food consumption -> nothing changes.
        system.update(5);

        expect(events).toEqual([]);
    });
});
