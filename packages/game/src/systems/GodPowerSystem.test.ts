import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState } from '../state/GameState';
import { GodPowerSystem } from './GodPowerSystem';

describe('GodPowerSystem', () => {
    let gameState: GameState;
    let eventBus: EventBus;
    let system: GodPowerSystem;

    beforeEach(() => {
        gameState = createGameState();
        eventBus = new EventBus();
        system = new GodPowerSystem(gameState, eventBus);
    });

    it('reads godTier straight off worship.faithTotal', () => {
        gameState.worship.faithTotal = 12.5;
        expect(system.godTier()).toBe(12.5);
    });

    it('does not regenerate divineEnergy before any ability is unlocked', () => {
        eventBus.emit('faith:generated', { amount: 10, total: 10 });

        expect(gameState.godPower.divineEnergy).toBe(0);
    });

    it('unlocks an ability once godTier crosses its threshold, and emits the event', () => {
        const unlocked: string[] = [];
        eventBus.on('godpower:ability-unlocked', (payload) => unlocked.push(payload.abilityId));

        gameState.worship.faithTotal = 49;
        eventBus.emit('faith:generated', { amount: 49, total: 49 });
        expect(system.isUnlocked('smite')).toBe(false);
        expect(unlocked).toEqual([]);

        gameState.worship.faithTotal = 50;
        eventBus.emit('faith:generated', { amount: 1, total: 50 });
        expect(system.isUnlocked('smite')).toBe(true);
        expect(unlocked).toEqual(['smite']);
    });

    it('only unlocks an ability once, not on every subsequent faith:generated', () => {
        const unlocked: string[] = [];
        eventBus.on('godpower:ability-unlocked', (payload) => unlocked.push(payload.abilityId));

        gameState.worship.faithTotal = 60;
        eventBus.emit('faith:generated', { amount: 60, total: 60 });
        eventBus.emit('faith:generated', { amount: 10, total: 70 });

        expect(unlocked).toEqual(['smite']);
    });

    it('regenerates divineEnergy from faith once an ability is unlocked, capped at 100', () => {
        gameState.godPower.unlockedAbilities = ['smite'];

        eventBus.emit('faith:generated', { amount: 40, total: 40 });
        expect(gameState.godPower.divineEnergy).toBe(40);

        eventBus.emit('faith:generated', { amount: 90, total: 130 });
        expect(gameState.godPower.divineEnergy).toBe(100);
    });

    it('spends divineEnergy but never touches godTier/faithTotal', () => {
        gameState.godPower.unlockedAbilities = ['smite'];
        gameState.godPower.divineEnergy = 50;
        gameState.worship.faithTotal = 200;

        const spent = system.trySpendEnergy(20);

        expect(spent).toBe(true);
        expect(gameState.godPower.divineEnergy).toBe(30);
        expect(gameState.worship.faithTotal).toBe(200);
        expect(system.godTier()).toBe(200);
    });

    it('refuses to spend more divineEnergy than is available', () => {
        gameState.godPower.divineEnergy = 5;

        const spent = system.trySpendEnergy(20);

        expect(spent).toBe(false);
        expect(gameState.godPower.divineEnergy).toBe(5);
    });

    it('emits godpower:changed on spend', () => {
        gameState.godPower.divineEnergy = 50;
        const events: Array<{ godTier: number; divineEnergy: number }> = [];
        eventBus.on('godpower:changed', (payload) => events.push(payload));

        system.trySpendEnergy(10);

        expect(events).toEqual([{ godTier: system.godTier(), divineEnergy: 40 }]);
    });

    describe('tryCast', () => {
        it('refuses to cast an ability that is not unlocked', () => {
            gameState.godPower.divineEnergy = 100;

            expect(system.tryCast('smite')).toEqual({ ok: false, reason: 'not-unlocked' });
            expect(gameState.godPower.divineEnergy).toBe(100);
        });

        it('refuses to cast an unknown ability', () => {
            expect(system.tryCast('nonexistent')).toEqual({ ok: false, reason: 'unknown-ability' });
        });

        it('refuses to cast without enough divineEnergy, without starting the cooldown', () => {
            gameState.godPower.unlockedAbilities = ['smite'];
            gameState.godPower.divineEnergy = 5; // smite costs 20

            expect(system.tryCast('smite')).toEqual({ ok: false, reason: 'cannot-afford' });
            expect(system.isOnCooldown('smite')).toBe(false);
        });

        it('spends energy and starts the cooldown on a successful cast', () => {
            gameState.godPower.unlockedAbilities = ['smite'];
            gameState.godPower.divineEnergy = 100;

            expect(system.tryCast('smite')).toEqual({ ok: true });
            expect(gameState.godPower.divineEnergy).toBe(80); // 100 - 20 cost
            expect(system.isOnCooldown('smite')).toBe(true);
            expect(system.cooldownRemainingSeconds('smite')).toBe(5);
        });

        it('refuses to cast again while on cooldown, even with enough energy', () => {
            gameState.godPower.unlockedAbilities = ['smite'];
            gameState.godPower.divineEnergy = 100;

            expect(system.tryCast('smite')).toEqual({ ok: true });
            expect(system.tryCast('smite')).toEqual({ ok: false, reason: 'on-cooldown' });
            // Only the first cast's cost was spent.
            expect(gameState.godPower.divineEnergy).toBe(80);
        });

        it('counts the cooldown down over time via update(), allowing a re-cast once it expires', () => {
            gameState.godPower.unlockedAbilities = ['smite'];
            gameState.godPower.divineEnergy = 100;
            system.tryCast('smite');

            system.update(4);
            expect(system.isOnCooldown('smite')).toBe(true);
            expect(system.tryCast('smite')).toEqual({ ok: false, reason: 'on-cooldown' });

            system.update(1.01); // total 5.01s, past the 5s cooldown
            expect(system.isOnCooldown('smite')).toBe(false);
            expect(system.tryCast('smite')).toEqual({ ok: true });
        });
    });
});
