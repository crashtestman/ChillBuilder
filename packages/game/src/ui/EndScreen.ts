export type GameOutcome = 'won' | 'lost';

/**
 * Full-screen win/lose overlay with a restart button. Created once the
 * outcome is decided (WorldScene owns detecting that) — there's no live
 * state to react to here, just a static result and one action.
 */
export class EndScreen {
    private readonly root: HTMLDivElement;

    constructor(outcome: GameOutcome, onRestart: () => void) {
        this.root = document.createElement('div');
        this.root.className = 'end-screen';

        const panel = document.createElement('div');
        panel.className = 'end-screen__panel';

        const title = document.createElement('div');
        title.className = `end-screen__title end-screen__title--${outcome}`;
        title.textContent = outcome === 'won' ? 'City Defended!' : 'The City Has Fallen';

        const subtitle = document.createElement('div');
        subtitle.className = 'end-screen__subtitle';
        subtitle.textContent =
            outcome === 'won'
                ? 'Every raider was stopped before reaching the city core.'
                : 'The raiders overwhelmed your defenses.';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'end-screen__button';
        button.textContent = 'Restart';
        button.addEventListener('click', onRestart);

        panel.append(title, subtitle, button);
        this.root.appendChild(panel);

        const uiRoot = document.getElementById('ui-root');
        (uiRoot ?? document.body).appendChild(this.root);
    }

    destroy(): void {
        this.root.remove();
    }
}
