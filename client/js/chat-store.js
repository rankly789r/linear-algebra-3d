/**
 * 聊天记录持久化模块 — 基于 IndexedDB 存储每个场景的 AI 对话历史。
 *
 * 数据库: la_chat_history
 * 对象存储: chats (keyPath: sceneName)
 * 每条记录: { sceneName, messages: [{role, content, timestamp}], updatedAt }
 */

const DB_NAME = 'la_chat_history';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('chats')) {
                db.createObjectStore('chats', { keyPath: 'sceneName' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * 加载指定场景的聊天记录
 * @param {string} sceneName
 * @returns {Promise<Array>} 消息数组 [{role, content, timestamp}, ...]
 */
export async function loadChat(sceneName) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readonly');
            const store = tx.objectStore('chats');
            const req = store.get(sceneName);
            req.onsuccess = () => {
                const record = req.result;
                resolve(record ? record.messages : []);
            };
            req.onerror = () => resolve([]);
            tx.oncomplete = () => db.close();
        });
    } catch {
        return [];
    }
}

/**
 * 保存指定场景的聊天记录（过滤掉 __LOADING__ 占位消息）
 * @param {string} sceneName
 * @param {Array} messages
 */
export async function saveChat(sceneName, messages) {
    if (!sceneName || messages.length === 0) return;
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');
            const clean = messages
                .filter(m => m.content !== '__LOADING__')
                .map(m => ({ ...m, timestamp: m.timestamp || Date.now() }));
            store.put({ sceneName, messages: clean, updatedAt: Date.now() });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); resolve(); };
        });
    } catch {
        // 静默失败 — 聊天记录不是关键数据
    }
}

/**
 * 清空指定场景的聊天记录
 * @param {string} sceneName
 */
export async function clearChat(sceneName) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');
            store.delete(sceneName);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); resolve(); };
        });
    } catch {
        // 静默失败
    }
}
