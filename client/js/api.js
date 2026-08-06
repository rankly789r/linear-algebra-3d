/**
 * API 通信模块 — 所有与 Python 后端的通信必须通过此模块。
 *
 * 规则：
 * 1. 前端不得实现任何线性代数计算。
 * 2. 所有场景数据通过此模块向后端请求。
 */

const API_BASE = '';

/**
 * 调用场景计算 API
 * @param {string} sceneName - 场景标识，如 "ch3_r1_two_vectors"
 * @param {Object} params - 场景参数
 * @returns {Promise<Object>} {success, data, error}
 */
export async function computeScene(sceneName, params = {}) {
    try {
        const response = await fetch(`${API_BASE}/api/scene/${sceneName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return {
                success: false,
                data: null,
                error: errData.error || `HTTP ${response.status}: 服务器错误`
            };
        }

        return await response.json();
    } catch (err) {
        return {
            success: false,
            data: null,
            error: `网络请求失败: ${err.message}`
        };
    }
}

/**
 * 获取所有已注册场景的元信息
 * @returns {Promise<Array>}
 */
/**
 * 调用 AI 答疑 API（支持 function calling 工具调用）
 * @param {string} sceneName - 场景标识
 * @param {Object} params - 当前场景参数
 * @param {string} message - 用户问题
 * @param {Array} history - 聊天历史 [{role: "user"|"assistant", content: "..."}]
 * @param {string} apiKey - DeepSeek API Key
 * @returns {Promise<Object>} {success, data: {reply: string, tool_calls: Array|null}}
 *   tool_calls: null 或 [{action: "set_params", reason: string, params: Object}]
 */
export async function askAI(sceneName, params, message, history = [], apiKey = '') {
    try {
        const response = await fetch(`${API_BASE}/api/chat/${sceneName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ params, message, history, api_key: apiKey })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return {
                success: false,
                data: null,
                error: errData.error || `HTTP ${response.status}: AI 服务错误`
            };
        }

        return await response.json();
    } catch (err) {
        return {
            success: false,
            data: null,
            error: `AI 请求失败: ${err.message}`
        };
    }
}

/**
 * 调用 AI 笔记生成 API
 * @param {string} sceneName
 * @param {Object} sceneData - 场景计算数据
 * @param {Array} chatHistory - 聊天历史
 * @param {string} apiKey
 * @returns {Promise<Object>} {success, data: {note: "..."}}
 */
export async function generateNote(sceneName, sceneData, chatHistory = [], apiKey = '') {
    try {
        const response = await fetch(`${API_BASE}/api/notes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scene_name: sceneName,
                scene_data: sceneData,
                chat_history: chatHistory,
                api_key: apiKey
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return {
                success: false,
                data: null,
                error: errData.error || `HTTP ${response.status}: 笔记生成失败`
            };
        }

        return await response.json();
    } catch (err) {
        return {
            success: false,
            data: null,
            error: `网络请求失败: ${err.message}`
        };
    }
}

export async function listScenes() {
    try {
        const response = await fetch(`${API_BASE}/api/scenes`);
        const result = await response.json();
        if (result.success) {
            return result.data;
        }
        return [];
    } catch (err) {
        console.error('获取场景列表失败:', err);
        return [];
    }
}
