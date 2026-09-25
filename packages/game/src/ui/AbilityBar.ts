import type { GodAbilityDef } from '../data/godAbilities';
import type { EventBus } from '../state/EventBus';
import type { GodPowerSystem } from '../systems/GodPowerSystem';

/**
 * DOM control for a single god-power ability: hidden until unlocked, then
 * togglable (arms/disarms tap-to-target mode) and shows cooldown state.
 * WorldScene owns what "armed" actually does and calls refresh() every
 * frame, since cooldown counts down independent of any event.
 */
export class AbilityBar {
    private readonly root: HTMLDivElement;
    private readonly button: HTMLButtonElement;
    private readonly eventBus: EventBus;
    private readonly godPowerSystem: GodPowerSystem;
    private readonly ability: GodAbilityDef;
    private armed = false;

    private readonly onUnlocked = (payload: { abilityId: string }): void => {
        if (payload.abilityId === this.ability.id) {
            this.root.hidden = false;
        }
    };

    constructor(
        ability: GodAbilityDef,
        eventBus: EventBus,
        godPowerSystem: GodPowerSystem,
        onArmedChanged: (armed: boolean) => void
    ) {
        this.ability = ability;
        this.eventBus = eventBus;
        this.godPowerSystem = godPowerSystem;

        this.root = document.createElement('div');
        this.root.className = 'ability-bar';
        this.root.hidden = !godPowerSystem.isUnlocked(ability.id);

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'ability-bar__item';
        this.button.addEventListener('click', () => {
            this.setArmed(!this.armed);
            onArmedChanged(this.armed);
        });
        this.root.appendChild(this.button);

        this.refresh();

        const uiRoot = document.getElementById('ui-root');
        (uiRoot ?? document.body).appendChild(this.root);

        this.eventBus.on('godpower:ability-unlocked', this.onUnlocked);
    }

    refresh(): void {
        const onCooldown = this.godPowerSystem.isOnCooldown(this.ability.id);
        this.button.disabled = onCooldown;
        this.button.textContent = onCooldown
            ? `${this.ability.name} (${this.godPowerSystem.cooldownRemainingSeconds(this.ability.id).toFixed(1)}s)`
            : `${this.ability.name} (${this.ability.energyCost} energy)`;
    }

    setArmed(armed: boolean): void {
        this.armed = armed;
        this.button.classList.toggle('ability-bar__item--armed', armed);
    }

    isArmed(): boolean {
        return this.armed;
    }

    destroy(): void {
        this.eventBus.off('godpower:ability-unlocked', this.onUnlocked);
        this.root.remove();
    }
}
