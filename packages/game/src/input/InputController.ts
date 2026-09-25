import { Math as PhaserMath, type Cameras, type Input, type Scene } from 'phaser';
import { type GridPoint, worldToNearestGrid } from '../iso/IsoMath';

export interface InputControllerConfig {
    minZoom?: number;
    maxZoom?: number;
    wheelZoomStep?: number;
    onTileTapped?: (cell: GridPoint) => void;
}

const TAP_MOVE_THRESHOLD = 6;

/**
 * Wraps Phaser's raw pointer/wheel events into the platform-agnostic
 * intents the plan calls for: onPan/onZoom (drag or single-finger touch to
 * pan, wheel or two-finger pinch to zoom, applied straight to the camera)
 * and onTileTapped (a down+up with no drag and no pinch, converted from
 * screen space to a grid cell here — not via per-sprite hit areas, per the
 * plan's isometric-input note).
 */
export class InputController {
    private readonly scene: Scene;
    private readonly camera: Cameras.Scene2D.Camera;
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly wheelZoomStep: number;
    private readonly onTileTapped?: (cell: GridPoint) => void;

    private isPanning = false;
    // Tracked ourselves (rather than Phaser's Pointer.prevPosition) so that
    // switching from a two-finger pinch back down to a single pointer can't
    // apply a jump from a stale previous position.
    private lastPanX = 0;
    private lastPanY = 0;
    private lastPinchDistance = -1;

    // True only while a gesture that began with a canvas pointerdown is in
    // progress. Without this, clicking a DOM overlay button (BuildMenu) —
    // which never fires a canvas pointerdown — could still leave a stale
    // "clean tap" state from whatever gesture happened before it, and the
    // resulting pointerupoutside would place a building under the menu.
    private gestureActive = false;
    private gestureStartX = 0;
    private gestureStartY = 0;
    private gestureMoved = false;
    private gestureHadPinch = false;

    constructor(scene: Scene, config: InputControllerConfig = {}) {
        this.scene = scene;
        this.camera = scene.cameras.main;
        this.minZoom = config.minZoom ?? 0.5;
        this.maxZoom = config.maxZoom ?? 2;
        this.wheelZoomStep = config.wheelZoomStep ?? 0.1;
        this.onTileTapped = config.onTileTapped;

        // A second simultaneous pointer is needed to recognize pinch-zoom.
        scene.input.addPointer(1);

        scene.input.on('pointerdown', this.onPointerDown, this);
        scene.input.on('pointermove', this.onPointerMove, this);
        scene.input.on('pointerup', this.onPointerUp, this);
        scene.input.on('pointerupoutside', this.onPointerUp, this);
        scene.input.on('wheel', this.onWheel, this);
    }

    destroy(): void {
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.input.off('pointerupoutside', this.onPointerUp, this);
        this.scene.input.off('wheel', this.onWheel, this);
    }

    private get activePointers(): Input.Pointer[] {
        return this.scene.input.manager.pointers.filter((pointer) => pointer.isDown);
    }

    private beginPanningAt(x: number, y: number): void {
        this.isPanning = true;
        this.lastPanX = x;
        this.lastPanY = y;
    }

    private onPointerDown = (pointer: Input.Pointer): void => {
        if (this.activePointers.length === 1) {
            this.beginPanningAt(pointer.x, pointer.y);
            this.gestureActive = true;
            this.gestureStartX = pointer.x;
            this.gestureStartY = pointer.y;
            this.gestureMoved = false;
            this.gestureHadPinch = false;
        } else {
            // A second pointer joined an existing gesture: no longer a tap.
            this.isPanning = false;
            this.gestureHadPinch = true;
        }
    };

    private onPointerMove = (pointer: Input.Pointer): void => {
        const pointers = this.activePointers;

        if (pointers.length >= 2) {
            this.isPanning = false;
            this.gestureHadPinch = true;
            this.handlePinch(pointers[0], pointers[1]);
            return;
        }

        this.lastPinchDistance = -1;

        if (this.isPanning && pointer.isDown) {
            this.camera.scrollX -= (pointer.x - this.lastPanX) / this.camera.zoom;
            this.camera.scrollY -= (pointer.y - this.lastPanY) / this.camera.zoom;
            this.lastPanX = pointer.x;
            this.lastPanY = pointer.y;

            if (!this.gestureMoved) {
                const dx = pointer.x - this.gestureStartX;
                const dy = pointer.y - this.gestureStartY;
                if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) {
                    this.gestureMoved = true;
                }
            }
        }
    };

    private onPointerUp = (pointer: Input.Pointer): void => {
        this.lastPinchDistance = -1;

        const pointers = this.activePointers;
        if (pointers.length === 1) {
            // Re-baseline against the still-down pointer's current position
            // (not wherever it was during the pinch) so panning resumes
            // cleanly with no jump.
            this.beginPanningAt(pointers[0].x, pointers[0].y);
        } else {
            this.isPanning = false;
        }

        if (pointers.length === 0) {
            if (this.gestureActive && !this.gestureMoved && !this.gestureHadPinch) {
                this.emitTileTapped(pointer.x, pointer.y);
            }
            this.gestureActive = false;
        }
    };

    private handlePinch(a: Input.Pointer, b: Input.Pointer): void {
        const distance = PhaserMath.Distance.Between(a.x, a.y, b.x, b.y);

        if (this.lastPinchDistance > 0) {
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            this.zoomBy(distance / this.lastPinchDistance, midX, midY);
        }

        this.lastPinchDistance = distance;
    }

    // Reads Pointer.deltaY directly rather than relying on the 'wheel'
    // event's positional callback args, whose order isn't confirmed for
    // Phaser 4 in this codebase.
    private onWheel = (pointer: Input.Pointer): void => {
        const factor = pointer.deltaY > 0 ? 1 - this.wheelZoomStep : 1 + this.wheelZoomStep;
        this.zoomBy(factor, pointer.x, pointer.y);
    };

    // Zooms while keeping the world point under (screenX, screenY) fixed on
    // screen, by measuring that point before/after the zoom change and
    // shifting scroll to cancel out the difference.
    private zoomBy(factor: number, screenX: number, screenY: number): void {
        const worldPointBefore = this.camera.getWorldPoint(screenX, screenY);
        const newZoom = PhaserMath.Clamp(this.camera.zoom * factor, this.minZoom, this.maxZoom);
        this.camera.setZoom(newZoom);

        const worldPointAfter = this.camera.getWorldPoint(screenX, screenY);
        this.camera.scrollX += worldPointBefore.x - worldPointAfter.x;
        this.camera.scrollY += worldPointBefore.y - worldPointAfter.y;
    }

    private emitTileTapped(screenX: number, screenY: number): void {
        if (!this.onTileTapped) {
            return;
        }
        const worldPoint = this.camera.getWorldPoint(screenX, screenY);
        this.onTileTapped(worldToNearestGrid(worldPoint.x, worldPoint.y));
    }
}
