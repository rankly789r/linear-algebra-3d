/**
 * 场景 2.0 渲染器：矩阵乘法的几何含义
 *
 * 动画展示：四个正方形从原始形状平滑变形到各自变换结果。
 * 白色 □ = 原始（不变），蓝色 = B变换，绿色 = A(B(□))，黄色 = (AB)□。
 *
 * 重构于 2026-08-06：动画系统
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { createUpdatableWireframe, createUpdatableFaces, createAnimatableArrow, EDGES_QUAD, FACES_QUAD } from '../draw-utils.js';

/** 创建原始→目标的偏移单位正方形 */
function offsetSquare(vs, dx) {
    return vs.map(v => [v[0] + dx, v[1], v[2]]);
}


export class MatrixMultiplyRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const sep = sd.separation || 3.5;

        const unitSquare = [
            [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        ];

        // ─── 形状动画数据 ──────────────────────────────
        const shapeDefs = [
            { key: 'original', color: 0xffffff, opacity: 0.5, offset: 0,
              target: sd.shape_original || unitSquare },
            { key: 'B', color: 0x4cc9f0, opacity: 0.7, offset: sep,
              target: sd.shape_B },
            { key: 'A_of_B', color: 0x06d6a0, opacity: 0.7, offset: sep * 2,
              target: sd.shape_A_of_B },
            { key: 'C', color: 0xffd166, opacity: 0.8, offset: sep * 3,
              target: sd.shape_C },
        ];

        this._animShapes = [];

        shapeDefs.forEach(def => {
            if (!def.target || def.target.length < 4) return;
            const orig = offsetSquare(unitSquare, def.offset);
            const wire = createUpdatableWireframe(orig, EDGES_QUAD, def.color, def.opacity);
            const face = createUpdatableFaces(orig, FACES_QUAD, def.color, 0.12);
            group.add(wire);
            group.add(face);
            this._animShapes.push({ wire, face, original: orig, target: def.target });
        });

        // ─── 样本向量 ──────────────────────────────────
        const sv = sd.sample_vector;
        this._animVectors = [];
        if (sv) {
            const vecDefs = [
                { end: sv.original, color: 0xffffff, label: 'v' },
                { end: sv.B_result, color: 0x4cc9f0, label: 'Bv' },
                { end: sv.A_of_B_result, color: 0x06d6a0, label: 'A(Bv)' },
                { end: sv.C_result, color: 0xffd166, label: '(AB)v' },
            ];
            vecDefs.forEach(def => {
                if (!def.end) return;
                const originPos = [0, 0, 0];
                const vec = createAnimatableArrow(originPos, def.color, def.label);
                group.add(vec);
                this._animVectors.push({ vec, start: originPos, end: def.end });
            });
        }

        // ─── 每个形状的独立标签 sprite ──────────────────
        const labelDefs = [
            { text: '原始', color: 0xffffff, shapeIdx: 0 },
            { text: 'B', color: 0x4cc9f0, shapeIdx: 1 },
            { text: 'A(B)', color: 0x06d6a0, shapeIdx: 2 },
            { text: 'AB', color: 0xffd166, shapeIdx: 3 },
        ];
        labelDefs.forEach(def => {
            if (!this._animShapes[def.shapeIdx]) return;
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 192; labelCanvas.height = 48;
            const ctx = labelCanvas.getContext('2d');
            ctx.fillStyle = '#' + def.color.toString(16).padStart(6, '0');
            ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.text, 96, 24);
            const texture = new THREE.CanvasTexture(labelCanvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            // 初始位置：形状中心下方
            const shape = this._animShapes[def.shapeIdx];
            const cx = shape.original.reduce((s, v) => s + v[0], 0) / shape.original.length;
            const minY = Math.min(...shape.original.map(v => v[1]));
            sprite.position.set(cx, minY - 0.7, -1);
            sprite.scale.set(1.8, 0.45, 1);
            group.add(sprite);
            shape.labelSprite = sprite;
        });

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimControlUI('la_ch2r0_anim_auto');
        this._interpolateToT(1.0);
    }

    // ═══════════════════════════════════════════════════════
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_ch2r0_anim_auto');
    }

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1600;
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
        // 插值形状（每个形状独立插值）
        if (this._animShapes) {
            this._animShapes.forEach(({ wire, face, original, target, labelSprite }) => {
                const interp = original.map((v, i) => [
                    v[0] + (target[i][0] - v[0]) * t,
                    v[1] + (target[i][1] - v[1]) * t,
                    v[2] + (target[i][2] - v[2]) * t,
                ]);
                wire.updateVertices(interp);
                face.updateVertices(interp);
                // 标签吸附：跟随形状重心移动
                if (labelSprite) {
                    const cx = interp.reduce((s, v) => s + v[0], 0) / interp.length;
                    const minY = Math.min(...interp.map(v => v[1]));
                    labelSprite.position.set(cx, minY - 0.7, -1);
                }
            });
        }

        // 插值向量
        if (this._animVectors) {
            this._animVectors.forEach(({ vec, start, end }) => {
                const interp = [
                    start[0] + (end[0] - start[0]) * t,
                    start[1] + (end[1] - start[1]) * t,
                    start[2] + (end[2] - start[2]) * t,
                ];
                vec.update(interp);
            });
        }
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
    }
}
