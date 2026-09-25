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
    providesHousing?: boolean;
    isTemple?: boolean;
}

// House/Farm content (production rates, housing capacity) is fleshed out in
// M3 — these defs exist now so M2's placement mechanics have something real
// to place, including one multi-cell footprint (House) to exercise the
// occupancy grid and depth-sort beyond the 1x1 case.
export const BUILDINGS: Record<string, BuildingDef> = {
    house: {
        id: 'house',
        name: 'House',
        category: 'housing',
        footprint: { width: 2, height: 2 },
        buildCost: { wood: 20 },
        providesHousing: true
    },
    farm: {
        id: 'farm',
        name: 'Farm',
        category: 'economy',
        footprint: { width: 1, height: 1 },
        buildCost: { wood: 10 }
    }
};
