/**
 * 绘图工具模块 — 提供通用的 3D 绘图函数。
 *
 * 所有场景渲染器通过调用这些函数来绘制几何元素。
 * 不包含任何数学计算逻辑——只接收坐标并渲染。
 */

import * as THREE from 'three';

// ─── 颜色常量 ──────────────────────────────────────────────

export const COLORS = {
    axisX: 0xff4444,
    axisY: 0x44ff44,
    axisZ: 0x4488ff,
    grid: 0x333355,
    vector1: 0xff6b6b,
    vector2: 0x4ecdc4,
    vector3: 0xffd93d,
    plane1: 0xff6b6b,
    plane2: 0x4ecdc4,
    plane3: 0xffd93d,
    solution: 0xffd700,
    line1: 0xff6b6b,
    line2: 0x4ecdc4,
    subSpace: 0x9966ff,
};

// ─── 场景初始化 ────────────────────────────────────────────

/**
 * 创建默认的 Three.js 场景，包含光照、坐标轴、参考网格
 */
export function createBaseScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // 环境光 + 方向光
    scene.add(new THREE.AmbientLight(0x404060, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // 坐标轴
    scene.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 0, 0), COLORS.axisX));  // X 红
    scene.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6, 0), COLORS.axisY));  // Y 绿
    scene.add(createAxisLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 6), COLORS.axisZ));  // Z 蓝

    // 轴标签
    scene.add(createLabel('X', new THREE.Vector3(6.3, 0, 0), '#ff4444'));
    scene.add(createLabel('Y', new THREE.Vector3(0, 6.3, 0), '#44ff44'));
    scene.add(createLabel('Z', new THREE.Vector3(0, 0, 6.3), '#4488ff'));

    // XZ 参考网格
    const grid = new THREE.GridHelper(10, 10, COLORS.grid, COLORS.grid);
    scene.add(grid);

    // 原点小球
    const originDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(originDot);

    return scene;
}

function createAxisLine(start, end, color) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    const mid = start.clone().add(dir.clone().multiplyScalar(0.5));

    // 线段
    const geom = new THREE.CylinderGeometry(0.03, 0.03, len, 8);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(mid);

    // 让圆柱体对齐方向
    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.normalize());
    mesh.setRotationFromQuaternion(quat);

    // 箭头尖端
    const coneGeom = new THREE.ConeGeometry(0.08, 0.2, 8);
    const cone = new THREE.Mesh(coneGeom, mat);
    cone.position.copy(end);
    cone.setRotationFromQuaternion(quat);

    const group = new THREE.Group();
    group.add(mesh);
    group.add(cone);
    return group;
}

// ─── 标签（使用 Sprite） ───────────────────────────────────

function createLabel(text, position, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.scale.set(0.8, 0.4, 1);
    return sprite;
}

// ─── 向量（箭头） ──────────────────────────────────────────

/**
 * 在原点绘制一个向量（箭头）
 * @param {THREE.Vector3} v - 向量终点
 * @param {number} color - 颜色
 * @param {string} label - 标签文字
 * @param {THREE.Scene} scene - 场景
 * @param {number} opacity - 不透明度 0-1
 */
export function drawVector(v, color, label, scene, opacity = 1.0) {
    const group = new THREE.Group();
    const dir = v.clone().normalize();
    const len = v.length();

    if (len < 0.001) return group;

    // 旋转四元数（共用）
    const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dir
    );

    // 箭身：从原点延伸到向量终点
    const bodyRadius = 0.06;
    const bodyGeom = new THREE.CylinderGeometry(bodyRadius, bodyRadius, len, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: opacity < 1,
        opacity
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.copy(dir.clone().multiplyScalar(len / 2));
    body.setRotationFromQuaternion(quat);
    group.add(body);

    // 箭头锥体：底部对齐向量终点，尖端向前延伸
    const coneRadius = 0.16;
    const coneHeight = 0.35;
    const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 12);
    const coneMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        transparent: opacity < 1,
        opacity
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    // 锥体中心位置 = 向量终点 + 锥体半高（使底部对齐终点）
    cone.position.copy(v.clone().add(dir.clone().multiplyScalar(coneHeight / 2)));
    cone.setRotationFromQuaternion(quat);
    group.add(cone);

    // 标签
    if (label) {
        const labelSprite = createLabel(
            label,
            v.clone().add(dir.clone().multiplyScalar(coneHeight + 0.4)),
            '#' + color.toString(16).padStart(6, '0')
        );
        group.add(labelSprite);
    }

    return group;
}

