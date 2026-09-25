import type { GameObjects } from 'phaser';
import { Scene } from 'phaser';
import { BUILDINGS } from '../data/buildings';
import { GOD_ABILITIES } from '../data/godAbilities';
import { slice01 } from '../data/mapDefs/slice01';
import { InputController } from '../input/InputController';
import {
    DEPTH_LAYER_BUILDING,
    DEPTH_LAYER_ENTITY,
    DEPTH_LAYER_GHOST,
    footprintDepth,
    GROUND_DEPTH,
    type GridPoint,
    gridToWorld,
    TILE_HEIGHT,
    TILE_WIDTH,
    tileDepth,
    worldToNearestGrid
} from '../iso/IsoMath';
import { BuildingSystem } from '../systems/BuildingSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { GodPowerSystem } from '../systems/GodPowerSystem';
import { PathingSystem } from '../systems/PathingSystem';
import { PopulationSystem } from '../systems/PopulationSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { WorshipSystem } from '../systems/WorshipSystem';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState, type LiveEnemy, type PlacedBuilding } from '../state/GameState';
import { AbilityBar } from '../ui/AbilityBar';
import { BuildMenu } from '../ui/BuildMenu';
import { GodPowerBar } from '../ui/GodPowerBar';
import { PopulationBar } from '../ui/PopulationBar';
import { ResourceBar } from '../ui/ResourceBar';
import { createPlaceholderBlockTexture, createPlaceholderDiamondTexture, shadeColor } from '../util/PlaceholderFactory';

const mapDef = slice01;
const BUILDING_WALL_HEIGHT = TILE_HEIGHT / 2;

// M2-M5: building placement (BuildMenu, ghost preview via inverse-
// projection, footprint/cost validation, the wall-off rule) lives in
// BuildingSystem; the resource tick lives in EconomySystem; population
// growth/happiness lives in PopulationSystem; faith/god-power lives in
// WorshipSystem + GodPowerSystem (the latter reacts to faith:generated
// rather than being ticked directly). This scene just renders whatever
// they decide and forwards frame time to each tick.
export class WorldScene extends Scene {
    private inputController?: InputController;
    private buildMenu?: BuildMenu;
    private abilityBar?: AbilityBar;
    private resourceBar?: ResourceBar;
    private populationBar?: PopulationBar;
    private godPowerBar?: GodPowerBar;
    private gameState!: GameState;
    private eventBus!: EventBus;
    private buildingSystem!: BuildingSystem;
    private economySystem!: EconomySystem;
    private populationSystem!: PopulationSystem;
    private worshipSystem!: WorshipSystem;
    private godPowerSystem!: GodPowerSystem;
    private pathingSystem!: PathingSystem;
    private waveSystem!: WaveSystem;

    private selectedDefId: string | null = null;
    private smiteArmed = false;
    private ghostImages: GameObjects.Image[] = [];
    private lastHoverCell: GridPoint | null = null;
    private lastGhostAffordable: boolean | null = null;
    private buildingOriginY = 0.5;
    private enemyImages = new Map<string, GameObjects.Image>();

    constructor() {
        super('World');
    }

