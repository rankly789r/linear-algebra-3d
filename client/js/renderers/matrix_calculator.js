/**
 * 矩阵计算器渲染器 — 3D 变换可视化
 *
 * 当矩阵为 2×2 或 3×3 方阵时，在 3D 视图中显示单位正方形/立方体
 * 到变换后形状的动画。
 *
 * 重构于 2026-08-06：添加动画系统
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

/** 形状颜色轮换 */
const TRANSFORM_COLORS = [0x4cc9f0, 0x06d6a0, 0xffd166, 0xef476f, 0xffffff];


export class MatrixCalculatorRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.transforms || sd.transforms.length === 0) {
            // 无可视化的变换数据（非方阵），清空 3D 场景
            return;
        }

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const transforms = sd.transforms;
        const is3D = transforms[0]?.dim === 3;

        // 并排显示需要的偏移量
        const n = transforms.length;
        const sep = is3D ? 3.5 : 3.0;
        const totalWidth = (n - 1) * sep;
        const startX = -totalWidth / 2;

        this._animShapes = [];

        transforms.forEach((tform, idx) => {
            const offsetX = startX + idx * sep;
            const color = TRANSFORM_COLORS[idx % TRANSFORM_COLORS.length];

            // 单位形状顶点（偏移后）
            const unitVerts = tform.unit_shape.map(v =>
                [v[0] + offsetX, v[1], v[2]]
            );

            // 变换后的形状（偏移后）
            const transformedVerts = tform.transformed_shape.map(v =>
                [v[0] + offsetX, v[1], v[2]]
            );

            // ─── 原始形状（灰色虚线 ghost） ──────────
            if (is3D) {
                // 3D：画单位立方体的虚线边
                const edgePairs = CUBE_EDGES;
                edgePairs.forEach(([i, j]) => {
                    group.add(drawDashedLine(
                        new THREE.Vector3(...unitVerts[i]),
                        new THREE.Vector3(...unitVerts[j]),
                        0x555555
                    ));
                });
            } else {
                // 2D：画单位正方形的虚线边
                for (let i = 0; i < 4; i++) {
                    const j = (i + 1) % 4;
                    group.add(drawDashedLine(
                        new THREE.Vector3(...unitVerts[i]),
                        new THREE.Vector3(...unitVerts[j]),
                        0x555555
                    ));
                }
            }

            // ─── 动画线框 + 面 ─────────────────────
            const edges = is3D ? CUBE_EDGES : EDGES_QUAD;
            const faces = is3D ? CUBE_FACES : FACES_QUAD;
            const alpha = is3D ? 0.12 : 0.2;

            const wire = createUpdatableWireframe(unitVerts, edges, color, 0.9);
            const face = createUpdatableFaces(unitVerts, faces, color, alpha);
            group.add(wire);
            group.add(face);

            this._animShapes.push({
                wire, face, unitVerts, transformedVerts, labelSprite: null,
            });

            // ─── 标签 sprite ────────────────────────
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 256; labelCanvas.height = 56;
            const ctx = labelCanvas.getContext('2d');
            ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
            ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(tform.label || '', 128, 22);
            if (tform.det !== undefined) {
                ctx.fillStyle = '#a0a0b8';
                ctx.font = '18px sans-serif';
                ctx.fillText(`det = ${tform.det.toFixed(2)}`, 128, 46);
            }
            const texture = new THREE.CanvasTexture(labelCanvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            // 初始位置基于单位形状重心 + 底部偏移（动画中会跟随形状更新）
            const initCx = unitVerts.reduce((s, v) => s + v[0], 0) / unitVerts.length;
            const initMinY = Math.min(...unitVerts.map(v => v[1]));
            sprite.position.set(initCx, initMinY - 0.7, -1);
            sprite.scale.set(is3D ? 3 : 2.5, 0.6, 1);
            group.add(sprite);
            // 存储引用以便在 _interpolateToT 中更新标签位置
            this._animShapes[this._animShapes.length - 1].labelSprite = sprite;
        });

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimControlUI('la_matrix_calc_anim_auto');
        this._interpolateToT(1.0);
    }

    // ═══════════════════════════════════════════════════════
    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_matrix_calc_anim_auto');
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
        let t = Math.min(elapsed / this._animDuration, 1.0);
        t = 1 - Math.pow(1 - t, 3);

        this._animT = t;
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
            // 标签吸附：跟随形状重心移动
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
