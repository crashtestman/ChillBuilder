import { RESOURCES } from '../data/resources';

export interface PlacedBuilding {
    id: string;
    defId: string;
    gridX: number;
    gridY: number;
}

export interface PopulationState {
    total: number;
    // 0-1. Derived from food surplus by PopulationSystem.
    happiness: number;
}

export interface WorshipState {
    faithPerTick: number;
    faithTotal: number;
}

export interface GodPowerState {
    // Spendable pool; casting an ability drains this, never faithTotal —
    // see the plan's corrected two-stat model. There's no separate stored
    // "godTier": it's worship.faithTotal under another name (permanent,
    // monotonically increasing, gates ability unlocks), so it's read
    // straight off WorshipState rather than duplicated here.
    divineEnergy: number;
    unlockedAbilities: string[];
}

// The single authoritative game-state object the plan calls for. Only holds
// what's needed so far.
export interface GameState {
    resources: Record<string, number>;
    buildings: PlacedBuilding[];
    population: PopulationState;
    worship: WorshipState;
    godPower: GodPowerState;
}

export function createGameState(): GameState {
    const resources: Record<string, number> = {};
    for (const resource of Object.values(RESOURCES)) {
        resources[resource.id] = resource.startingAmount;
    }

    return {
        resources,
        buildings: [],
        // Nobody lives in the city yet — growth only starts once housing exists.
        population: { total: 0, happiness: 1 },
        worship: { faithPerTick: 0, faithTotal: 0 },
        godPower: { divineEnergy: 0, unlockedAbilities: [] }
    };
}
