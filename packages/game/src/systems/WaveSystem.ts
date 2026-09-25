import { ENEMIES } from '../data/enemies';
import type { MapDef } from '../data/mapDefs/slice01';
import { WAVES } from '../data/waves';
import { gridToWorld } from '../iso/IsoMath';
import type { EventBus } from '../state/EventBus';
import type { GameState, LiveEnemy } from '../state/GameState';
import type { PathingSystem } from './PathingSystem';

let nextEnemyId = 1;

// Owns the whole enemy lifecycle (spawn timing, movement along its path,
// reaching the city) — the plan's system list has no separate "movement"
// system, and WaveSystem is already the natural owner of gameState.enemies
// since it's the one creating them. PathingSystem is only consulted once,
// at spawn, for the initial route.
export class WaveSystem {
    private waveIndex = 0;
    private waveElapsed = 0;
    private started = false;
    private spawnedInWave = 0;
    private nextSpawnAt = 0;
    private allWavesSpawned = false;

    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus,
        private readonly mapDef: MapDef,
        private readonly pathingSystem: PathingSystem
    ) {}

    update(deltaSeconds: number): void {
        // Movement before spawning: a newly-spawned enemy shouldn't also
        // move by this entire tick's delta, as though it had already been
        // walking for the whole tick before it existed. At real frame
        // deltas (~16ms) this ordering is imperceptible either way, but it
        // matters a lot for a coarse-grained delta (e.g. tests, or a synced
        // dev-time-driving harness) — spawning first could let a fresh
        // enemy immediately cover an entire multi-second tick's distance.
        this.updateEnemyMovement(deltaSeconds);
        this.updateSpawning(deltaSeconds);
    }

    /** True once every wave has finished spawning (not necessarily killed/arrived). */
    isSpawningComplete(): boolean {
        return this.allWavesSpawned;
    }

    private updateSpawning(deltaSeconds: number): void {
        if (this.allWavesSpawned) {
            return;
        }

        const wave = WAVES[this.waveIndex];
        if (!wave) {
            this.allWavesSpawned = true;
            return;
        }

        this.waveElapsed += deltaSeconds;

        if (!this.started) {
            if (this.waveElapsed < wave.startDelaySeconds) {
                return;
            }
            this.started = true;
            this.nextSpawnAt = this.waveElapsed;
            this.eventBus.emit('wave:started', { waveId: wave.id });
        }

        while (this.spawnedInWave < wave.count && this.waveElapsed >= this.nextSpawnAt) {
            this.spawnEnemy(wave.enemyDefId);
            this.spawnedInWave++;
            this.nextSpawnAt += wave.spawnIntervalSeconds;
        }

        if (this.spawnedInWave >= wave.count) {
            this.waveIndex++;
            this.waveElapsed = 0;
            this.started = false;
            this.spawnedInWave = 0;
            if (this.waveIndex >= WAVES.length) {
                this.allWavesSpawned = true;
            }
        }
    }

    private spawnEnemy(enemyDefId: string): void {
        const def = ENEMIES[enemyDefId];
        if (!def) {
            return;
        }

        // Guaranteed to succeed by BuildingSystem's wall-off rule, which
        // never lets spawn<->cityCore be fully sealed — see NEIGHBOR_OFFSETS'
        // comment in BuildingSystem for why PathingSystem can't disagree.
        const path = this.pathingSystem.findPath(this.mapDef.spawn, this.mapDef.cityCore);
        if (!path || path.length === 0) {
            return;
        }

        const start = gridToWorld(path[0].gridX, path[0].gridY);
        const enemy: LiveEnemy = {
            id: `e${nextEnemyId++}`,
            defId: enemyDefId,
            x: start.x,
            y: start.y,
            health: def.maxHealth,
            path,
            pathIndex: 1
        };
        this.gameState.enemies.push(enemy);
        this.eventBus.emit('enemy:spawned', { enemy });
    }

    private updateEnemyMovement(deltaSeconds: number): void {
        if (this.gameState.enemies.length === 0) {
            return;
        }

        const arrived: string[] = [];

        for (const enemy of this.gameState.enemies) {
            const def = ENEMIES[enemy.defId];
            if (!def) {
                continue;
            }

            let remainingMove = def.speed * deltaSeconds;

            while (remainingMove > 0 && enemy.pathIndex < enemy.path.length) {
                const target = enemy.path[enemy.pathIndex];
                const targetWorld = gridToWorld(target.gridX, target.gridY);
                const dx = targetWorld.x - enemy.x;
                const dy = targetWorld.y - enemy.y;
                const distance = Math.hypot(dx, dy);

                if (distance <= remainingMove) {
                    enemy.x = targetWorld.x;
                    enemy.y = targetWorld.y;
                    remainingMove -= distance;
                    enemy.pathIndex++;
                } else {
                    enemy.x += (dx / distance) * remainingMove;
                    enemy.y += (dy / distance) * remainingMove;
                    remainingMove = 0;
                }
            }

            if (enemy.pathIndex >= enemy.path.length) {
                arrived.push(enemy.id);
            }
        }

        if (arrived.length > 0) {
            this.gameState.enemies = this.gameState.enemies.filter((enemy) => !arrived.includes(enemy.id));
            for (const enemyId of arrived) {
                this.eventBus.emit('enemy:reachedCity', { enemyId });
            }
        }
    }
}
