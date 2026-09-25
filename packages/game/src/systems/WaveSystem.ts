import { ENEMIES } from '../data/enemies';
import type { MapDef } from '../data/mapDefs/slice01';
import { WAVES } from '../data/waves';
import { gridToWorld, worldToNearestGrid } from '../iso/IsoMath';
import type { EventBus } from '../state/EventBus';
import type { GameState, LiveEnemy } from '../state/GameState';
import type { PathingSystem } from './PathingSystem';

let nextEnemyId = 1;

// Owns the whole enemy lifecycle (spawn timing, movement along its path,
// reaching the city) — the plan's system list has no separate "movement"
// system, and WaveSystem is already the natural owner of gameState.enemies
// since it's the one creating them. PathingSystem is consulted at spawn for
// the initial route, and again for every live enemy whenever a building is
// placed (M8's towers made this matter: without it, a tower placed mid-wave
// would just get walked through by enemies already in transit).
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
    ) {
        eventBus.on('building:placed', () => this.repathLiveEnemies());
    }

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

    // The one place gameState.enemies ever loses an entry — both the
    // arrival path below and CombatSystem's kill path (M8) go through this,
    // so there's a single removal mechanism rather than two that could
    // drift apart. Returns false (no-op) if the enemy is already gone,
    // since a tower and Smite could otherwise both try to finish off the
    // same low-health enemy in one tick.
    removeEnemy(enemyId: string): boolean {
        const index = this.gameState.enemies.findIndex((enemy) => enemy.id === enemyId);
        if (index === -1) {
            return false;
        }
        this.gameState.enemies.splice(index, 1);
        return true;
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

    // Re-routes every live enemy from its current position whenever a new
    // building goes up, so a tower (or any building) placed mid-wave
    // actually redirects enemies already in transit instead of leaving them
    // walking their stale spawn-time route straight through it.
    private repathLiveEnemies(): void {
        for (const enemy of this.gameState.enemies) {
            const currentCell = worldToNearestGrid(enemy.x, enemy.y);
            const newPath = this.pathingSystem.findPath(currentCell, this.mapDef.cityCore);
            if (!newPath || newPath.length === 0) {
                // The new building landed on the enemy's own current cell,
                // making that cell itself unwalkable — no route exists from
                // exactly where it's standing. Leave its old path/pathIndex
                // alone rather than freezing it; it keeps moving toward its
                // last known waypoint, which is a rare visual glitch, not a
                // stuck-forever enemy.
                continue;
            }
            enemy.path = newPath;
            enemy.pathIndex = 1;
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

        for (const enemyId of arrived) {
            this.removeEnemy(enemyId);
            this.eventBus.emit('enemy:reachedCity', { enemyId });
        }
    }
}