    create() {
        // Checkered so individual cells actually read as a grid rather than
        // one flat green field.
        createPlaceholderDiamondTexture(this, 'placeholder-tile-a', TILE_WIDTH, TILE_HEIGHT, 0x4a7c3f, 0x3a6230);
        createPlaceholderDiamondTexture(this, 'placeholder-tile-b', TILE_WIDTH, TILE_HEIGHT, shadeColor(0x4a7c3f, 0.88), 0x3a6230);

        // Low 3-sided "blocks" instead of flat diamonds, so buildings read
        // as standing structures rather than colored floor tiles.
        const buildingTexture = createPlaceholderBlockTexture(
            this,
            'placeholder-building',
            TILE_WIDTH,
            TILE_HEIGHT,
            BUILDING_WALL_HEIGHT,
            0x8a6d3f,
            0x6b5230
        );
        this.buildingOriginY = buildingTexture.originY;
        createPlaceholderBlockTexture(this, 'placeholder-ghost-ok', TILE_WIDTH, TILE_HEIGHT, BUILDING_WALL_HEIGHT, 0x4a7cff);
        createPlaceholderBlockTexture(this, 'placeholder-ghost-bad', TILE_WIDTH, TILE_HEIGHT, BUILDING_WALL_HEIGHT, 0xd23b3b);
        createPlaceholderDiamondTexture(this, 'placeholder-smite-effect', TILE_WIDTH, TILE_HEIGHT, 0xfff2b0, 0xffd23b);
        // Smaller than a tile so a moving enemy reads as a unit standing on
        // the grid, not another tile-sized object.
        createPlaceholderDiamondTexture(this, 'placeholder-enemy', TILE_WIDTH * 0.5, TILE_HEIGHT * 0.5, 0x9c1f1f, 0x5c0f0f);

        this.gameState = createGameState();
        this.eventBus = new EventBus();
        this.buildingSystem = new BuildingSystem(this.gameState, this.eventBus, mapDef);
        this.economySystem = new EconomySystem(this.gameState, this.eventBus);
        this.populationSystem = new PopulationSystem(this.gameState, this.eventBus);
        this.worshipSystem = new WorshipSystem(this.gameState, this.eventBus);
        this.godPowerSystem = new GodPowerSystem(this.gameState, this.eventBus);
        this.pathingSystem = new PathingSystem(this.buildingSystem);
        this.waveSystem = new WaveSystem(this.gameState, this.eventBus, mapDef, this.pathingSystem);
        this.eventBus.on('building:placed', ({ building }) => this.renderBuilding(building));
        this.eventBus.on('enemy:spawned', ({ enemy }) => this.renderEnemy(enemy));
        this.eventBus.on('enemy:reachedCity', ({ enemyId }) => this.removeEnemyImage(enemyId));

        this.buildGroundPlane();
        this.setupCamera();

        this.inputController = new InputController(this, {
            onTileTapped: (cell) => this.handleTileTapped(cell)
        });

        this.buildMenu = new BuildMenu(Object.values(BUILDINGS), (defId) => {
            this.selectedDefId = defId;
            this.lastHoverCell = null;
            // Mutually exclusive with Smite targeting — a tap can only mean
            // one thing at a time.
            this.abilityBar?.setArmed(false);
            this.smiteArmed = false;
        });
        this.abilityBar = new AbilityBar(GOD_ABILITIES.smite, this.eventBus, this.godPowerSystem, (armed) => {
            this.smiteArmed = armed;
            if (armed) {
                this.selectedDefId = null;
                this.buildMenu?.deselect();
                this.clearGhost();
            }
        });
        this.resourceBar = new ResourceBar(this.gameState, this.eventBus);
        this.populationBar = new PopulationBar(this.gameState, this.eventBus);
        this.godPowerBar = new GodPowerBar(this.gameState, this.eventBus);

        this.events.once('shutdown', () => {
            this.inputController?.destroy();
            this.buildMenu?.destroy();
            this.abilityBar?.destroy();
            this.resourceBar?.destroy();
            this.populationBar?.destroy();
            this.godPowerBar?.destroy();
        });
    }

    update(_time: number, delta: number): void {
        const deltaSeconds = delta / 1000;
        // Deliberate order: buildings produce/consume resources first, then
        // population reacts to this tick's food (consumes upkeep, grows/
        // shrinks off the result), then worship reads this tick's
        // (possibly just-changed) population/happiness to generate faith.
        // GodPowerSystem's stat accrual isn't ticked here — it reacts to
        // WorshipSystem's faith:generated synchronously instead — but its
        // ability cooldowns are real-time, so those still need a tick.
        // WaveSystem (spawning/movement) is independent of the economy
        // chain above; it's last only because there's no ordering
        // requirement either way.
        this.economySystem.update(deltaSeconds);
        this.populationSystem.update(deltaSeconds);
        this.worshipSystem.update(deltaSeconds);
        this.godPowerSystem.update(deltaSeconds);
        this.waveSystem.update(deltaSeconds);
        this.abilityBar?.refresh();
        this.updateGhostPreview();
        this.updateEnemySprites();
    }

