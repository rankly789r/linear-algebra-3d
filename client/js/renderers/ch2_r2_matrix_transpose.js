/**
 * 场景 2.2 渲染器：转置与对称矩阵
 * 绘制向量对 v, w, Av, Aᵀw，展示内积关系
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawVector, drawDashedLine } from '../draw-utils.js';

export class MatrixTransposeRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        const group = this.sceneObjects;

        const vecs = sd.vectors;

        // v（白色）、w（灰色）—— 原始向量
        group.add(drawVector(new THREE.Vector3(...vecs.v), 0xffffff, 'v'));
        group.add(drawVector(new THREE.Vector3(...vecs.w), 0xaaaaaa, 'w'));

        // Av（蓝色）
        group.add(drawVector(new THREE.Vector3(...vecs.Av), 0x4cc9f0, 'Av'));

        // Aᵀw（绿色）
        group.add(drawVector(new THREE.Vector3(...vecs.ATw), 0x06d6a0, 'A^T w'));

        // 内积关系虚线
        const ip = sd.inner_product;
        if (ip.match) {
            // 连接 Av 和 w 的虚线
            group.add(drawDashedLine(
                new THREE.Vector3(...vecs.Av),
                new THREE.Vector3(...vecs.w),
                0x4cc9f0
            ));
            // 连接 v 和 Aᵀw 的虚线
            group.add(drawDashedLine(
                new THREE.Vector3(...vecs.v),
                new THREE.Vector3(...vecs.ATw),
                0x06d6a0
            ));
        }

        // 标签（使用 ASCII 兼容字符，避免特殊 Unicode 渲染为空心方框）
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 512; labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = '#4cc9f0';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`<Av, w> = ${ip.Av_dot_w.toFixed(2)}`, 128, 22);
        ctx.fillStyle = '#06d6a0';
        ctx.fillText(`<v, A^T w> = ${ip.v_dot_ATw.toFixed(2)}`, 384, 22);
        ctx.fillStyle = '#ffd166';
        ctx.font = '16px sans-serif';
        ctx.fillText(`<Av,w> = <v, A^T w>: ${ip.match ? 'OK' : 'X'}`, 256, 48);

        const texture = new THREE.CanvasTexture(labelCanvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.position.set(0, -1.5, -1);
        sprite.scale.set(6, 0.8, 1);
        group.add(sprite);
    }
}
