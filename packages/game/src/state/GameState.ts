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

// The single authoritative game-state object the plan calls for. Only holds
// what's needed so far — faith and god-power fields join it in the
// milestones that introduce them, rather than sitting here unused ahead of
// time.
export interface GameState {
    resources: Record<string, number>;
    buildings: PlacedBuilding[];
    population: PopulationState;
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
        population: { total: 0, happiness: 1 }
    };
}
