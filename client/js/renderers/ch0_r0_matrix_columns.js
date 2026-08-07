/**
 * 场景渲染器：矩阵的列——线性变换的密码
 *
 * 核心直觉可视化：
 *   标准基向量 e₁, e₂, (e₃) 经过矩阵 A 变换后，
 *   分别移动到 A 的第 1, 2, (3) 列的位置。
 *
 * 包含动画功能：点击「重播动画」观看基向量从原位置滑翔到变换后位置。
 */
import * as THREE from 'three';
import { SceneRenderer } from '../scene-base.js';
import { COLORS, createUpdatableWireframe, createUpdatableFaces, createAnimatableArrow } from '../draw-utils.js';

// 基向量颜色（对应 X/Y/Z 轴颜色）
const BASIS_COLORS = [
    0xff6b6b,  // e₁ → 暖红
    0x4ecdc4,  // e₂ → 青绿
    0xffd93d,  // e₃ → 金黄
];

const BASIS_LABELS_3D = ['e₁ → 第1列', 'e₂ → 第2列', 'e₃ → 第3列'];
const BASIS_LABELS_2D = ['e₁ → 第1列', 'e₂ → 第2列'];



export class MatrixColumnsRenderer extends SceneRenderer {

    buildScene(data) {
        const d = data.scene_data;
        this._animData = d;  // 保存数据供动画使用
        this._animT = 1.0;    // 动画进度 0→1
        this._animating = false;

        // 复原原始形状顶点索引
        const is3D = d.mode === '3x3';

        // ─── 原始基向量（虚线效果：灰色半透明） ──────────
        this._ghostArrows = [];
        const basisOrig = is3D
            ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
            : [[1, 0, 0], [0, 1, 0]];
        const basisLabels = is3D ? BASIS_LABELS_3D : BASIS_LABELS_2D;

        basisOrig.forEach((v, i) => {
            const arrow = createAnimatableArrow([...v], 0x555566, '');
            // 用 ghost 材质替换（draw-utils 箭头为 Line + Sphere）
            arrow.children[0].material = new THREE.LineBasicMaterial({
                color: 0x555566, transparent: true, opacity: 0.4,
            });
            arrow.children[1].material = new THREE.MeshStandardMaterial({
                color: 0x555566, emissive: 0x333344, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.4,
            });
            // 原始基向量标签
            this._addSpriteLabel(arrow, ['e₁', 'e₂', 'e₃'][i], new THREE.Vector3(...v), '#888899');
            this.sceneObjects.add(arrow);
            this._ghostArrows.push(arrow);
        });

        // ─── 变换后的基向量（彩色实线箭头） ──────────────
        this._basisArrows = [];
        d.columns.forEach((colInfo, i) => {
            const color = BASIS_COLORS[i];
            const label = is3D ? BASIS_LABELS_3D[i] : BASIS_LABELS_2D[i];
            const arrow = createAnimatableArrow([...colInfo.start], color, label);
            this.sceneObjects.add(arrow);
            this._basisArrows.push({ arrow, start: colInfo.start, end: colInfo.end });
        });

        // ─── 原始形状（白色线框） ─────────────────────────
        if (is3D) {
            const cubeEdges = [
                [0, 1], [1, 2], [2, 3], [3, 0],  // 底面
                [4, 5], [5, 6], [6, 7], [7, 4],  // 顶面
                [0, 4], [1, 5], [2, 6], [3, 7],  // 竖边
            ];
            this._ghostShape = createUpdatableWireframe(
                d.shape_original, cubeEdges, 0x556677, 0.5
            );
            this._shapeWire = createUpdatableWireframe(
                d.shape_original, cubeEdges, 0x88aacc, 0.9
            );

            const cubeFaces = [
                [0, 1, 2], [0, 2, 3],  // 底面
                [4, 5, 6], [4, 6, 7],  // 顶面
                [0, 1, 5], [0, 5, 4],  // 前面
                [2, 3, 7], [2, 7, 6],  // 后面
                [0, 3, 7], [0, 7, 4],  // 左面
                [1, 2, 6], [1, 6, 5],  // 右面
            ];
            this._shapeFaces = createUpdatableFaces(
                d.shape_original, cubeFaces, 0x4488cc, 0.15
            );
        } else {
            const squareEdges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
            this._ghostShape = createUpdatableWireframe(
                d.shape_original, squareEdges, 0x556677, 0.5
            );
            this._shapeWire = createUpdatableWireframe(
                d.shape_original, [[0, 1], [1, 2], [2, 3], [3, 0]], 0x88aacc, 0.9
            );

            const squareFaces = [[0, 1, 2], [0, 2, 3]];
            this._shapeFaces = createUpdatableFaces(
                d.shape_original, squareFaces, 0x4488cc, 0.2
            );
        }

        this.sceneObjects.add(this._ghostShape);
        this.sceneObjects.add(this._shapeWire);
        this.sceneObjects.add(this._shapeFaces);

        // ─── 原点小球 ─────────────────────────────────────
        const originDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        this.sceneObjects.add(originDot);

        // ─── 动画按钮 ─────────────────────────────────────
        this._addAnimControlUI();
        this._setToTarget();
    }

    /** 添加一个 sprite 标签到箭头组 */
    _addSpriteLabel(group, text, position, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = colorHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 24);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, transparent: true, depthTest: false,
        }));
        sprite.scale.set(0.6, 0.25, 1);
        sprite.position.set(0, position.length() + 0.4, 0);
        group.add(sprite);
    }

    /** 开始动画：从恒等变换插值到目标矩阵 */
    _startAnimation() {
        if (this._animating) return;
        this._interpolateToT(0);  // 先复位到初始状态
        this._animating = true;
        this._animStartTime = performance.now();
        this._animDuration = 1500;  // 1.5 秒

        this._updateAnimButton('⟳ 动画中...', true);
        this._animFrame();
    }

    _animFrame() {
        if (!this._animating) return;

        const elapsed = performance.now() - this._animStartTime;
        let t = Math.min(elapsed * this.animSpeed / this._animDuration, 1.0);

        // 缓出函数（ease-out cubic）
        t = 1 - Math.pow(1 - t, 3);

        this._animT = t;
        this._updateAnimProgress(t);
        this._interpolateToT(t);

        if (t < 1.0) {
            this._animFrameId = requestAnimationFrame(() => this._animFrame());
        } else {
            this._animating = false;
            this._animT = 1.0;
            this._updateAnimButton('🔄 重播动画', false);
        }
    }

    /** 将所有可动对象插值到参数 t（0=恒等, 1=目标） */
    _interpolateToT(t) {
        if (!this._animData) return;

        // 插值基向量箭头
        this._basisArrows.forEach(({ arrow, start, end }) => {
            const pos = [
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                start[2] + (end[2] - start[2]) * t,
            ];
            arrow.update(pos);
        });

        // 插值形状顶点
        const orig = this._animData.shape_original;
        const target = this._animData.shape_transformed;
        const interp = orig.map((v, i) => [
            v[0] + (target[i][0] - v[0]) * t,
            v[1] + (target[i][1] - v[1]) * t,
            v[2] + (target[i][2] - v[2]) * t,
        ]);

        this._shapeWire.updateVertices(interp);
        this._shapeFaces.updateVertices(interp);

        // 原始形状始终不变（ghost）
        // this._ghostShape 不需要更新
    }

    /** 直接跳到最终状态（无动画） */
    _setToTarget() {
        this._interpolateToT(1.0);
        this._updateAnimButton('🔄 重播动画', false);
    }
}
