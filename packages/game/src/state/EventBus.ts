import type { LiveEnemy, PlacedBuilding, PopulationState } from './GameState';

// Event vocabulary grows as each milestone needs it.
export interface GameEvents {
    'resource:changed': { resourceId: string; amount: number };
    'building:placed': { building: PlacedBuilding };
    'population:changed': PopulationState;
    'faith:generated': { amount: number; total: number };
    'godpower:changed': { godTier: number; divineEnergy: number };
    'godpower:ability-unlocked': { abilityId: string };
    // Targeting (grid location) lives here, not in GodPowerSystem, which
    // only knows about unlock/cooldown/energy bookkeeping. Damage
    // resolution against this target is finished in M8's CombatSystem.
    'ability:cast': { abilityId: string; gridX: number; gridY: number };
    'wave:started': { waveId: string };
    'enemy:spawned': { enemy: LiveEnemy };
    'enemy:reachedCity': { enemyId: string };
}

type Listener<T> = (payload: T) => void;

// The one shared event bus the plan calls for — deliberately NOT
// Phaser.Events.EventEmitter, so Systems (and their Vitest tests) never
// need Phaser/WebGL to exist just to import this module.
export class EventBus {
    private readonly listeners = new Map<keyof GameEvents, Set<Listener<never>>>();

    on<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): this {
        let eventListeners = this.listeners.get(event);
        if (!eventListeners) {
            eventListeners = new Set();
            this.listeners.set(event, eventListeners);
        }
        eventListeners.add(listener as Listener<never>);
        return this;
    }

    off<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): this {
        this.listeners.get(event)?.delete(listener as Listener<never>);
        return this;
    }

    emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
        this.listeners.get(event)?.forEach((listener) => (listener as Listener<GameEvents[K]>)(payload));
    }
}
