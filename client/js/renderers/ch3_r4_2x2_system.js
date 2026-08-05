/**
 * 场景 3.4 渲染器：2×2 线性方程组
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { drawPoint, drawLine } from '../draw-utils.js';

export class TwoByTwoSystemRenderer extends SceneRenderer {

    buildScene(data) {
        const sd = data.scene_data;
        if (!sd) return;

        const group = this.sceneObjects;

        // 直线颜色
        const colors = [0xff6b6b, 0x4ecdc4];

        // 绘制两条直线
        if (sd.lines) {
            sd.lines.forEach((line, i) => {
                if (line.points && line.points.length >= 2) {
                    const p1 = new THREE.Vector3(...line.points[0]);
                    const p2 = new THREE.Vector3(...line.points[1]);

                    group.add(drawLine(p1, p2, colors[i % colors.length]));

                    // 标签 sprite
                    const midPoint = p1.clone().add(p2).multiplyScalar(0.5);
                    const labelCanvas = document.createElement('canvas');
                    labelCanvas.width = 64; labelCanvas.height = 64;
                    const ctx = labelCanvas.getContext('2d');
                    ctx.font = 'bold 28px sans-serif';
                    ctx.fillStyle = '#' + colors[i % colors.length].toString(16).padStart(6, '0');
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(line.label || `L${i+1}`, 32, 32);
                    const texture = new THREE.CanvasTexture(labelCanvas);
                    texture.minFilter = THREE.LinearFilter;
                    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
                    sprite.position.copy(midPoint.clone().add(new THREE.Vector3(0.3, 0.3, 0)));
                    sprite.scale.set(0.7, 0.7, 1);
                    group.add(sprite);
                }
            });
        }

        // 画解（交点）
        if (sd.solution_point) {
            const solPos = new THREE.Vector3(...sd.solution_point);

            if (sd.solution_type === 'unique') {
                // 唯一解：金色发光点
                group.add(drawPoint(solPos, 0xffd700, 0.12));
            } else if (sd.solution_type === 'infinite') {
                // 无穷解：标注一个代表点
                group.add(drawPoint(solPos, 0x06d6a0, 0.1));
            }
        }

        // 如果是重合直线，第二条线用虚线画
        if (sd.solution_type === 'infinite' && sd.lines && sd.lines.length >= 2) {
            // 重合直线已经很直观了（两条线叠在一起）
        }
    }
}
