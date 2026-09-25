import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

function formatTier(godTier: number): string {
    return Math.floor(godTier).toString();
}

function formatEnergy(divineEnergy: number): string {
    return Math.floor(divineEnergy).toString();
}

/**
 * DOM overlay for the two god-power meters, kept live via 'godpower:changed'.
 * Deliberately two separate numbers, not one bar — permanent power
 * (godTier) and spendable energy (divineEnergy) are not the same stat, per
 * the plan's corrected god-power model.
 */
export class GodPowerBar {
    private readonly root: HTMLDivElement;
    private readonly eventBus: EventBus;
    private readonly tierValue: HTMLSpanElement;
    private readonly energyValue: HTMLSpanElement;
    private readonly onGodPowerChanged = (payload: { godTier: number; divineEnergy: number }): void => {
        const tierText = formatTier(payload.godTier);
        if (this.tierValue.textContent !== tierText) {
            this.tierValue.textContent = tierText;
        }
        const energyText = formatEnergy(payload.divineEnergy);
        if (this.energyValue.textContent !== energyText) {
            this.energyValue.textContent = energyText;
        }
    };

    constructor(gameState: GameState, eventBus: EventBus, container?: HTMLElement) {
        this.eventBus = eventBus;
        this.root = document.createElement('div');
        this.root.className = 'godpower-bar';

        const tierItem = document.createElement('div');
        tierItem.className = 'godpower-bar__item';
        const tierLabel = document.createElement('span');
        tierLabel.className = 'godpower-bar__label';
        tierLabel.textContent = 'God Tier';
        this.tierValue = document.createElement('span');
        this.tierValue.className = 'godpower-bar__value';
        this.tierValue.textContent = formatTier(gameState.worship.faithTotal);
        tierItem.append(tierLabel, this.tierValue);

        const energyItem = document.createElement('div');
        energyItem.className = 'godpower-bar__item';
        const energyLabel = document.createElement('span');
        energyLabel.className = 'godpower-bar__label';
        energyLabel.textContent = 'Divine Energy';
        this.energyValue = document.createElement('span');
        this.energyValue.className = 'godpower-bar__value';
        this.energyValue.textContent = formatEnergy(gameState.godPower.divineEnergy);
        energyItem.append(energyLabel, this.energyValue);

        this.root.append(tierItem, energyItem);

        this.eventBus.on('godpower:changed', this.onGodPowerChanged);

        const target = container ?? document.getElementById('ui-root') ?? document.body;
        target.appendChild(this.root);
    }

    destroy(): void {
        this.eventBus.off('godpower:changed', this.onGodPowerChanged);
        this.root.remove();
    }
}
