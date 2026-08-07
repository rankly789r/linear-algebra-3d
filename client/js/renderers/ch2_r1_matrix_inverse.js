/**
 * 场景 2.1 渲染器：逆矩阵的几何含义
 *
 * 动画展示：可逆时，A 变换后 A⁻¹ 完美还原；不可逆时，降维无法逆转。
 * 重构于 2026-08-06：动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { createUpdatableWireframe, createUpdatableFaces, EDGES_QUAD, FACES_QUAD } from '../draw-utils.js';

const UNIT_SQUARE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];

function offsetVertices(vs, dx) {
    return vs.map(v => [v[0] + dx, v[1], v[2]]);
}


export class MatrixInverseRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        this._animShapes = [];

        if (sd.invertible && sd.shape_restored) {
            const offset = sd.offset || 3.0;

            // ─── 三形状动画 ──────────────────────────
            const shapeDefs = [
                { target: sd.shape_original, color: 0xffffff, opacity: 0.5, dx: -offset },
                { target: sd.shape_after_A, color: 0x4cc9f0, opacity: 0.7, dx: 0 },
                { target: sd.shape_restored, color: 0x06d6a0, opacity: 0.8, dx: offset },
            ];

            shapeDefs.forEach(def => {
                if (!def.target || def.target.length < 4) return;
                const orig = offsetVertices(UNIT_SQUARE, def.dx);
                const wire = createUpdatableWireframe(orig, EDGES_QUAD, def.color, def.opacity);
                const face = createUpdatableFaces(orig, FACES_QUAD, def.color, 0.12);
                group.add(wire);
                group.add(face);
                this._animShapes.push({ wire, face, original: orig, target: def.target });
            });

            // ─── 每个形状的独立标签 ──────────────────
            const invLabelDefs = [
                { text: '原始', color: 0xffffff, shapeIdx: 0 },
                { text: 'A', color: 0x4cc9f0, shapeIdx: 1 },
                { text: 'A^{-1}(A)', color: 0x06d6a0, shapeIdx: 2 },
            ];
            invLabelDefs.forEach(def => {
                if (!this._animShapes[def.shapeIdx]) return;
                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 192; labelCanvas.height = 48;
                const ctx = labelCanvas.getContext('2d');
                ctx.fillStyle = '#' + def.color.toString(16).padStart(6, '0');
                ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(def.text, 96, 24);
                const texture = new THREE.CanvasTexture(labelCanvas);
                texture.minFilter = THREE.LinearFilter;
                const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
                const shape = this._animShapes[def.shapeIdx];
                const cx = shape.original.reduce((s, v) => s + v[0], 0) / shape.original.length;
                const minY = Math.min(...shape.original.map(v => v[1]));
                sp.position.set(cx, minY - 0.7, -1);
                sp.scale.set(2.0, 0.5, 1);
                group.add(sp);
                shape.labelSprite = sp;
            });

        } else {
            // ─── 不可逆：两形状 ──────────────────────
            const shapeDefs = [
                { target: sd.shape_original, color: 0xffffff, opacity: 0.5, dx: -2 },
                { target: sd.shape_after_A, color: 0xef476f, opacity: 0.7, dx: 2 },
            ];

            shapeDefs.forEach(def => {
                if (!def.target || def.target.length < 4) return;
                const orig = offsetVertices(UNIT_SQUARE, def.dx);
                const wire = createUpdatableWireframe(orig, EDGES_QUAD, def.color, def.opacity);
                const face = createUpdatableFaces(orig, FACES_QUAD, def.color, 0.12);
                group.add(wire);
                group.add(face);
                this._animShapes.push({ wire, face, original: orig, target: def.target });
            });

            const singLabelDefs = [
                { text: '原始', color: 0xffffff, shapeIdx: 0 },
                { text: 'A（降维）', color: 0xef476f, shapeIdx: 1 },
            ];
            singLabelDefs.forEach(def => {
                if (!this._animShapes[def.shapeIdx]) return;
                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 192; labelCanvas.height = 48;
                const ctx = labelCanvas.getContext('2d');
                ctx.fillStyle = '#' + def.color.toString(16).padStart(6, '0');
                ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(def.text, 96, 24);
                const texture = new THREE.CanvasTexture(labelCanvas);
                texture.minFilter = THREE.LinearFilter;
                const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
                const shape = this._animShapes[def.shapeIdx];
                const cx = shape.original.reduce((s, v) => s + v[0], 0) / shape.original.length;
                const minY = Math.min(...shape.original.map(v => v[1]));
                sp.position.set(cx, minY - 0.7, -1);
                sp.scale.set(2.2, 0.55, 1);
                group.add(sp);
                shape.labelSprite = sp;
            });

            // 全局提示文字（不可逆说明）
            const tipCanvas = document.createElement('canvas');
            tipCanvas.width = 384; tipCanvas.height = 40;
            const tipCtx = tipCanvas.getContext('2d');
            tipCtx.fillStyle = '#ffd166';
            tipCtx.font = 'bold 18px sans-serif'; tipCtx.textAlign = 'center';
            tipCtx.fillText('不可逆——降维过程无法逆转', 192, 22);
            const tipTexture = new THREE.CanvasTexture(tipCanvas);
            tipTexture.minFilter = THREE.LinearFilter;
            const tipSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tipTexture, transparent: true }));
            tipSprite.position.set(0, -3, -1);
            tipSprite.scale.set(5, 0.55, 1);
            group.add(tipSprite);
        }

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimControlUI();
        this._interpolateToT(1.0);
    }

    // ═══════════════════════════════════════════════════════
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI();
    }

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;
        this._updateAnimButton('⟳ 动画中...', true);
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
        this._animShapes.forEach(({ wire, face, original, target, labelSprite }) => {
            const interp = original.map((v, i) => [
                v[0] + (target[i][0] - v[0]) * t,
                v[1] + (target[i][1] - v[1]) * t,
                v[2] + (target[i][2] - v[2]) * t,
            ]);
            wire.updateVertices(interp);
            face.updateVertices(interp);
            // 标签吸附：跟随形状重心
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
