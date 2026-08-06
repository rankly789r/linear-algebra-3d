/**
 * ch3_r12 — 初等矩阵与行变换（左乘）渲染器
 *
 * 展示左乘初等矩阵 = 行变换的几何效果。
 * 两个形状并排：A 的形状 → E·A 的形状，动画从单位形状过渡。
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

const TRANSFORM_COLORS = [0x4cc9f0, 0xffd166];  // A: blue, EA: yellow


export class Ch3R12ElemRowRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.transforms || sd.transforms.length === 0) {
            return;
        }

        this._animData = sd;
        this._animT = 1.0;
        this._animating = false;

        const group = this.sceneObjects;
        const transforms = sd.transforms;
        const is3D = transforms[0]?.dim === 3;
        const n = transforms.length;
        const sep = is3D ? 4.0 : 3.5;
        const totalWidth = (n - 1) * sep;
        const startX = -totalWidth / 2;

        this._animShapes = [];

        transforms.forEach((tform, idx) => {
            const offsetX = startX + idx * sep;
            const color = TRANSFORM_COLORS[idx % TRANSFORM_COLORS.length];

            const unitVerts = tform.unit_shape.map(v =>
                [v[0] + offsetX, v[1], v[2]]
            );
            const transformedVerts = tform.transformed_shape.map(v =>
                [v[0] + offsetX, v[1], v[2]]
            );

            // ─── 单位形状（灰色虚线 ghost）──────────
            if (is3D) {
                CUBE_EDGES.forEach(([i, j]) => {
                    group.add(drawDashedLine(
                        new THREE.Vector3(...unitVerts[i]),
                        new THREE.Vector3(...unitVerts[j]),
                        0x555555
                    ));
                });
            } else {
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

            this._animShapes.push({ wire, face, unitVerts, transformedVerts, labelSprite: null });

            // ─── 箭头（从 A → EA）─────────────────
            if (idx < n - 1) {
                const nextOffsetX = startX + (idx + 1) * sep;
                const arrowFrom = new THREE.Vector3(offsetX + (is3D ? 1.5 : 1.3), is3D ? -2 : -1.5, 0);
                const arrowTo = new THREE.Vector3(nextOffsetX - (is3D ? 1.5 : 1.3), is3D ? -2 : -1.5, 0);
                const arrowDir = new THREE.Vector3().subVectors(arrowTo, arrowFrom);
                const arrowLen = arrowDir.length();
                const arrowMid = new THREE.Vector3().addVectors(arrowFrom, arrowTo).multiplyScalar(0.5);
                const arrow = new THREE.ArrowHelper(
                    arrowDir.normalize(), arrowFrom, arrowLen, 0xffffff, 0.3, 0.15
                );
                group.add(arrow);

                // E 标签
                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 128; labelCanvas.height = 48;
                const ctx = labelCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('左乘 E', 64, 17);
                ctx.fillStyle = '#a0a0b8';
                ctx.font = '14px sans-serif';
                ctx.fillText(sd.op_desc || '', 64, 36);
                const texture = new THREE.CanvasTexture(labelCanvas);
                texture.minFilter = THREE.LinearFilter;
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
                sprite.position.copy(arrowMid);
                sprite.position.y += 0.6;
                sprite.scale.set(2.0, 0.8, 1);
                group.add(sprite);
            }

            // ─── 标签 sprite ────────────────────────
            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 256; labelCanvas.height = 56;
            const ctx2 = labelCanvas.getContext('2d');
            ctx2.fillStyle = '#' + color.toString(16).padStart(6, '0');
            ctx2.font = 'bold 22px sans-serif'; ctx2.textAlign = 'center';
            ctx2.fillText(tform.label || '', 128, 22);
            if (tform.det !== undefined) {
                ctx2.fillStyle = '#a0a0b8';
                ctx2.font = '16px sans-serif';
                ctx2.fillText(`det = ${tform.det.toFixed(2)}`, 128, 44);
            }
            const texture2 = new THREE.CanvasTexture(labelCanvas);
            texture2.minFilter = THREE.LinearFilter;
            const sprite2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture2, transparent: true }));
            // 初始位置基于单位形状重心 + 底部偏移（动画中会跟随形状更新）
            const initCx = unitVerts.reduce((s, v) => s + v[0], 0) / unitVerts.length;
            const initMinY = Math.min(...unitVerts.map(v => v[1]));
            sprite2.position.set(initCx, initMinY - 0.7, -1);
            sprite2.scale.set(is3D ? 3 : 2.5, 0.6, 1);
            group.add(sprite2);
            // 存储引用以便在 _interpolateToT 中更新标签位置
            this._animShapes[this._animShapes.length - 1].labelSprite = sprite2;
        });

        // ─── 动画按钮 + 立即显示最终状态 ─────────────────
        this._addAnimControlUI('la_ch3r12_anim_auto');
        this._interpolateToT(1.0);
    }

    async _computeAndRender(params, showLoading) {
        await super._computeAndRender(params, showLoading);
        this._addAnimControlUI('la_ch3r12_anim_auto');
    }

    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;
        this._updateAnimButton('⟳ 变换中...', true);
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
