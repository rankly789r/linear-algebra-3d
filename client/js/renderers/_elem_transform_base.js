/**
 * _elem_transform_base — 初等变换渲染器共享基类
 *
 * ch3_r12（左乘/行变换）和 ch3_r13（右乘/列变换）共享完全相同的渲染逻辑，
 * 仅在颜色、箭头标签、localStorage key 三处不同。子类通过 static CONFIG 提供差异。
 *
 * 此文件不作为独立场景渲染器注册，仅供 ch3_r12 / ch3_r13 继承。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawDashedLine, COLORS, createUpdatableWireframe, createUpdatableFaces, EDGES_QUAD, FACES_QUAD } from '../draw-utils.js';

const CUBE_EDGES = [
    [0, 1], [0, 2], [0, 3], [1, 4], [1, 5],
    [2, 4], [2, 6], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7],
];

const CUBE_FACES = [
    [0, 1, 4], [0, 4, 2], [3, 5, 7], [3, 7, 6],
    [0, 1, 5], [0, 5, 3], [2, 4, 7], [2, 7, 6],
    [0, 2, 6], [0, 6, 3], [1, 4, 7], [1, 7, 5],
];


export class ElemTransformBaseRenderer extends SceneRenderer {

    /**
     * 子类必须覆盖 static CONFIG = { color: 0xRRGGBB, storageKey: 'la_...' }
     */
    static CONFIG = {
        color: 0xffd166,
        storageKey: 'la_chXrX_anim_auto',
    };

    /** 便捷访问子类配置 */
    get _cfg() { return this.constructor.CONFIG; }

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.transforms || sd.transforms.length < 2) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const transforms = sd.transforms;
        const is3D = transforms[0]?.dim === 3;
        const ghostVerts = transforms[0].unit_shape;               // 单位方形/立方体
        const animUnit = transforms[1].unit_shape;                 // A 作用后的顶点（起点）
        const animTarget = transforms[1].transformed_shape;        // EA/AE 作用后的顶点（终点）
        const animColor = this._cfg.color;                           // EA/AE 的颜色

        // ─── 虚线 ghost：单位方形参考（居中，不偏移）───
        if (is3D) {
            CUBE_EDGES.forEach(([i, j]) => {
                group.add(drawDashedLine(
                    new THREE.Vector3(...ghostVerts[i]),
                    new THREE.Vector3(...ghostVerts[j]),
                    0x555555
                ));
            });
        } else {
            for (let i = 0; i < 4; i++) {
                const j = (i + 1) % 4;
                group.add(drawDashedLine(
                    new THREE.Vector3(...ghostVerts[i]),
                    new THREE.Vector3(...ghostVerts[j]),
                    0x555555
                ));
            }
        }

        // ─── 动画线框 + 面：A 形状 → EA/AE 形状 ──────
        const edges = is3D ? CUBE_EDGES : EDGES_QUAD;
        const faces = is3D ? CUBE_FACES : FACES_QUAD;
        const alpha = is3D ? 0.12 : 0.2;

        const wire = createUpdatableWireframe(animUnit, edges, animColor, 0.9);
        const face = createUpdatableFaces(animUnit, faces, animColor, alpha);
        group.add(wire);
        group.add(face);

        this._animShapes = [{ wire, face, unitVerts: animUnit, transformedVerts: animTarget, labelSprite: null }];

        // ─── 形状标签 sprite ─────────────────────────
        const shapeLabelCanvas = document.createElement('canvas');
        shapeLabelCanvas.width = 256; shapeLabelCanvas.height = 56;
        const ctx = shapeLabelCanvas.getContext('2d');
        ctx.fillStyle = '#' + animColor.toString(16).padStart(6, '0');
        ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(transforms[1].label || '', 128, 22);
        if (transforms[1].det !== undefined) {
            ctx.fillStyle = '#a0a0b8';
            ctx.font = '16px sans-serif';
            ctx.fillText(`det = ${transforms[1].det.toFixed(2)}`, 128, 44);
        }
        const texture = new THREE.CanvasTexture(shapeLabelCanvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        const cx = animUnit.reduce((s, v) => s + v[0], 0) / animUnit.length;
        const minY = Math.min(...animUnit.map(v => v[1]));
        sprite.position.set(cx, minY - 0.7, -1);
        sprite.scale.set(is3D ? 3 : 2.5, 0.6, 1);
        group.add(sprite);
        this._animShapes[0].labelSprite = sprite;

        // ─── ghost 标签："A" 参考 ────────────────────
        const ghostLabelCanvas = document.createElement('canvas');
        ghostLabelCanvas.width = 128; ghostLabelCanvas.height = 32;
        const gctx = ghostLabelCanvas.getContext('2d');
        gctx.fillStyle = '#666688';
        gctx.font = '16px sans-serif'; gctx.textAlign = 'center';
        gctx.fillText(transforms[0].label || 'A', 64, 18);
        const gTexture = new THREE.CanvasTexture(ghostLabelCanvas);
        gTexture.minFilter = THREE.LinearFilter;
        const gSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTexture, transparent: true, opacity: 0.6 }));
        const gCx = ghostVerts.reduce((s, v) => s + v[0], 0) / ghostVerts.length;
        const gMinY = Math.min(...ghostVerts.map(v => v[1]));
        gSprite.position.set(gCx, gMinY - 0.5, -1);
        gSprite.scale.set(is3D ? 2.0 : 1.5, 0.5, 1);
        group.add(gSprite);

        this._addAnimControlUI(this._cfg.storageKey);
        this._interpolateToT(1.0);
    }

    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI(this._cfg.storageKey);
    }

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;
        this._updateAnimButton('⟳ 变换中...', true);
        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;
        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed * this.animSpeed / this._animDuration, 1.0);
        t = 1 - Math.pow(1 - t, 3);
        this._animT = t;
        this._updateAnimProgress(t);
        this._interpolateToT(t);
        if (t < 1.0) {
            this._animFrameId = requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
        }
    }

    _interpolateToT(t) {
        if (!this._animShapes) return;
        this._animShapes.forEach(({ wire, face, unitVerts, transformedVerts, labelSprite }) => {
            const interp = unitVerts.map((v, i) => [
                v[0] + (transformedVerts[i][0] - v[0]) * t,
                v[1] + (transformedVerts[i][1] - v[1]) * t,
                v[2] + (transformedVerts[i][2] - v[2]) * t,
            ]);
            wire.updateVertices(interp);
            face.updateVertices(interp);
            if (labelSprite) {
                const cx = interp.reduce((s, v) => s + v[0], 0) / interp.length;
                const minY = Math.min(...interp.map(v => v[1]));
                labelSprite.position.set(cx, minY - 0.7, -1);
            }
        });
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
    }
}
