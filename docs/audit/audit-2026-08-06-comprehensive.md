# 审计报告 — 2026-08-06 全面审计

**审计范围**：全项目（24 个场景 + 基础设施代码）
**审计时间**：2026-08-06
**审计方法**：4 个并行审计代理 + 手动深入检查
**参考**：上次审计 v1.9 健康度审查日志（`docs/WORK_LOG_2026-08-06_health_review.md`）

---

## 问题汇总

| # | 严重度 | 文件:行号 | 问题简述 |
|---|--------|----------|----------|
| 1 | ⚠️ | `ch0_r0_matrix_columns.js:296` | setTimeout 未存储 ID，destroy 后可能访问已销毁场景 |
| 2 | 🔴 | 8 个场景文件 | 27 处直接调用 `np.linalg.*` 绕过 MathEngine |
| 3 | 🔴 | `main.js:585-586` | switchScene 错误处理未使用 `_showError()`，无重试功能 |
| 4 | 🔴 | `scene-base.js:76-87` | destroy() 未清除 `_animTimeout`，延迟动画可能在销毁后启动 |
| 5 | 🟡 | 10 个渲染器 | rAF ID 未存储到 `_animFrameId`（已知遗留项） |
| 6 | 🟡 | `main.js:449-451` | 相机补间动画 rAF 未取消 |
| 7 | 🟡 | `server/main.py` | API 参数无类型/范围验证 |
| 8 | 🟡 | `panel-system.js` 等 3 处 | overbroad `except Exception` 吞异常 |
| 9 | 🟡 | 3 个后端场景 | `_get_transform_data` / `_build_matrix` 逐字重复 |
| 10 | 🟡 | `scene-base.js:484` | `_lectureCollapsed` 语义反转 |
| 11 | 🟡 | `ch1_r0_det_area.py:71-73` | `diag1_start/end` 计算后从未使用，注释误导 |
| 12 | 🟢 | `main.js` | `getSceneMeta()` 500 行硬编码 |
| 13 | 🟢 | `math_engine.py` 等 | 6 个死函数、2 个死变量、3 个死 import |
| 14 | 🟢 | CLAUDE.md vs 代码 | `ch2_r3_ax_eq_b` / `ch2_r4_cramer` 标题不一致 |
| 15 | 🟢 | `main.js:106-108` | `document.getElementById` 用于面板菜单（轻微违规） |
| 16 | 💡 | 10 个渲染器 | 动画工厂函数重复（已知技术债） |

---

## 详细分析

### ⚠️ 严重问题

**#1 [ch0_r0_matrix_columns] setTimeout 未存储 ID，destroy 后访问已销毁场景**
- **位置**：`client/js/renderers/ch0_r0_matrix_columns.js:296`
- **症状**：用户在页面加载后 300ms 内切换场景，`_startAnimation()` 在 `destroy()` 之后触发，访问已 dispose 的 `_animData`、`_shapeWire`、`_shapeFaces`，抛出 WebGL 错误或白屏。
- **根因**：`buildScene()` 末尾 `setTimeout(() => this._startAnimation(), 300)` 未存储 timer ID，无法在 `destroy()` 中取消。`destroy()` 设置 `_animating = false` 反而使 `_startAnimation()` 的守卫 `if (this._animating) return;` 失效（`false` = 继续执行）。
- **修复**：
  ```js
  // buildScene() 中：
  this._animStartTimer = setTimeout(() => this._startAnimation(), 300);
  
  // destroy() override 或 scene-base.js destroy() 中添加：
  if (this._animStartTimer) {
      clearTimeout(this._animStartTimer);
      this._animStartTimer = null;
  }
  ```
  **更好的修复**：在 `SceneRenderer.destroy()` 中增加一个 `this._destroyed = true` 标记，`_startAnimation()` 检查此标记。
- **验证**：打开 ch0_r0 场景，立即切换到另一个场景，检查控制台无 Three.js 错误。

---

### 🔴 高级别问题

**#2 [MathEngine 绕过] 27 处直接调用 `np.linalg.*` 绕过 MathEngine 抽象**
- **位置**：8 个场景文件
- **根因**：CLAUDE.md §2.1 要求「`server/math_engine.py` 只能使用 NumPy/SciPy 公开 API」，隐含要求是**所有场景**应通过 `MathEngine` 封装层调用，而不是直接调 NumPy。当前 8 个场景绕过这一层。