// ─── 平面（半透明） ────────────────────────────────────────

/**
 * 绘制一个由法向量和常数定义的平面（ax + by + cz = d）
 * @param {THREE.Vector3} normal - 法向量 (a, b, c)
 * @param {number} d - 常数项
 * @param {number} color - 颜色
 * @param {THREE.Scene} scene - 场景
 * @param {number} opacity - 不透明度
 * @param {number} size - 平面半边长
 */
export function drawPlane(normal, d, color, scene, opacity = 0.35, size = 5) {
    const group = new THREE.Group();
    const n = normal.clone().normalize();

    // 平面几何
    const planeGeom = new THREE.PlaneGeometry(size * 2, size * 2);
    const planeMat = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(planeGeom, planeMat);

    // 位置：平面上离原点最近的点
    const centerPoint = n.clone().multiplyScalar(d / n.dot(n));
    mesh.position.copy(centerPoint);

    // 旋转使法向量对齐
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(defaultNormal, n);
    mesh.setRotationFromQuaternion(quat);

    group.add(mesh);

    // 平面边框
    const edges = new THREE.EdgesGeometry(planeGeom);
    const lineGeom = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
    mesh.add(lineGeom);

    // 法向量指示线
    const normalArrow = new THREE.Vector3().copy(n).multiplyScalar(1.2);
    const arrowGroup = drawVector(normalArrow, color, '', null, 0.5);
    arrowGroup.position.copy(centerPoint);
    group.add(arrowGroup);

    return group;
}

// ─── 线段 ──────────────────────────────────────────────────

/**
 * 绘制两点之间的线段
 */
export function drawLine(start, end, color, scene, linewidth = 1) {
    const points = [start.clone(), end.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, linewidth });
    return new THREE.Line(geom, mat);
}

/**
 * 绘制无限延伸的直线（在场景范围内的长线段）
 */
export function drawInfiniteLine(point, direction, color, scene, halfLength = 8) {
    const dir = direction.clone().normalize();
    const p1 = point.clone().add(dir.clone().multiplyScalar(halfLength));
    const p2 = point.clone().add(dir.clone().multiplyScalar(-halfLength));
    return drawLine(p1, p2, color, scene);
}

// ─── 点 ────────────────────────────────────────────────────

/**
 * 绘制一个发光小球（用于标注交点/解）
 */
export function drawPoint(position, color = COLORS.solution, radius = 0.1) {
    const geom = new THREE.SphereGeometry(radius, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);

    // 光晕
    const glowGeom = new THREE.SphereGeometry(radius * 1.8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.25,
        depthWrite: false
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    mesh.add(glow);

    return mesh;
}

// ─── 虚线连接 ──────────────────────────────────────────────

/**
 * 从一点向平面做虚线垂线
 */
export function drawDashedLine(start, end, color = 0x888888) {
    const points = [start.clone(), end.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.2 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    return line;
}

// ─── 文字标签（3D位置） ─────────────────────────────────────

export { createLabel };

// ─── 清理函数 ──────────────────────────────────────────────

/**
 * 从场景中移除所有自定义对象（保留坐标轴和网格）
 * @param {THREE.Scene} scene
 */
export function clearSceneObjects(scene) {
    // 遍历并移除所有非基础对象
    // 基础对象包括：AmbientLight, DirectionalLight, GridHelper, 以及坐标轴相关的
    const toRemove = [];
    scene.traverse((child) => {
        // 保留光照和网格
        if (child instanceof THREE.AmbientLight ||
            child instanceof THREE.DirectionalLight ||
            child instanceof THREE.GridHelper) {
            return;
        }
        // 如果是坐标轴相关的顶层 group（通过检查子元素判断），也保留
        // 这里用简单策略：标记所有顶层非光照非网格的 group 和 mesh
        if (child.parent === scene) {
            toRemove.push(child);
        }
    });

    toRemove.forEach(child => {
        disposeRecursive(child);
        scene.remove(child);
    });
}

function disposeRecursive(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
        } else {
            obj.material.dispose();
        }
    }
    if (obj.children) {
        obj.children.forEach(c => disposeRecursive(c));
    }
}

