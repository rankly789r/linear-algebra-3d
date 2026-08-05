/**
 * 场景 3.5 渲染器：3×3 线性方程组 — 三平面相交
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPlane, drawPoint } from '../draw-utils.js';

export class ThreeByThreeSystemRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;
        const group = this.sceneObjects;

        // 绘制三个平面
        if (sd.planes) {
            sd.planes.forEach(p => {
                const normal = new THREE.Vector3(...p.normal);
                const d = p.d;
                const color = p.color;
                const planeGroup = drawPlane(normal, d, color, null, 0.3, 4.5);
                group.add(planeGroup);

                // 平面标签
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.font = 'bold 28px sans-serif';
                const colorHex = '#' + color.toString(16).padStart(6, '0');
                ctx.fillStyle = colorHex;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.label || '', 32, 32);
                const texture = new THREE.CanvasTexture(canvas);
                texture.minFilter = THREE.LinearFilter;
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));

                // 标签放在平面上方
                const center = normal.clone().multiplyScalar(d / normal.dot(normal));
                sprite.position.copy(center.add(normal.clone().multiplyScalar(0.6)));
                sprite.scale.set(0.7, 0.7, 1);
                group.add(sprite);
            });
        }

        // 画解（交点）
        if (sd.solution_point) {
            const solPos = new THREE.Vector3(...sd.solution_point);
            if (sd.solution_type === 'unique') {
                group.add(drawPoint(solPos, 0xffd700, 0.13));
            } else if (sd.solution_type === 'infinite') {
                group.add(drawPoint(solPos, 0x06d6a0, 0.11));
            }
        }
    }
}
