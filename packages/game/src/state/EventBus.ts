import type { PlacedBuilding } from './GameState';

// Event vocabulary grows as each milestone needs it — only the two events
// M2 actually emits are declared so far (population:changed, faith:generated
// etc. join this map when M4/M5 introduce those systems).
export interface GameEvents {
    'resource:changed': { resourceId: string; amount: number };
    'building:placed': { building: PlacedBuilding };
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
