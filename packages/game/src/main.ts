import { Game } from 'phaser';
import { gameConfig } from './config/gameConfig';

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game(gameConfig);

    // Dev-only: lets time-driven systems (economy ticks, growth, cooldowns,
    // wave timers...) be driven synchronously from devtools/test tooling
    // via game.scene.getScene('World'), instead of waiting on real time or
    // a visible-tab requestAnimationFrame loop.
    if (import.meta.env.DEV) {
        (window as unknown as { game: Game }).game = game;
    }
});
