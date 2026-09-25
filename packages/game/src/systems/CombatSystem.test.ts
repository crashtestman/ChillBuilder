import { beforeEach, describe, expect, it } from 'vitest';
import type { MapDef } from '../data/mapDefs/slice01';
import { gridToWorld } from '../iso/IsoMath';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState, type LiveEnemy } from '../state/GameState';
import { BuildingSystem } from './BuildingSystem';
import { CombatSystem } from './CombatSystem';
import { PathingSystem } from './PathingSystem';
import { WaveSystem } from './WaveSystem';

function makeMapDef(cols: number, rows: number): MapDef {
    return {
        id: 'test',
        cols,
        rows,
        blocked: Array.from({ length: rows }, () => Array<boolean>(cols).fill(false)),
        spawn: { gridX: 0, gridY: 0 },
        cityCore: { gridX: cols - 1, gridY: rows - 1 }
    };
}

function makeEnemy(id: string, gridX: number, gridY: number, health: number): LiveEnemy {
    const { x, y } = gridToWorld(gridX, gridY);
    return { id, defId: 'raider', x, y, health, path: [], pathIndex: 0 };
}

describe('CombatSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;
    let mapDef: MapDef;
    let buildingSystem: BuildingSystem;
    let waveSystem: WaveSystem;
    let combatSystem: CombatSystem;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
        mapDef = makeMapDef(10, 10);
        buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);
        waveSystem = new WaveSystem(gameState, eventBus, mapDef, pathing);
        combatSystem = new CombatSystem(gameState, eventBus, waveSystem);

        // A tower far from spawn/cityCore so it never risks the wall-off
        // rejection, at (5,5) with the def's default range/damage/interval.
        gameState.resources.wood = 100;
        gameState.resources.gold = 100;
        buildingSystem.place('tower', 5, 5);
    });

    it('does nothing when no enemy is in range', () => {
        gameState.enemies.push(makeEnemy('e1', 9, 9, 20));

        combatSystem.update(10);

        expect(gameState.enemies).toHaveLength(1);
        expect(gameState.enemies[0].health).toBe(20);
    });

    it('damages the nearest enemy in range and emits tower:fired', () => {
        const fired: unknown[] = [];
        eventBus.on('tower:fired', (payload) => fired.push(payload));
        gameState.enemies.push(makeEnemy('e1', 6, 5, 20));

        combatSystem.update(0.1);

        expect(fired).toHaveLength(1);
        expect(gameState.enemies[0].health).toBe(12);
    });

    it('respects the tower fire interval instead of firing every tick', () => {
        gameState.enemies.push(makeEnemy('e1', 6, 5, 20));

        combatSystem.update(0.1);
        combatSystem.update(0.1);
        combatSystem.update(0.1);

        // Still on cooldown from the first shot (interval 1.5s) — only one
        // hit of 8 damage should have landed.
        expect(gameState.enemies[0].health).toBe(12);
    });

    it('fires again once its cooldown elapses', () => {
        gameState.enemies.push(makeEnemy('e1', 6, 5, 20));

        combatSystem.update(0.1);
        combatSystem.update(1.5);

        expect(gameState.enemies[0].health).toBe(4);
    });

    it('removes the enemy through WaveSystem and emits enemy:killed once health drops to zero', () => {
        const killed: string[] = [];
        eventBus.on('enemy:killed', (payload) => killed.push(payload.enemyId));
        gameState.enemies.push(makeEnemy('e1', 6, 5, 8));

        combatSystem.update(0.1);

        expect(gameState.enemies).toHaveLength(0);
        expect(killed).toEqual(['e1']);
    });

    it("Smite damages every enemy within the ability's radius of the target cell", () => {
        gameState.enemies.push(makeEnemy('near', 3, 3, 40));
        gameState.enemies.push(makeEnemy('far', 8, 8, 40));

        eventBus.emit('ability:cast', { abilityId: 'smite', gridX: 3, gridY: 4 });

        expect(gameState.enemies.find((e) => e.id === 'near')?.health).toBe(10);
        expect(gameState.enemies.find((e) => e.id === 'far')?.health).toBe(40);
    });

    it('Smite kills enemies whose health drops to zero or below', () => {
        const killed: string[] = [];
        eventBus.on('enemy:killed', (payload) => killed.push(payload.enemyId));
        gameState.enemies.push(makeEnemy('e1', 3, 3, 20));

        eventBus.emit('ability:cast', { abilityId: 'smite', gridX: 3, gridY: 3 });

        expect(gameState.enemies).toHaveLength(0);
        expect(killed).toEqual(['e1']);
    });

    it('ignores ability:cast payloads for abilities other than smite', () => {
        gameState.enemies.push(makeEnemy('e1', 3, 3, 20));

        eventBus.emit('ability:cast', { abilityId: 'some-other-ability', gridX: 3, gridY: 3 });

        expect(gameState.enemies[0].health).toBe(20);
    });
});