| 文件 | 违规数 | 示例 |
|------|--------|------|
| `ch3_r12_elem_row.py` | 5 | `np.linalg.det(E)`, `np.linalg.matrix_rank(E)` |
| `ch3_r13_elem_col.py` | 5 | 同上 |
| `ch2_r4_cramer.py` | 5 | `np.linalg.det(A)`, `np.linalg.det(A1)`, `np.linalg.det(A2)` |
| `matrix_calculator.py` | 3 | `np.linalg.det()`, `np.linalg.inv()` |
| `ch2_r3_ax_eq_b.py` | 2 | `np.linalg.det(A)` |
| `ch1_r3_permutation.py` | 2 | `np.linalg.det(A)`, `np.linalg.det(A_swapped)` |
| `ch3_r3_matrix_rank.py` | 1 | `np.linalg.det(A)` |
| `ch3_r9_gaussian.py` | 1 | `np.linalg.matrix_rank(Ab)` |
| `ch3_r2_three_vectors.py` | 1 | `np.linalg.lstsq(prev, col, rcond=None)` |
| **合计** | **27** | — |

- **修复**：全部替换为 `MathEngine` 对应方法：`M.matrix_determinant()`, `M.matrix_rank()`, `M.matrix_inverse()`, `M.solve_least_squares()`
- **验证**：`grep -rn 'np\.linalg\.' server/scenes/` 返回 0 结果。

**#3 [main.js] switchScene 错误处理不一致**
- **位置**：`client/js/main.js:583-586`
- **症状**：场景加载失败时，直接操作 `error-overlay` 的 `style.display` 和 `textContent`，未使用 `scene-base.js` 的 `_showError()` 方法，因此：不保存重试参数、不绑定重试/关闭按钮、用户只能刷新页面。
- **根因**：v1.9 在 `scene-base.js` 新增了 `_showError()` 方法（带重试+关闭按钮），但 `main.js` 的 `switchScene()` 未被同步更新。
- **修复**：
  ```js
  // main.js:583-586 — 替换为：
  } catch (err) {
      console.error('场景切换失败:', err);
      document.getElementById('error-overlay').style.display = 'block';
      document.getElementById('error-message').textContent = `场景加载失败: ${err.message}`;
      // 加载重试参数并绑定按钮
      document.getElementById('error-overlay').setAttribute('data-retry-params', 
          JSON.stringify({ sceneName }));
      if (!window._errorButtonsBound) {
          window._errorButtonsBound = true;
          document.getElementById('error-retry-btn')?.addEventListener('click', () => {
              const raw = document.getElementById('error-overlay').getAttribute('data-retry-params');
              if (raw) {
                  const { sceneName } = JSON.parse(raw);
                  document.getElementById('error-overlay').style.display = 'none';
                  switchScene(sceneName);
              }
          });
          document.getElementById('error-close-btn')?.addEventListener('click', () => {
              document.getElementById('error-overlay').style.display = 'none';
          });
      }
  }
  ```

**#4 [scene-base.js] destroy() 未清除 `_animTimeout`**
- **位置**：`client/js/scene-base.js:76-87` + `client/js/renderers/ch0_r1_column_decompose.js:360`
- **症状**：`ch0_r1` 在 `buildScene()` 中 `this._animTimeout = setTimeout(() => this._startAnimation(), 350)`。`destroy()` 设置 `_animating = false` 后，350ms 内切换场景时，`_startAnimation()` 的 `if (this._animating) return;` 守卫失效（`false` → 继续执行），导致在已销毁场景上启动动画。
- **修复**：在 `SceneRenderer.destroy()` 中添加：
  ```js
  if (this._animTimeout) {
      clearTimeout(this._animTimeout);
      this._animTimeout = null;
  }
  ```

---

### 🟡 中级别问题

**#5 [10 个渲染器] rAF ID 未存储**（已知遗留项）
- **位置**：`ch0_r0:370`, `ch0_r1:434`, `ch1_r0:234`, `ch2_r0:254`, `ch2_r1:235`, `ch3_r0:194`, `ch3_r12:248`, `ch3_r13:234`, `ch3_r3:202`, `matrix_calculator:233`
- **影响**：`cancelAnimationFrame` 从未实际调用。`_animating = false` 守卫使回调立即返回，仅浪费一帧。
- **修复**：每个 `_animFrame()` 中改为 `this._animFrameId = requestAnimationFrame(() => this._animFrame());`
- **注意**：上次审计（v1.9）已记录此问题为「可延后」，仍未修复。