    private buildGroundPlane(): void {
        for (let gridY = 0; gridY < mapDef.rows; gridY++) {
            for (let gridX = 0; gridX < mapDef.cols; gridX++) {
                const { x, y } = gridToWorld(gridX, gridY);
                const textureKey = (gridX + gridY) % 2 === 0 ? 'placeholder-tile-a' : 'placeholder-tile-b';
                this.add.image(x, y, textureKey).setDepth(GROUND_DEPTH);
            }
        }
    }

    private setupCamera(): void {
        const corners = [
            gridToWorld(0, 0),
            gridToWorld(mapDef.cols - 1, 0),
            gridToWorld(0, mapDef.rows - 1),
            gridToWorld(mapDef.cols - 1, mapDef.rows - 1)
        ];
        const minX = Math.min(...corners.map((c) => c.x)) - TILE_WIDTH / 2;
        const maxX = Math.max(...corners.map((c) => c.x)) + TILE_WIDTH / 2;
        const minY = Math.min(...corners.map((c) => c.y)) - TILE_HEIGHT / 2;
        const maxY = Math.max(...corners.map((c) => c.y)) + TILE_HEIGHT / 2;

        const camera = this.cameras.main;
        // Padded so the grid's edge tiles can still be centered on screen
        // rather than clamping the camera hard against the grid bounds.
        camera.setBounds(
            minX - camera.width / 2,
            minY - camera.height / 2,
            maxX - minX + camera.width,
            maxY - minY + camera.height
        );
        camera.centerOn((minX + maxX) / 2, (minY + maxY) / 2);
    }

    private updateGhostPreview(): void {
        if (!this.selectedDefId) {
            this.clearGhost();
            return;
        }

        const pointer = this.input.activePointer;
        if (pointer.downTime === 0 && pointer.moveTime === 0) {
            // Pointer hasn't actually been used yet (fresh page load, or a
            // touch device before the first touch) — its x/y are Phaser
            // defaults, not a real cursor position.
            return;
        }
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const def = BUILDINGS[this.selectedDefId];
        // Same screen -> grid conversion InputController uses for taps, so
        // the ghost lines up exactly with what tapping there will do.
        const hovered = worldToNearestGrid(worldPoint.x, worldPoint.y);
        // Affordability changes continuously now that resources tick
        // (EconomySystem) — a still-hovered cell can flip from unaffordable
        // to affordable without the pointer ever moving, and the ghost is
        // the only feedback for that, so the cache has to track it too.
        const affordable = this.buildingSystem.canAfford(def);

        if (
            this.lastHoverCell &&
            this.lastHoverCell.gridX === hovered.gridX &&
            this.lastHoverCell.gridY === hovered.gridY &&
            this.lastGhostAffordable === affordable
        ) {
            return;
        }
        this.lastHoverCell = hovered;
        this.lastGhostAffordable = affordable;

        this.clearGhost();

        const check = this.buildingSystem.canPlace(this.selectedDefId, hovered.gridX, hovered.gridY);
        const textureKey = check.ok ? 'placeholder-ghost-ok' : 'placeholder-ghost-bad';
        // Its own layer, above DEPTH_LAYER_BUILDING: hovering an occupied
        // cell must show the ghost, not have it hidden by the building it's
        // warning you can't build on top of.
        const depth = footprintDepth(hovered.gridX, hovered.gridY, def.footprint.width, def.footprint.height, DEPTH_LAYER_GHOST);

        for (const ghostCell of this.buildingSystem.footprintCells(def, hovered.gridX, hovered.gridY)) {
            const { x, y } = gridToWorld(ghostCell.gridX, ghostCell.gridY);
            const image = this.add.image(x, y, textureKey).setOrigin(0.5, this.buildingOriginY).setAlpha(0.6).setDepth(depth);
            this.ghostImages.push(image);
        }
    }

