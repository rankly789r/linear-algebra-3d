/**
 * 场景 1.2 渲染器：行列式的性质可视化
 * 并排显示原矩阵的平行六面体（白色线框）和变换后的（彩色半透明）
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawLine } from '../draw-utils.js';

export class DetPropertiesRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        const group = this.sceneObjects;

        // 偏移量：将两个六面体分开放置
        const offset = new THREE.Vector3(-3.5, 0, 0);

        // ─── 原矩阵的六面体（白色线框，左侧） ───
        this._drawWireframe(group, sd.shape_original, 0xffffff, 0.6, offset.clone().multiplyScalar(-1));

        // ─── 变换后的六面体（彩色半透明，右侧） ───
        const detColor = sd.det_modified >= 0 ? 0x4cc9f0 : 0xef476f;
        this._drawWireframe(group, sd.shape_modified, detColor, 0.9, offset);
        this._drawFaces(group, sd.shape_modified, detColor, offset);

        // ─── 标签 ───
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 512; labelCanvas.height = 80;
        const ctx = labelCanvas.getContext('2d');

        // 左侧标签
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`原 det(A) = ${sd.det_original.toFixed(2)}`, 128, 30);

        // 右侧标签
        ctx.fillStyle = detColor >= 0 ? '#4cc9f0' : '#ef476f';
        ctx.fillText(`变换后 det(A') = ${sd.det_modified.toFixed(2)}`, 384, 30);

        // 性质说明
        ctx.fillStyle = '#a0a0b8';
        ctx.font = '18px sans-serif';
        ctx.fillText(sd.property_name, 256, 60);

        const texture = new THREE.CanvasTexture(labelCanvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(0, -1.5, -1.5);
        sprite.scale.set(6, 1, 1);
        group.add(sprite);
    }

    _drawWireframe(group, shape, color, opacity, offset) {
        if (!shape.edges) return;
        shape.edges.forEach(([a, b]) => {
            const va = shape.vertices[a];
            const vb = shape.vertices[b];
            const start = new THREE.Vector3(va[0] + offset.x, va[1] + offset.y, va[2] + offset.z);
            const end = new THREE.Vector3(vb[0] + offset.x, vb[1] + offset.y, vb[2] + offset.z);

            const dashMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
            const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
            group.add(new THREE.Line(geom, dashMat));
        });
    }

    _drawFaces(group, shape, color, offset) {
        if (!shape.vertices || shape.vertices.length < 8) return;
        const v = shape.vertices;
        const o = offset;

        // 6 个面（与后端对应）
        const faces = [
            [0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4],
            [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5],
        ];

        faces.forEach(fidx => {
            const fv = fidx.map(i => new THREE.Vector3(v[i][0] + o.x, v[i][1] + o.y, v[i][2] + o.z));
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array([
                fv[0].x, fv[0].y, fv[0].z,
                fv[1].x, fv[1].y, fv[1].z,
                fv[2].x, fv[2].y, fv[2].z,
                fv[0].x, fv[0].y, fv[0].z,
                fv[2].x, fv[2].y, fv[2].z,
                fv[3].x, fv[3].y, fv[3].z,
            ]);
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.computeVertexNormals();
            const material = new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
            });
            group.add(new THREE.Mesh(geometry, material));
        });
    }
}
