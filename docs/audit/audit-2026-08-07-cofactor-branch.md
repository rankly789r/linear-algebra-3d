# 审计报告 — 2026-08-07 · feat/scene/ch1-r4-cofactor

**审计范围**：`feat/scene/ch1-r4-cofactor` 分支 vs `master`（58f4e53）

**7 个提交**：

```
d0834aa docs: 添加 GitHub 远程仓库信息到 CLAUDE.md
5b85dc2 feat: 设置菜单新增鼠标交互 — 一键交换左右键功能（旋转↔平移）
c0b7537 fix: 设置菜单动画速度滑块拖动时宽度闪烁 — 值标签加 min-width
2506ff8 feat: 动画进度条 — 可拖动滑块跳到任意帧，拖动时暂停动画
9a50fca feat: ch1_r4_cofactor — 按行列展开的几何：三重积视角，b×c=余子式向量
0eba8f4 fix: 切换预设/AI应用参数时停止动画并恢复按钮状态
4773fb3 feat: 全局动画播放速率 — 设置菜单添加动画速度滑块 (0.25x~3x)
```

**改动规模**：17 文件，+749/-21 行

---

## 问题汇总

| # | 严重度 | 文件 | 问题 |
|---|--------|------|------|
| 1 | ⚠️ | `scene-base.js:_stopAnimation()` | 未清除 `_animTimeout` / `_animStartTimer`，预设切换可能触发重复动画 |
| 2 | 🟡 | `scene-base.js:_addAnimControlUI` | 进度条 `input` 处理器重复了 `_stopAnimation()` 逻辑，应直接调用 |
| 3 | 🟡 | `settings-menu.js:_applyAnimSpeed` | 未校验速度值范围 |
| 4 | 🟡 | `settings-menu.js:getControls?.()` | 若未注入 `getControls`，鼠标交换 UI 正常但实际不生效（静默无操作） |
| 5 | 🟡 | `ch1_r4_cofactor.js:41` | 未使用变量 `n_unit` |
| 6 | 🟡 | `ch1_r4_cofactor.py:174` | 验证检查 "det(A) = ..." 始终 `passed: True`，无实际验证价值 |
| 7 | 🟡 | `settings-menu.js:JSDoc` | `initSettingsMenu()` 的 JSDoc 未记录新增的 `getControls` 参数 |
| 8 | 🟡 | `scene-base.js:_updateAnimButton` | 每次调用 `querySelector` 而非存储引用 |

> 无 🔴 级别问题。

---

## 详细分析

### ⚠️ #1：`_stopAnimation()` 未清除 setTimeout 定时器

- **位置**：`client/js/scene-base.js:622-629`
- **症状**：`ch0_r0_matrix_columns` 和 `ch0_r1_column_decompose` 场景在 `buildScene()` 中设置了 `_animTimeout` / `_animStartTimer` 自动启动动画。预设切换时 `_stopAnimation()` 只取消 `requestAnimationFrame`，不取消这两个 `setTimeout`。旧定时器可能在场景重建后意外触发，导致动画重复启动。
- **根因**：`destroy()` 清除了全部四个定时器，但 `_stopAnimation()` 只清除了 `_animFrameId`
- **修复**：在 `_stopAnimation()` 中加两行：
  ```js
  if (this._animTimeout) { clearTimeout(this._animTimeout); this._animTimeout = null; }
  if (this._animStartTimer) { clearTimeout(this._animStartTimer); this._animStartTimer = null; }
  ```
- **概率**：低（需在 300-350ms 自动启动窗口内操作）

### 🟡 #2：进度条滑块重复了 `_stopAnimation()` 逻辑

- **位置**：`client/js/scene-base.js:563-577`
- **症状**：滑块 `input` 处理器手动写了和 `_stopAnimation()` 一样的三步（取消帧、置 `_animating=false`、更新按钮），而不是调用 `this._stopAnimation()`
- **修复**：替换为 `this._stopAnimation(); if (typeof this._interpolateToT === 'function') this._interpolateToT(t);`

### 🟡 #3：`_applyAnimSpeed` 未校验范围

- **位置**：`client/js/settings-menu.js:384-387`
- **症状**：`_loadAnimSpeed()` 校验范围 [0.25, 3.0]，但 `_applyAnimSpeed` 直接赋值。若 localStorage 被手动修改，运行时速度可能越界
- **修复**：`_applyAnimSpeed` 中加同样的范围校验

### 🟡 #4：`getControls?.()` 静默失效

- **位置**：`client/js/settings-menu.js:443`
- **症状**：若 `initSettingsMenu` 未传入 `getControls`，鼠标交换按钮 UI 正常交互，但 OrbitControls 实际不变化——用户看不出问题
- **修复**：初始化时检查 `getControls` 是否存在，不存在则隐藏或禁用鼠标交换 UI

### 🟡 #5–#8：代码风格/维护性问题

详见上表，均为低影响、非功能性缺陷。

---

## 正面发现

1. **cofactor 场景数学正确**：三重积、余子式计算、向量分解、退化情形处理全部验证无误
2. **SceneRenderer 模式遵守良好**：前端正确继承 `SceneRenderer`，后端正确继承 `BaseScene`，`compute()` 返回 `verification` 和 `solution_info`
3. **场景注册完整**：`server/main.py`（import + SCENE_REGISTRY）、`client/js/main.js`（import + SCENE_RENDERERS + 导航按钮 + getSceneMeta）四步全部到位
4. **动画进度条设计合理**：`cancelAnimationFrame` + `_animating = false` 双重防护，`_interpolateToT` 有 `typeof` 保护，`_updateAnimProgress` 有空值保护
5. **双缓冲调用正确**：`_stopAnimation()` 在 `buildScene()` 之前调用，顺序无误
6. **`initSettingsMenu` 调用顺序正确**：移到 `controls` 创建之后，`getControls` 注入安全
7. **动画速度公式一致**：9 个渲染器统一使用 `elapsed * this.animSpeed / this._animDuration`
8. **localStorage 安全**：所有读写均有 try/catch，键名统一 `la_*` 前缀
9. **鼠标交互功能实用**：左右键交换用 `THREE.MOUSE.ROTATE/PAN` 常量，不写魔数

---

## 建议优先级

**合并前建议修**：⚠️ #1（`_stopAnimation` 清除定时器）——几行代码，防止边缘情况

**合并后可修**：🟡 #2–#8 ——不影响功能，可后续迭代

---

## 合并建议

**可以合并。**

改动分布合理，新场景与基础设施改动清晰分层。6 个已有的动画场景未受影响。

合并后建议在以下场景测试进度条拖动：
- `ch0_r0_matrix_columns`（有 `_animStartTimer` 的自动启动场景）
- `ch0_r1_column_decompose`（有 `_animTimeout` 的自动启动场景）
- 任意无动画场景（确认进度条不出现、不报错）

桌面和平板均需测试鼠标交互功能。
