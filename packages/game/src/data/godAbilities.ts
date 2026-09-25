export interface GodAbilityDef {
    id: string;
    name: string;
    // godTier (cumulative faith earned) required to unlock.
    unlockThreshold: number;
    // divineEnergy cost to cast — never godTier; see the plan's two-stat
    // god-power model.
    energyCost: number;
    cooldownSeconds: number;
}

// Smite is the only ability the vertical slice needs (M6 wires the actual
// casting UI/targeting); the def exists now because GodPowerSystem (M5)
// already needs unlock thresholds to know when to start regenerating
// divineEnergy and to emit godpower:ability-unlocked.
export const GOD_ABILITIES: Record<string, GodAbilityDef> = {
    smite: {
        id: 'smite',
        name: 'Smite',
        unlockThreshold: 50,
        energyCost: 20,
        cooldownSeconds: 5
    }
};