**#6 [main.js] 相机补间动画 rAF 未存储**
- **位置**：`client/js/main.js:449, 451`（`animateCamera()` 函数）
- **影响**：场景切换时，相机动画继续运行最多 800ms，访问可能过期的 camera/controls 引用。自终止无崩溃。
- **修复**：存储 rAF ID 并在 `switchScene()` 中取消。

**#7 [后端] API 参数无类型/范围验证**
- **位置**：`server/main.py:112-114` + `server/scenes/base.py:32-43`
- **影响**：`SceneParams(**body)` 接受任意键值对，不做类型/范围检查。恶意请求可传入极端值（`Infinity`、`NaN`、超大数字），导致 NumPy 内部错误。
- **修复**：在 `SceneParams.__init__()` 或 `compute_scene` 端点中，根据场景 `get_meta()["params"]` 的 `type`/`min`/`max` 定义做校验。

**#8 [异常处理] 3 处 overbroad `except Exception`**
- `server/math_engine.py:62-63` — `null_space()` 中 `except Exception: return None`，应限定 `LinAlgError`
- `server/ai_chat.py:139` — 解析错误响应，应限定 `json.JSONDecodeError`
- `server/scenes/ch3_r2_three_vectors.py:112-114` — `np.linalg.lstsq` 失败时静默标记为独立，应限定 `LinAlgError` 并记录

**#9 [后端重复] `_get_transform_data` / `_build_matrix` 3 份逐字拷贝**
- **位置**：`matrix_calculator.py:326-373`, `ch3_r12_elem_row.py:201-245`, `ch3_r13_elem_col.py:205-243`
- **影响**：修改一处需同步另两处，已出现细微差异（`matrix_calculator` 用 `mat.shape` 判断维度，另两个用 `n` 变量）。
- **修复**：提取到 `BaseScene` 或共享工具模块。

**#10 [场景基类] `_lectureCollapsed` 语义反转**
- **位置**：`client/js/scene-base.js:43, 484`
- **影响**：变量名为 `_lectureCollapsed`（`true` = 折叠），但 UI 箭头逻辑为 `this._lectureCollapsed ? '▼' : '▲'`。当 `_lectureCollapsed = false` 时显示 `▲`（实际含义：已展开）。变量实际保存的是「展开状态」，不是「折叠状态」。
- **修复**：重命名为 `_lectureExpanded` 并反转初始值，或修正箭头逻辑使其与变量名一致。

**#11 [待清理] `ch1_r0_det_area.py` 死赋值 + 误导注释**
- **位置**：`server/scenes/ch1_r0_det_area.py:71-73`
- **影响**：`diag1_start`, `diag1_end` 被计算但从未使用，注释暗示它们用于构建 `scene_data`，实际上用了 `p2` 独立计算。读代码时浪费理解时间。
- **修复**：删除这两行死代码。

---

### 🟢 低级别问题

**#12 [main.js] `getSceneMeta()` 500 行硬编码**
- **位置**：`client/js/main.js:594-1093`
- **影响**：24 个场景的元信息硬编码在一个函数中。后端 `/api/scenes` 已经返回这些数据。前端为离线快速切换做了镜像，但导致该函数膨胀。
- **建议**：考虑使用后端返回的数据，或拆分为独立文件 `scene-meta.js`。

