/**
 * ch3_r9 — 高斯消元法的几何过程渲染器
 *
 * 并排显示消元前后的三平面系统。
 * 左：原始系统的3个平面 + 交点
 * 右：消元后的3个平面 + 同一交点
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPlane, drawPoint, drawDashedLine } from '../draw-utils.js';

export class Ch3R9GaussianRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        const sepX = 5.0;
        const planeColors = [0x4cc9f0, 0x06d6a0, 0xef476f];
        const planeAlphas = [0.2, 0.2, 0.2];

        // ─── 左侧：原始系统的3个平面 ─────────
        this._drawPlanes(group, sd.original_planes || [], planeColors, planeAlphas, -sepX);

        // ─── 右侧：消元后系统的3个平面 ───────
        this._drawPlanes(group, sd.eliminated_planes || [], planeColors, planeAlphas, sepX);

        // ─── 分隔 ────────────────────────────
        group.add(drawDashedLine(
            new THREE.Vector3(0, -5, -5),
            new THREE.Vector3(0, 5, 5),
            0x444466
        ));

        // ─── 消元步骤文本 ─────────────────────
        if (sd.steps && sd.steps.length > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 36;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`消元步数: ${sd.steps.length - 1} 步 → 行阶梯形`, 256, 22);
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            sprite.position.set(0, -4.5, -1);
            sprite.scale.set(4, 0.35, 1);
            group.add(sprite);
        }

        // ─── 标签 ────────────────────────────
        this._addLabel(group, '消元前', -sepX, 4.5, 0x4cc9f0);
        this._addLabel(group, '消元后（上三角）', sepX, 4.5, 0xffd166);
        this._addLabel(group, '→ 保持交点不变 →', 0, 0, 0xffffff);
    }

    _drawPlanes(group, planes, colors, alphas, offsetX) {
        if (!planes || planes.length < 3) return;

        planes.forEach((plane, idx) => {
            if (!plane.valid) return;

            const normal = new THREE.Vector3(
                plane.normal[0], plane.normal[1], plane.normal[2]
            );
            const d = plane.d;
            const color = colors[idx % colors.length];
            const alpha = alphas[idx % alphas.length];

            // 偏移：在 X 方向平移
            // 平面方程: normal · (x - offset) = d
            // 即 normal_x * (x_pos - offsetX) + normal_y * y + normal_z * z = d
            // normal_x * x_pos + normal_y * y + normal_z * z = d + normal_x * offsetX
            const adjustedD = d + normal.x * offsetX;

            group.add(drawPlane(normal, adjustedD, color, null, alpha, 4));
        });

        // 原点标记
        group.add(drawPoint(new THREE.Vector3(offsetX, 0, 0), 0xffffff, 0.06));
    }

    _addLabel(group, text, x, y, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 384; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(text, 192, 28);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(x, y, -1);
        sprite.scale.set(4, 0.55, 1);
        group.add(sprite);
    }
}
