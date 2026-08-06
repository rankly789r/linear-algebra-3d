/**
 * ch2_r4 — 克拉默法则渲染器
 *
 * 三个平行四边形并排显示：
 * - 原始 A（a₁, a₂）= 面积 det(A)
 * - A₁（b, a₂）= 面积 det(A₁) → x₁ = 面积₁/面积
 * - A₂（a₁, b）= 面积 det(A₂) → x₂ = 面积₂/面积
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawDashedLine, drawPoint } from '../draw-utils.js';

export class Ch2R4CramerRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd || !sd.transforms || sd.transforms.length === 0) return;

        const group = this.sceneObjects;
        const transforms = sd.transforms;
        const n = transforms.length;
        const sep = 4.0;
        const totalWidth = (n - 1) * sep;
        const startX = -totalWidth / 2;

        const colors = [0x4cc9f0, 0xef476f, 0x06d6a0];

        transforms.forEach((tform, idx) => {
            const offsetX = startX + idx * sep;
            const color = colors[idx % colors.length];
            const verts = tform.vertices || [];

            if (verts.length < 4) return;

            // 偏移顶点
            const ov = verts.map(v => [v[0] + offsetX, v[1], v[2]]);

            // ─── 填充面 ──────────────────────
            const geom = new THREE.BufferGeometry();
            const pos = new Float32Array(ov.slice(0, 3).flatMap(v => [v[0], v[1], v[2]]));
            geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geom.setIndex([0, 1, 2]);
            geom.computeVertexNormals();
            const faceMat = new THREE.MeshBasicMaterial({
                color, side: THREE.DoubleSide, transparent: true, opacity: 0.25, depthWrite: false,
            });
            group.add(new THREE.Mesh(geom, faceMat));

            // 第二个三角形
            const geom2 = new THREE.BufferGeometry();
            const pos2 = new Float32Array([ov[0], ov[2], ov[3]].flatMap(v => [v[0], v[1], v[2]]));
            geom2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
            geom2.setIndex([0, 1, 2]);
            geom2.computeVertexNormals();
            group.add(new THREE.Mesh(geom2, faceMat));

            // ─── 边 ──────────────────────────
            for (let i = 0; i < 4; i++) {
                const j = (i + 1) % 4;
                const lineGeom = new THREE.BufferGeometry();
                lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    ov[i][0], ov[i][1], ov[i][2],
                    ov[j][0], ov[j][1], ov[j][2],
                ]), 3));
                const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: true });
                group.add(new THREE.Line(lineGeom, lineMat));
            }

            // ─── 对角线 ──────────────────────
            group.add(drawDashedLine(
                new THREE.Vector3(...ov[0]),
                new THREE.Vector3(...ov[2]),
                0x666688
            ));

            // ─── 标签 ────────────────────────
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
            ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(tform.label || '', 128, 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px sans-serif';
            ctx.fillText(`面积 = ${tform.area?.toFixed(2) || '?'}`, 128, 44);
            if (tform.det !== undefined && tform.det < 0) {
                ctx.fillStyle = '#ef476f';
                ctx.fillText('(定向反转, det<0)', 128, 62);
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
            sprite.position.set(offsetX, -2.5, -0.5);
            sprite.scale.set(3.5, 0.9, 1);
            group.add(sprite);

            // ─── 原点标记 ────────────────────
            group.add(drawPoint(new THREE.Vector3(...ov[0]), 0xffffff, 0.08));
        });

        // ─── 公式标签 ──────────────────────
        if (Math.abs(sd.det_A) > 1e-10) {
            const x1 = sd.det_A1 / sd.det_A;
            const x2 = sd.det_A2 / sd.det_A;
            const formulaCanvas = document.createElement('canvas');
            formulaCanvas.width = 512; formulaCanvas.height = 80;
            const fctx = formulaCanvas.getContext('2d');
            fctx.fillStyle = '#ffffff';
            fctx.font = 'bold 22px sans-serif'; fctx.textAlign = 'center';
            fctx.fillText(
                `x₁ = ${sd.det_A1.toFixed(2)} / ${sd.det_A.toFixed(2)} = ${x1.toFixed(3)}    |    x₂ = ${sd.det_A2.toFixed(2)} / ${sd.det_A.toFixed(2)} = ${x2.toFixed(3)}`,
                256, 30
            );
            fctx.fillStyle = '#a0a0b8';
            fctx.font = '16px sans-serif';
            fctx.fillText('克拉默法则：解 = 面积比', 256, 58);
            const ftex = new THREE.CanvasTexture(formulaCanvas);
            ftex.minFilter = THREE.LinearFilter;
            const fsprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, transparent: true }));
            fsprite.position.set(0, 3.5, -0.5);
            fsprite.scale.set(7, 1.2, 1);
            group.add(fsprite);
        }
    }
}
