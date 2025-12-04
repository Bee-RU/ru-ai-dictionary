import { fetchDefinition, generateIllustration, sendChatMessage, generateStoryFromWords } from '../../utils/geminiService';
import { loadNotebook, saveNotebook } from '../../utils/storage';

Page({
  data: {
    languages: [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'es', name: 'Spanish', flag: '🇪🇸' },
      { code: 'fr', name: 'French', flag: '🇫🇷' },
      { code: 'de', name: 'German', flag: '🇩🇪' },
      { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
      { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
      { code: 'ko', name: 'Korean', flag: '🇰🇷' },
      { code: 'it', name: 'Italian', flag: '🇮🇹' },
      { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
      { code: 'ru', name: 'Russian', flag: '🇷🇺' }
    ],
    nativeLang: {},
    targetLang: {},
    view: 'search',
    query: '',
    isLoading: false,
    currentResult: null,
    savedWords: [],
    chatOpen: false,
    chatHistory: [],
    chatInput: '',
    isChatLoading: false,
    story: '',
    isStoryLoading: false,
    randomEntry: null
  },
  onLoad() {
    const saved = loadNotebook();
    this.setData({ savedWords: saved });
  },
  onPickLang(e) {
    const { code, type } = e.currentTarget.dataset;
    const lang = this.data.languages.find(l => l.code === code);
    if (type === 'native') this.setData({ nativeLang: lang });
    if (type === 'target') this.setData({ targetLang: lang });
  },
  onStart() {
    this.setData({ view: 'search' });
  },
  onInput(e) { this.setData({ query: e.detail.value }); },
  async onSearch(e) {
    e && e.detail && e.detail.value;
    const { query, nativeLang, targetLang } = this.data;
    if (!query.trim() || !nativeLang.code || !targetLang.code) return;
    this.setData({ isLoading: true, currentResult: null, chatHistory: [] });
    try {
      const def = await fetchDefinition(query, nativeLang, targetLang);
      const imagePromise = generateIllustration(query);
      const entry = {
        id: `${Date.now()}`,
        term: query,
        explanation: def.explanation,
        examples: def.examples || [],
        funUsage: def.funUsage || '',
        timestamp: Date.now()
      };
      this.setData({ currentResult: entry });
      const imageUrl = await imagePromise;
      if (imageUrl) this.setData({ currentResult: { ...this.data.currentResult, imageUrl } });
    } catch (err) {
      wx.showToast({ title: 'AI 请求失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },
  onToggleSave() {
    const { currentResult, savedWords } = this.data;
    if (!currentResult) return;
    const exists = savedWords.find(w => w.id === currentResult.id);
    let next;
    if (exists) next = savedWords.filter(w => w.id !== currentResult.id);
    else next = [currentResult, ...savedWords];
    this.setData({ savedWords: next });
    saveNotebook(next);
  },
  openChat() { this.setData({ chatOpen: true }); },
  closeChat() { this.setData({ chatOpen: false }); },
  onChatInput(e) { this.setData({ chatInput: e.detail.value }); },
  async onChatSubmit(e) {
    const msg = this.data.chatInput;
    const { currentResult, targetLang } = this.data;
    if (!msg.trim() || !currentResult || !targetLang.code) return;
    const history = [...this.data.chatHistory, { role: 'user', text: msg }];
    this.setData({ chatInput: '', chatHistory: history, isChatLoading: true });
    const reply = await sendChatMessage(this.data.chatHistory, msg, currentResult, targetLang);
    this.setData({ chatHistory: [...this.data.chatHistory, { role: 'model', text: reply }], isChatLoading: false });
  },
  async onGenStory() {
    const { savedWords, nativeLang, targetLang } = this.data;
    if (savedWords.length < 2 || !nativeLang.code || !targetLang.code) return;
    this.setData({ isStoryLoading: true });
    const res = await generateStoryFromWords(savedWords.slice(0, 10), nativeLang, targetLang);
    this.setData({ story: res, isStoryLoading: false });
  },
  onDeleteSaved(e) {
    const id = e.currentTarget.dataset.id;
    const next = this.data.savedWords.filter(w => w.id !== id);
    this.setData({ savedWords: next });
    saveNotebook(next);
  },
  toSearch() { this.setData({ view: 'search' }); },
  toNotebook() { this.setData({ view: 'notebook' }); },
  toLearn() { 
    const { savedWords } = this.data;
    const random = savedWords.length ? savedWords[Math.floor(Math.random() * savedWords.length)] : null;
    this.setData({ view: 'learn', randomEntry: random });
  },
  onNextCard() {
    const { savedWords } = this.data;
    const random = savedWords.length ? savedWords[Math.floor(Math.random() * savedWords.length)] : null;
    this.setData({ randomEntry: random });
  }
});
