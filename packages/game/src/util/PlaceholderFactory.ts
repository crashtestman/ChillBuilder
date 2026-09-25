import { Scene } from 'phaser';

/**
 * Scales a 0xRRGGBB color's channels by factor, for deriving shaded
 * variants (a building's side walls, a checkerboarded ground tile) from a
 * single base color instead of having every def hand-author 3 hex values.
 */
export function shadeColor(color: number, factor: number): number {
    const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.round((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
}

/**
 * Generates a rhombus texture matching the project's 2:1 iso tile ratio, so
 * ground tiles placed via IsoMath's projection tile edge-to-edge instead of
 * showing rectangular sprite bounds overlapping their neighbors.
 */
export function createPlaceholderDiamondTexture(
    scene: Scene,
    key: string,
    width: number,
    height: number,
    fillColor: number,
    strokeColor?: number
): void {
    if (scene.textures.exists(key)) {
        return;
    }

    const graphics = scene.add.graphics();
    graphics.fillStyle(fillColor, 1);
    if (strokeColor !== undefined) {
        graphics.lineStyle(2, strokeColor, 1);
    }
    graphics.beginPath();
    graphics.moveTo(width / 2, 0);
    graphics.lineTo(width, height / 2);
    graphics.lineTo(width / 2, height);
    graphics.lineTo(0, height / 2);
    graphics.closePath();
    graphics.fillPath();
    if (strokeColor !== undefined) {
        graphics.strokePath();
    }
    graphics.generateTexture(key, width, height);
    graphics.destroy();
}

export interface BlockTexture {
    key: string;
    // Fraction (0-1) to use as the sprite's origin so the top face's center
    // — not the whole taller sprite's center — lands on IsoMath's grid
    // point, matching how flat diamond tiles are anchored.
    originY: number;
}

/**
 * Generates a simple low 3-sided iso "block" (a top diamond face plus two
 * shaded side walls) from one base color — a placeholder that actually
 * reads as a standing structure instead of a flat colored tile, without
 * needing real art. Anchored so it drops onto the same grid point a flat
 * tile would, extruded upward on screen from there.
 */
export function createPlaceholderBlockTexture(
    scene: Scene,
    key: string,
    tileWidth: number,
    tileHeight: number,
    wallHeight: number,
    baseColor: number,
    strokeColor?: number
): BlockTexture {
    const originY = tileHeight / 2 / (tileHeight + wallHeight);

    if (scene.textures.exists(key)) {
        return { key, originY };
    }

    const halfW = tileWidth / 2;
    const halfH = tileHeight / 2;
    const leftColor = shadeColor(baseColor, 0.75);
    const rightColor = shadeColor(baseColor, 0.55);

    const graphics = scene.add.graphics();

    graphics.fillStyle(leftColor, 1);
    graphics.beginPath();
    graphics.moveTo(0, halfH);
    graphics.lineTo(halfW, tileHeight);
    graphics.lineTo(halfW, tileHeight + wallHeight);
    graphics.lineTo(0, halfH + wallHeight);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(rightColor, 1);
    graphics.beginPath();
    graphics.moveTo(tileWidth, halfH);
    graphics.lineTo(halfW, tileHeight);
    graphics.lineTo(halfW, tileHeight + wallHeight);
    graphics.lineTo(tileWidth, halfH + wallHeight);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(baseColor, 1);
    if (strokeColor !== undefined) {
        graphics.lineStyle(2, strokeColor, 1);
    }
    graphics.beginPath();
    graphics.moveTo(halfW, 0);
    graphics.lineTo(tileWidth, halfH);
    graphics.lineTo(halfW, tileHeight);
    graphics.lineTo(0, halfH);
    graphics.closePath();
    graphics.fillPath();
    if (strokeColor !== undefined) {
        graphics.strokePath();
    }

    graphics.generateTexture(key, tileWidth, tileHeight + wallHeight);
    graphics.destroy();

    return { key, originY };
}
