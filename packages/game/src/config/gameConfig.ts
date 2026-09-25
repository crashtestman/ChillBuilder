import { AUTO, Scale, type Types } from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { WorldScene } from '../scenes/WorldScene';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';

export const gameConfig: Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#2b2118',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [BootScene, PreloadScene, WorldScene]
};
