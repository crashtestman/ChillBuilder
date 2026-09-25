import { beforeEach, describe, expect, it } from 'vitest';
import type { MapDef } from '../data/mapDefs/slice01';
import { WAVES } from '../data/waves';
import { gridToWorld } from '../iso/IsoMath';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState } from '../state/GameState';
import { BuildingSystem } from './BuildingSystem';
import { PathingSystem } from './PathingSystem';
import { WaveSystem } from './WaveSystem';

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

describe('WaveSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;
    let mapDef: MapDef;
    let buildingSystem: BuildingSystem;
    let system: WaveSystem;
    const wave = WAVES[0];

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
        mapDef = makeMapDef(10, 10);
        buildingSystem = new BuildingSystem(gameState, eventBus, mapDef);
        const pathing = new PathingSystem(buildingSystem);
        system = new WaveSystem(gameState, eventBus, mapDef, pathing);
    });

    it('spawns nothing before the wave\'s start delay elapses', () => {
        system.update(wave.startDelaySeconds - 1);

        expect(gameState.enemies).toHaveLength(0);
    });

    it('emits wave:started and spawns the first enemy once the delay elapses', () => {
        const started: string[] = [];
        eventBus.on('wave:started', (payload) => started.push(payload.waveId));
        const spawned: unknown[] = [];
        eventBus.on('enemy:spawned', (payload) => spawned.push(payload.enemy));

        system.update(wave.startDelaySeconds);

        expect(started).toEqual([wave.id]);
        expect(gameState.enemies).toHaveLength(1);
        expect(spawned).toHaveLength(1);
    });

    it('spawns a new enemy at each spawn interval up to the wave count, then stops', () => {
        system.update(wave.startDelaySeconds);
        for (let i = 1; i < wave.count; i++) {
            system.update(wave.spawnIntervalSeconds);
        }
        expect(gameState.enemies).toHaveLength(wave.count);
        expect(system.isSpawningComplete()).toBe(true);

        system.update(wave.spawnIntervalSeconds * 5);

        // No further spawns once the wave's count is exhausted (enemies may
        // also have moved/arrived in that time, but the total spawned never
        // exceeds what the wave defines).
        expect(gameState.enemies.length).toBeLessThanOrEqual(wave.count);
    });

    it('spawns an enemy at the spawn point, with a path ending at the city core', () => {
        system.update(wave.startDelaySeconds);

        const enemy = gameState.enemies[0];
        const spawnWorld = gridToWorld(mapDef.spawn.gridX, mapDef.spawn.gridY);
        expect(enemy.x).toBe(spawnWorld.x);
        expect(enemy.y).toBe(spawnWorld.y);
        expect(enemy.path[0]).toEqual(mapDef.spawn);
        expect(enemy.path[enemy.path.length - 1]).toEqual(mapDef.cityCore);
        expect(enemy.health).toBeGreaterThan(0);
    });

    it('moves a spawned enemy toward the next path waypoint over time', () => {
        system.update(wave.startDelaySeconds);
        const enemy = gameState.enemies[0];
        const startX = enemy.x;
        const startY = enemy.y;

        system.update(0.1);

        expect(enemy.x !== startX || enemy.y !== startY).toBe(true);
    });

    it('removes an enemy and emits enemy:reachedCity once it completes its path', () => {
        // A 2-cell map (adjacent spawn/core) so one big time step finishes it.
        const smallMap = makeMapDef(2, 1, { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 });
        const buildingSystem = new BuildingSystem(gameState, eventBus, smallMap);
        const pathing = new PathingSystem(buildingSystem);
        const smallSystem = new WaveSystem(gameState, eventBus, smallMap, pathing);

        const arrived: string[] = [];
        eventBus.on('enemy:reachedCity', (payload) => arrived.push(payload.enemyId));

        smallSystem.update(wave.startDelaySeconds); // triggers spawn
        const enemyId = gameState.enemies[0].id;

        // Just enough to cross the one cell (speed 100px/s > ~71.55px
        // between adjacent cells) without also running far enough past the
        // next spawnIntervalSeconds to cascade-spawn more of the wave.
        smallSystem.update(1);

        expect(gameState.enemies.find((e) => e.id === enemyId)).toBeUndefined();
        expect(arrived).toEqual([enemyId]);
    });

    it('repaths a live enemy when a building is placed on its route ahead of it', () => {
        system.update(wave.startDelaySeconds); // spawns e1
        system.update(1); // let it get partway along its original path

        const enemy = gameState.enemies[0];
        const originalPath = enemy.path;
        // A few steps ahead of wherever the enemy currently is, so placing
        // there forces a detour rather than landing behind/on it.
        const blockCell = originalPath[Math.min(enemy.pathIndex + 3, originalPath.length - 2)];

        gameState.resources.wood = 100;
        gameState.resources.gold = 100;
        const result = buildingSystem.place('tower', blockCell.gridX, blockCell.gridY);

        expect(result.ok).toBe(true);
        expect(enemy.path.some((c) => c.gridX === blockCell.gridX && c.gridY === blockCell.gridY)).toBe(false);
        expect(enemy.path[enemy.path.length - 1]).toEqual(mapDef.cityCore);
        expect(enemy.pathIndex).toBe(1);
    });

    it('reports "ongoing" while enemies are still spawning or alive', () => {
        expect(system.getOutcome()).toBe('ongoing');

        system.update(wave.startDelaySeconds);
        expect(system.getOutcome()).toBe('ongoing');
    });

    it('costs a life and emits city:damaged when an enemy reaches the city', () => {
        const smallMap = makeMapDef(2, 1, { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 });
        const smallBuildingSystem = new BuildingSystem(gameState, eventBus, smallMap);
        const pathing = new PathingSystem(smallBuildingSystem);
        const smallSystem = new WaveSystem(gameState, eventBus, smallMap, pathing);

        const damaged: number[] = [];
        eventBus.on('city:damaged', (payload) => damaged.push(payload.lives));

        const startingLives = gameState.city.lives;
        smallSystem.update(wave.startDelaySeconds); // spawn
        smallSystem.update(1); // cross the one cell and arrive

        expect(damaged).toEqual([startingLives - 1]);
        expect(gameState.city.lives).toBe(startingLives - 1);
    });

    it('reports "won" once the wave is fully cleared without losing the city', () => {
        // Isolated from the lives mechanic (covered by the tests above):
        // with no CombatSystem in this test, every enemy walks unimpeded to
        // the city, which would otherwise drain the default lives well
        // before all 6 finish and report 'lost' instead.
        gameState.city.lives = 999;

        system.update(wave.startDelaySeconds); // first spawn
        for (let i = 1; i < wave.count; i++) {
            system.update(wave.spawnIntervalSeconds);
        }
        expect(system.isSpawningComplete()).toBe(true);

        // One big step: updateEnemyMovement's per-enemy while loop is
        // bounded by remaining path length, not by deltaSeconds, so a
        // single huge tick is enough for every still-alive enemy to walk
        // the rest of its path and arrive in this same call.
        system.update(100);

        expect(gameState.enemies).toHaveLength(0);
        expect(system.getOutcome()).toBe('won');
    });

    it('reports "lost" once lives reach zero, even if spawning isn\'t complete yet', () => {
        gameState.city.lives = 1;
        const smallMap = makeMapDef(2, 1, { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 });
        const smallBuildingSystem = new BuildingSystem(gameState, eventBus, smallMap);
        const pathing = new PathingSystem(smallBuildingSystem);
        const smallSystem = new WaveSystem(gameState, eventBus, smallMap, pathing);

        smallSystem.update(wave.startDelaySeconds);
        smallSystem.update(1);

        expect(gameState.city.lives).toBe(0);
        expect(smallSystem.getOutcome()).toBe('lost');
    });

    it('never drops lives below zero', () => {
        gameState.city.lives = 0;
        const smallMap = makeMapDef(2, 1, { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 });
        const smallBuildingSystem = new BuildingSystem(gameState, eventBus, smallMap);
        const pathing = new PathingSystem(smallBuildingSystem);
        const smallSystem = new WaveSystem(gameState, eventBus, smallMap, pathing);

        smallSystem.update(wave.startDelaySeconds);
        smallSystem.update(1);

        expect(gameState.city.lives).toBe(0);
    });
});