// ─── 动画工厂函数 ──────────────────────────────────────────
// 供动画场景复用，避免各渲染器重复定义

/** 几何常量：四边形的边和面索引 */
export const EDGES_QUAD = [[0, 1], [1, 2], [2, 3], [3, 0]];
export const FACES_QUAD = [[0, 1, 2], [0, 2, 3]];

/**
 * 创建可更新顶点的线框。
 * @param {number[][]} vertices - 初始顶点数组 [[x,y,z], ...]
 * @param {number[][]} edgePairs - 边索引对 [[i,j], ...]
 * @param {number} color - 十六进制颜色
 * @param {number} opacity - 透明度
 * @returns {THREE.LineSegments} 带 .updateVertices(newVertices) 方法的线段对象
 */
export function createUpdatableWireframe(vertices, edgePairs, color, opacity) {
    const positions = [];
    edgePairs.forEach(([i, j]) => {
        positions.push(...vertices[i], ...vertices[j]);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: true });
    const lines = new THREE.LineSegments(geom, mat);

    lines.updateVertices = function (newVertices) {
        const arr = geom.attributes.position.array;
        let idx = 0;
        edgePairs.forEach(([i, j]) => {
            arr[idx] = newVertices[i][0]; arr[idx + 1] = newVertices[i][1]; arr[idx + 2] = newVertices[i][2];
            arr[idx + 3] = newVertices[j][0]; arr[idx + 4] = newVertices[j][1]; arr[idx + 5] = newVertices[j][2];
            idx += 6;
        });
        geom.attributes.position.needsUpdate = true;
    };
    return lines;
}

/**
 * 创建可更新顶点的半透明面。
 * @param {number[][]} vertices - 初始顶点数组
 * @param {number[][]} faceIndices - 面索引数组（三角形）
 * @param {number} color - 十六进制颜色
 * @param {number} opacity - 透明度
 * @returns {THREE.Group} 带 .updateVertices(newVertices) 方法的 Group
 */
export function createUpdatableFaces(vertices, faceIndices, color, opacity) {
    const group = new THREE.Group();
    const buildFaces = (verts) => {
        while (group.children.length > 0) {
            const c = group.children[0]; c.geometry.dispose(); c.material.dispose(); group.remove(c);
        }
        faceIndices.forEach(face => {
            const tv = face.map(i => new THREE.Vector3(...verts[i]));
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tv.flatMap(v => [v.x, v.y, v.z])), 3));
            geom.setIndex([0, 1, 2]);
            geom.computeVertexNormals();
            const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false });
            group.add(new THREE.Mesh(geom, mat));
        });
    };
    buildFaces(vertices);
    group.updateVertices = buildFaces;
    return group;
}

/**
 * 创建可动画的箭头（从原点出发的线段 + 端点球 + 文字标签）。
 * @param {number[]} endPos - 初始终点 [x, y, z]
 * @param {number} color - 十六进制颜色
 * @param {string} labelText - 标签文字
 * @returns {THREE.Group} 带 .update(end) 方法的 Group
 */
export function createAnimatableArrow(endPos, color, labelText) {
    const group = new THREE.Group();

    const geom = new THREE.BufferGeometry();
    const arr = new Float32Array([0, 0, 0, endPos[0], endPos[1], endPos[2]]);
    geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geom, mat);
    group.add(line);

    const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color })
    );
    dot.position.set(...endPos);
    group.add(dot);

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 64, 24);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.set(endPos[0], endPos[1] + 0.3, endPos[2]);
    sprite.scale.set(1.2, 0.45, 1);
    group.add(sprite);

    group.update = function (end) {
        const a = line.geometry.attributes.position.array;
        a[3] = end[0]; a[4] = end[1]; a[5] = end[2];
        line.geometry.attributes.position.needsUpdate = true;
        dot.position.set(...end);
        sprite.position.set(end[0], end[1] + 0.3, end[2]);
    };

    return group;
}
