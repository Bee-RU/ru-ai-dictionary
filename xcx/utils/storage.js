const KEY = 'lingopop_notebook';

export function loadNotebook() {
  try {
    const saved = wx.getStorageSync(KEY);
    return Array.isArray(saved) ? saved : (saved ? JSON.parse(saved) : []);
  } catch (e) {
    return [];
  }
}

export function saveNotebook(words) {
  try {
    wx.setStorageSync(KEY, words);
  } catch (e) {}
}
