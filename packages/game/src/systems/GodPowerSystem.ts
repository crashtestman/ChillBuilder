import { GOD_ABILITIES } from '../data/godAbilities';
import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

const DIVINE_ENERGY_CAP = 100;

export type CastFailureReason = 'unknown-ability' | 'not-unlocked' | 'on-cooldown' | 'cannot-afford';
export type CastCheck = { ok: true } | { ok: false; reason: CastFailureReason };

// The two-stat god-power model from the plan: godTier (permanent, gates
// ability unlocks, never decreases — read straight off worship.faithTotal,
// see GameState) and divineEnergy (spendable, what abilities actually
// cost). Reacts to WorshipSystem's faith:generated rather than being
// ticked directly for the stat accrual side, since every godTier/
// divineEnergy change from THAT is a consequence of faith being generated —
// update(dt) still exists, but only to count down ability cooldowns.
export class GodPowerSystem {
    private readonly cooldownRemaining = new Map<string, number>();

    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus
    ) {
        eventBus.on('faith:generated', ({ amount }) => this.onFaithGenerated(amount));
    }

    update(deltaSeconds: number): void {
        for (const [abilityId, remaining] of this.cooldownRemaining) {
            const next = remaining - deltaSeconds;
            if (next <= 0) {
                this.cooldownRemaining.delete(abilityId);
            } else {
                this.cooldownRemaining.set(abilityId, next);
            }
        }
    }

    isOnCooldown(abilityId: string): boolean {
        return this.cooldownRemaining.has(abilityId);
    }

    cooldownRemainingSeconds(abilityId: string): number {
        return this.cooldownRemaining.get(abilityId) ?? 0;
    }

    // Checks unlock + cooldown + affordability together, spends energy and
    // starts the cooldown on success. Targeting (where an ability affects)
    // is a WorldScene/input concern, not this system's — it only answers
    // "can this be cast, and here's what casting it costs."
    tryCast(abilityId: string): CastCheck {
        const def = GOD_ABILITIES[abilityId];
        if (!def) {
            return { ok: false, reason: 'unknown-ability' };
        }
        if (!this.isUnlocked(abilityId)) {
            return { ok: false, reason: 'not-unlocked' };
        }
        if (this.isOnCooldown(abilityId)) {
            return { ok: false, reason: 'on-cooldown' };
        }
        if (!this.trySpendEnergy(def.energyCost)) {
            return { ok: false, reason: 'cannot-afford' };
        }

        this.cooldownRemaining.set(abilityId, def.cooldownSeconds);
        return { ok: true };
    }

    godTier(): number {
        return this.gameState.worship.faithTotal;
    }

    isUnlocked(abilityId: string): boolean {
        return this.gameState.godPower.unlockedAbilities.includes(abilityId);
    }

    // Spends divineEnergy only — never godTier, so casting an ability can
    // never make the god weaker (the plan's corrected requirement).
    trySpendEnergy(amount: number): boolean {
        if (this.gameState.godPower.divineEnergy < amount) {
            return false;
        }
        this.gameState.godPower.divineEnergy -= amount;
        this.emitChanged();
        return true;
    }

    private onFaithGenerated(amount: number): void {
        // No regen before anything is unlocked — a pool nothing can spend
        // yet would just sit there (or silently overflow at the cap).
        if (this.gameState.godPower.unlockedAbilities.length > 0) {
            this.gameState.godPower.divineEnergy = Math.min(
                DIVINE_ENERGY_CAP,
                this.gameState.godPower.divineEnergy + amount
            );
        }

        this.checkUnlocks();
        this.emitChanged();
    }

    private checkUnlocks(): void {
        const tier = this.godTier();
        for (const ability of Object.values(GOD_ABILITIES)) {
            if (this.isUnlocked(ability.id)) {
                continue;
            }
            if (tier >= ability.unlockThreshold) {
                this.gameState.godPower.unlockedAbilities.push(ability.id);
                this.eventBus.emit('godpower:ability-unlocked', { abilityId: ability.id });
            }
        }
    }

    private emitChanged(): void {
        this.eventBus.emit('godpower:changed', {
            godTier: this.godTier(),
            divineEnergy: this.gameState.godPower.divineEnergy
        });
    }
}