    private clearGhost(): void {
        for (const image of this.ghostImages) {
            image.destroy();
        }
        this.ghostImages = [];
    }

    private handleTileTapped(cell: GridPoint): void {
        if (this.smiteArmed) {
            this.handleSmiteTapped(cell);
            return;
        }

        if (!this.selectedDefId) {
            return;
        }

        const result = this.buildingSystem.place(this.selectedDefId, cell.gridX, cell.gridY);
        if (result.ok) {
            // Rendering happens via the 'building:placed' subscription in
            // create(). Deselect rather than leaving the def armed: with the
            // pointer still sitting on the now-occupied cell, an armed
            // ghost would immediately redraw red right on top of the
            // building that was just placed, reading as a failure when it
            // wasn't one. Arm again from the menu for the next placement.
            this.selectedDefId = null;
            this.buildMenu?.deselect();
            this.clearGhost();
            this.lastHoverCell = null;
            this.lastGhostAffordable = null;
        }
    }

    private handleSmiteTapped(cell: GridPoint): void {
        const result = this.godPowerSystem.tryCast('smite');
        if (!result.ok) {
            return;
        }

        this.eventBus.emit('ability:cast', { abilityId: 'smite', gridX: cell.gridX, gridY: cell.gridY });
        this.playSmiteEffect(cell);

        // Single-shot per arm, same UX decision as building placement: stay
        // armed and the pointer sitting on the same cell would just try (and
        // fail, on-cooldown) to cast again next frame's tap.
        this.smiteArmed = false;
        this.abilityBar?.setArmed(false);
    }

    private playSmiteEffect(cell: GridPoint): void {
        const { x, y } = gridToWorld(cell.gridX, cell.gridY);
        const effect = this.add
            .image(x, y, 'placeholder-smite-effect')
            .setOrigin(0.5, 0.5)
            .setDepth(footprintDepth(cell.gridX, cell.gridY, 1, 1, DEPTH_LAYER_GHOST));
        this.time.delayedCall(400, () => effect.destroy());
    }

    private renderBuilding(building: PlacedBuilding): void {
        const def = BUILDINGS[building.defId];
        const depth = footprintDepth(building.gridX, building.gridY, def.footprint.width, def.footprint.height, DEPTH_LAYER_BUILDING);

        for (const cell of this.buildingSystem.footprintCells(def, building.gridX, building.gridY)) {
            const { x, y } = gridToWorld(cell.gridX, cell.gridY);
            this.add.image(x, y, 'placeholder-building').setOrigin(0.5, this.buildingOriginY).setDepth(depth);
        }
    }

    private renderEnemy(enemy: LiveEnemy): void {
        const image = this.add.image(enemy.x, enemy.y, 'placeholder-enemy').setOrigin(0.5, 0.5);
        this.enemyImages.set(enemy.id, image);
    }

    private removeEnemyImage(enemyId: string): void {
        this.enemyImages.get(enemyId)?.destroy();
        this.enemyImages.delete(enemyId);
    }

    // "Live depth recompute": an enemy's depth is derived from its current
    // continuous position, not the grid cell it spawned in, so it sorts
    // correctly against buildings/ground as it physically crosses cells —
    // per the plan's M7 deliverable and the M1 depth-sort acceptance
    // criterion this satisfies for a moving entity.
    private updateEnemySprites(): void {
        for (const enemy of this.gameState.enemies) {
            const image = this.enemyImages.get(enemy.id);
            if (!image) {
                continue;
            }
            image.setPosition(enemy.x, enemy.y);
            const { gridX, gridY } = worldToNearestGrid(enemy.x, enemy.y);
            image.setDepth(tileDepth(gridX, gridY, DEPTH_LAYER_ENTITY));
        }
    }
}
