/**
 * 场景 1.1 渲染器：三阶行列式与平行六面体
 * 绘制三个列向量和平行六面体（半透明面 + 线框）
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawLine } from '../draw-utils.js';

export class DetVolumeRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        const group = this.sceneObjects;

        const pp = sd.parallelepiped;
        const det = sd.det;
        const faceColor = det >= 0 ? 0x4cc9f0 : 0xef476f;
        const edgeColor = det >= 0 ? 0x7ec8e3 : 0xf07a8f;

        // 半透明面
        if (pp.faces && sd.rank === 3) {
            pp.faces.forEach(face => {
                const v = face.vertices;
                const geometry = new THREE.BufferGeometry();
                // 用两个三角形表示四边形面
                const positions = new Float32Array([
                    v[0][0], v[0][1], v[0][2],
                    v[1][0], v[1][1], v[1][2],
                    v[2][0], v[2][1], v[2][2],
                    v[0][0], v[0][1], v[0][2],
                    v[2][0], v[2][1], v[2][2],
                    v[3][0], v[3][1], v[3][2],
                ]);
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.computeVertexNormals();
                const material = new THREE.MeshBasicMaterial({
                    color: faceColor,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.15,
                    depthWrite: false,
                });
                group.add(new THREE.Mesh(geometry, material));
            });
        }

        // 线框边
        if (pp.edges) {
            pp.edges.forEach(([a, b]) => {
                const va = pp.vertices[a];
                const vb = pp.vertices[b];
                group.add(drawLine(
                    new THREE.Vector3(va[0], va[1], va[2]),
                    new THREE.Vector3(vb[0], vb[1], vb[2]),
                    sd.rank === 3 ? edgeColor : 0x888888
                ));
            });
        }

        // 列向量
        sd.vectors.forEach(v => {
            const vec = new THREE.Vector3(...v.components);
            group.add(drawVector(vec, v.color, v.label));
        });

        // 体积标签
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256; labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = det >= 0 ? '#4cc9f0' : '#ef476f';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`det(A) = ${det.toFixed(2)}`, 128, 24);
        ctx.fillStyle = '#a0a0b8';
        ctx.font = '20px sans-serif';
        ctx.fillText(`体积 = ${sd.volume.toFixed(2)}`, 128, 50);

        const texture = new THREE.CanvasTexture(labelCanvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(0, -0.8, -1);
        sprite.scale.set(3, 0.75, 1);
        group.add(sprite);
    }
}