**#13 [死代码] 6 个死函数 + 2 个死变量 + 3 个死 import**
- 死函数：`MathEngine.gram_schmidt()`, `MathEngine.projection_onto_plane()`, `MathEngine.to_list()`, `api.listScenes()`, `drawUtils.createBaseScene()`, `drawUtils.clearSceneObjects()`
- 死变量：`ch1_r0_det_area.py:72-73` (`diag1_start`, `diag1_end` 参见 #11)
- 死 import：`base.py` 的 `Optional`, `ch1_r2_det_properties.js` 的 `drawLine`
- **建议**：保留可能未来使用的（`gram_schmidt`, `projection_onto_plane`），删除确定无用的（`to_list`, `listScenes`, `createBaseScene`, `clearSceneObjects`, `diag1_*`, 死 import）。

**#14 [文档] CLAUDE.md 与代码标题不一致**
- CLAUDE.md 写 `ch2_r3_ax_eq_b` → "行视图与列视图"，代码实际 → "矩阵方程的行视图与列视图"
- CLAUDE.md 写 `ch2_r4_cramer` → "克拉默法则：解=体积比"，代码实际 → "克拉默法则的几何含义"
- **建议**：统一使用代码中的标题（更精确）同步回 CLAUDE.md。

**#15 [轻微违规] 面板相关元素的 `document.getElementById`**
- `main.js:106-108` — `panel-vis-toggle/menu/list` 直接获取。面板管理器已管理面板可见性，这些 UI 控件可考虑纳入面板系统 API。
- **评估**：轻微违规，功能正常，不阻塞。

---

### 💡 建议

**#16 [技术债] 10 个渲染器各有动画工厂函数拷贝**
- CLAUDE.md 已记录：「将动画工厂函数提取到 `draw-utils.js`」
- `createUpdatableWireframe`, `createUpdatableFaces`, `createAnimatableVectorLine` 在 ~10 个渲染器中各有完整拷贝
- 修复工作量估计：提取到 `draw-utils.js` 并一次性更新 10 个渲染器的 import，约 2-3 小时

---

## 正面发现

以下是本次审计中确认**做得好的地方**：

1. **注册完整性完美**：SCENE_REGISTRY（后端 24）+ SCENE_RENDERERS（前端 24）+ 导航菜单（24）= 完全对齐，零遗漏。
2. **路径遍历保护正确**：`server/main.py:245-259` 使用 `.resolve()` + `startswith` 的经典防御模式，实现正确。
3. **纹理清理完善**：v1.9 在 `_disposeRecursive()` 中加入的 `m.map.dispose()` 逻辑覆盖了所有 31 处 `CanvasTexture` 创建。
4. **无 XSS 危险 API**：全项目零 `document.write()`、零 `eval()`，AI 回复渲染前做了 HTML 转义。
5. **双缓冲异常回退**：v1.9 的 `buildScene()` try-catch + oldGroup 回退机制，有效防止了空场景残留。
6. **面板尺寸恢复已修复**：v1.9 将 `_restoreSize()` 移到 `this.el` 赋值之后，从零生效变为正常生效。
7. **节流定时器清理完整**：`_trailingTimer` 在 `destroy()` 和 `_clearThrottle()` 中都被正确处理。
8. **无空 catch 块**：所有 catch 块都有实际处理或合理注释（`/* ignore */`）。

---

## 建议优先级

### 本次必须修（⚠️ + 🔴）

| # | 问题 | 工作量估计 |
|---|------|-----------|
| 1 | ch0_r0 setTimeout 未存储 → 在 destroy() 前切场景可能崩溃 | 10 分钟 |
| 2 | 27 处 MathEngine 绕过 → 违反核心设计原则 | 1 小时 |
| 3 | switchScene 错误处理不一致 → 用户体验差 | 15 分钟 |
| 4 | destroy() 未清除 _animTimeout → 同 #1 的问题 | 5 分钟 |

### 建议尽快修（🟡）

| # | 问题 | 工作量估计 |
|---|------|-----------|
| 5 | 10 个渲染器 rAF ID 未存储 → 轻微泄漏 | 30 分钟 |
| 7 | API 参数无验证 | 1 小时 |
| 9 | `_get_transform_data` / `_build_matrix` 重复 → 维护风险 | 30 分钟 |
| 10 | `_lectureCollapsed` 语义反转 → 读代码困惑 | 5 分钟 |
| 11 | dead diag1 变量 + 误导注释 | 1 分钟 |

### 可以以后修（🟢 + 💡）

| # | 问题 | 工作量估计 |
|---|------|-----------|
| 6 | 相机补间 rAF | 10 分钟 |
| 8 | overbroad except | 15 分钟 |
| 12 | getSceneMeta() 500 行 | 2 小时 |
| 13 | 死代码清理 | 30 分钟 |
| 14 | 文档标题同步 | 5 分钟 |
| 15 | 面板相关 getElementById | 30 分钟 |
| 16 | 动画工厂函数去重 | 2-3 小时 |

---

## 审计后记

v1.9 健康度审查修了 9 个问题（3 内存泄露 + 3 功能 Bug + 3 死代码），效果显著。本次审计是在 v1.9 修复基础上的第二次全面审查。对比结论：

- **v1.9 修复全部生效**：纹理清理、双缓冲回退、面板尺寸恢复均已确认正常工作。
- **新增 4 个高危问题**：主要集中在资源生命周期（#1, #4）、架构合规（#2）、以及跨文件的代码一致性（#3）。这些问题在 v1.9 审查中未被覆盖，因为当时的重点是基类和核心基础设施，场景文件层面未逐行审查。
- **遗留项仍存在**：rAF ID 存储、动画工厂函数去重在上次审计已标记为「可延后」。

**审计员**：AI 审计员（Claude）· **下次建议审计时间**：修复 #1-#4 后或新增场景时。
