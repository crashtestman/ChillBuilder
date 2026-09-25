import { BUILDINGS } from '../data/buildings';
import { GOD_ABILITIES } from '../data/godAbilities';
import { worldToNearestGrid } from '../iso/IsoMath';
import type { EventBus } from '../state/EventBus';
import type { GameState, LiveEnemy } from '../state/GameState';
import type { WaveSystem } from './WaveSystem';

function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

// Owns all enemy damage: tower auto-fire (ticked here) and Smite's AoE
// (reacted to via ability:cast, since GodPowerSystem only knows unlock/
// cooldown/energy bookkeeping — see EventBus's comment on that event).
// Both paths measure range/AoE the same way — Chebyshev distance between
// grid cells, via worldToNearestGrid on the enemy's continuous position —
// so a tower and Smite can never disagree about which cell an enemy is in.
export class CombatSystem {
    // Per-tower cooldown countdown, keyed by PlacedBuilding.id. Ephemeral
    // combat timing, not part of GameState, the same way WaveSystem keeps
    // its own spawn timers privately rather than in GameState.
    private readonly towerCooldowns = new Map<string, number>();

    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus,
        private readonly waveSystem: WaveSystem
    ) {
        eventBus.on('ability:cast', (payload) => {
            if (payload.abilityId === 'smite') {
                this.handleSmite(payload.gridX, payload.gridY);
            }
        });
    }

    update(deltaSeconds: number): void {
        if (this.gameState.enemies.length === 0) {
            return;
        }

        for (const building of this.gameState.buildings) {
            const def = BUILDINGS[building.defId];
            if (!def || def.range === undefined || def.damage === undefined || def.fireIntervalSeconds === undefined) {
                continue;
            }

            const remaining = (this.towerCooldowns.get(building.id) ?? 0) - deltaSeconds;
            if (remaining > 0) {
                this.towerCooldowns.set(building.id, remaining);
                continue;
            }

            const target = this.findWeakestEnemyInRange(building.gridX, building.gridY, def.range);
            if (!target) {
                // Not on cooldown, just nothing to shoot at yet — keep
                // checking every tick rather than resetting to fireInterval,
                // so a tower fires immediately once an enemy enters range.
                continue;
            }

            this.towerCooldowns.set(building.id, def.fireIntervalSeconds);
            this.eventBus.emit('tower:fired', {
                buildingId: building.id,
                targetEnemyId: target.id,
                gridX: building.gridX,
                gridY: building.gridY
            });
            this.applyDamage(target, def.damage);
        }
    }

    // Lowest health first (ties broken by nearest) rather than nearest-first:
    // with multiple enemies passing through in a staggered line, "nearest"
    // flips targets shot-to-shot as the lead enemy exits range and the next
    // one enters, spreading damage across the whole line instead of
    // finishing any of them off. Focusing the already-weakest enemy is the
    // standard tower-defense behavior and lets a tower actually secure a
    // kill instead of just chipping everyone that walks past.
    private findWeakestEnemyInRange(gridX: number, gridY: number, range: number): LiveEnemy | null {
        let best: LiveEnemy | null = null;
        let bestDistance = Infinity;

        for (const enemy of this.gameState.enemies) {
            const enemyCell = worldToNearestGrid(enemy.x, enemy.y);
            const distance = chebyshevDistance(gridX, gridY, enemyCell.gridX, enemyCell.gridY);
            if (distance > range) {
                continue;
            }
            if (!best || enemy.health < best.health || (enemy.health === best.health && distance < bestDistance)) {
                best = enemy;
                bestDistance = distance;
            }
        }

        return best;
    }

    private handleSmite(gridX: number, gridY: number): void {
        const def = GOD_ABILITIES.smite;
        const targets = this.gameState.enemies.filter((enemy) => {
            const enemyCell = worldToNearestGrid(enemy.x, enemy.y);
            return chebyshevDistance(gridX, gridY, enemyCell.gridX, enemyCell.gridY) <= def.radius;
        });

        for (const enemy of targets) {
            this.applyDamage(enemy, def.damage);
        }
    }

    private applyDamage(enemy: LiveEnemy, amount: number): void {
        enemy.health -= amount;
        // Guard against Smite and a tower both finishing the same enemy in
        // one tick: removeEnemy() is false for the second attempt, so only
        // the one that actually removed it reports the kill.
        if (enemy.health <= 0 && this.waveSystem.removeEnemy(enemy.id)) {
            this.eventBus.emit('enemy:killed', { enemyId: enemy.id });
        }
    }
}
