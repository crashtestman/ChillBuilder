export type BuildingCategory = 'economy' | 'housing' | 'defense' | 'temple';

export interface BuildingFootprint {
    width: number;
    height: number;
}

export interface BuildingDef {
    id: string;
    name: string;
    category: BuildingCategory;
    footprint: BuildingFootprint;
    buildCost: Record<string, number>;
    // Resource -> amount per second, ticked by EconomySystem.
    produces?: Record<string, number>;
    consumes?: Record<string, number>;
    // How many population this building houses, consumed by PopulationSystem.
    housingCapacity?: number;
    isTemple?: boolean;
}

export const BUILDINGS: Record<string, BuildingDef> = {
    house: {
        id: 'house',
        name: 'House',
        category: 'housing',
        footprint: { width: 2, height: 2 },
        buildCost: { wood: 20 },
        housingCapacity: 4
    },
    farm: {
        id: 'farm',
        name: 'Farm',
        category: 'economy',
        footprint: { width: 1, height: 1 },
        buildCost: { wood: 10 },
        produces: { food: 1 }
    },
    woodcutter: {
        id: 'woodcutter',
        name: 'Woodcutter',
        category: 'economy',
        footprint: { width: 1, height: 1 },
        buildCost: { wood: 15 },
        produces: { wood: 1 }
    }
};
