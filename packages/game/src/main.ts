import { Game } from 'phaser';
import { gameConfig } from './config/gameConfig';

document.addEventListener('DOMContentLoaded', () => {
    new Game(gameConfig);
});
