/**
 * ch1_r3 — 排列、对换与空间定向渲染器
 *
 * 两个平行四边形并排 + 法向量方向指示定向
 * 左：原始排列 → 右：交换列后的排列
 * 定向箭头反转 = 行列式变号
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawDashedLine, drawPoint } from '../draw-utils.js';

export class Ch1R3PermutationRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.transforms || sd.transforms.length < 2) return;

        const group = this.sceneObjects;
        const [tA, tAs] = sd.transforms;
        const sep = 5.0;
        const colors = [0x4cc9f0, 0xef476f];  // blue=original, red=swapped

        [tA, tAs].forEach((tform, idx) => {
            const offsetX = (idx - 0.5) * sep;
            const color = colors[idx];
            const verts = tform.vertices || [];
            if (verts.length < 4) return;

            const ov = verts.map(v => [v[0] + offsetX, v[1], v[2]]);

            // ─── 填充面 ──────────────────────
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(
                new Float32Array([ov[0], ov[1], ov[2]].flatMap(v => [v[0], v[1], v[2]])), 3));
            geom.setIndex([0, 1, 2]);
            geom.computeVertexNormals();
            const faceMat = new THREE.MeshBasicMaterial({
                color, side: THREE.DoubleSide, transparent: true, opacity: 0.25, depthWrite: false,
            });
            group.add(new THREE.Mesh(geom, faceMat));

            const geom2 = new THREE.BufferGeometry();
            geom2.setAttribute('position', new THREE.BufferAttribute(
                new Float32Array([ov[0], ov[2], ov[3]].flatMap(v => [v[0], v[1], v[2]])), 3));
            geom2.setIndex([0, 1, 2]);
            geom2.computeVertexNormals();
            group.add(new THREE.Mesh(geom2, faceMat));

            // ─── 边 ──────────────────────────
            for (let i = 0; i < 4; i++) {
                const j = (i + 1) % 4;
                const lGeom = new THREE.BufferGeometry();
                lGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    ov[i][0], ov[i][1], ov[i][2],
                    ov[j][0], ov[j][1], ov[j][2],
                ]), 3));
                group.add(new THREE.Line(lGeom, new THREE.LineBasicMaterial({ color, depthTest: true })));
            }

            // ─── 法向量（定向指示器） ────────
            // 平行四边形中心
            const cx = (ov[0][0] + ov[2][0]) / 2;
            const cy = (ov[0][1] + ov[2][1]) / 2;
            const center = new THREE.Vector3(cx, cy, 0);

            // 法向量方向 = (v1-v0) × (v3-v0) 归一化
            const e1 = new THREE.Vector3(ov[1][0] - ov[0][0], ov[1][1] - ov[0][1], 0);
            const e2 = new THREE.Vector3(ov[3][0] - ov[0][0], ov[3][1] - ov[0][1], 0);
            const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();

            const arrowLen = 1.5;
            const arrow = new THREE.ArrowHelper(normal, center, arrowLen, color, 0.2, 0.12);
            group.add(arrow);

            // ─── 标签 ────────────────────────
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
            ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(tform.label || '', 128, 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px sans-serif';
            ctx.fillText(`det = ${tform.det?.toFixed(2) || '?'}`, 128, 44);
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            sprite.position.set(offsetX, (tform.det || 0) >= 0 ? -2.8 : -3.2, -0.5);
            sprite.scale.set(3.5, 0.9, 1);
            group.add(sprite);

            // 原点
            group.add(drawPoint(new THREE.Vector3(...ov[0]), 0xffffff, 0.06));
        });

        // ─── 对换箭头 ─────────────────────
        const midX = 0;
        const arrowFrom = new THREE.Vector3(-1.0, -2, 0);
        const arrowTo = new THREE.Vector3(1.0, -2, 0);
        const arrowDir = new THREE.Vector3().subVectors(arrowTo, arrowFrom);
        group.add(new THREE.ArrowHelper(arrowDir.normalize(), arrowFrom, arrowDir.length(), 0xffffff, 0.3, 0.15));

        // 翻转公式标签
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`一次对换 → 定向反转 → det 变号！|det| 不变`, 256, 28);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(0, 3.5, -0.5);
        sprite.scale.set(6, 0.6, 1);
        group.add(sprite);
    }
}
