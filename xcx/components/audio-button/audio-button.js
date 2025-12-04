import { generateSpeech } from '../../utils/geminiService';

Component({
  properties: {
    text: { type: String, value: '' },
    size: { type: String, value: 'md' }
  },
  data: { loading: false },
  methods: {
    async onTap(e) {
      if (this.data.loading) return;
      this.setData({ loading: true });
      try {
        const dataUrl = await generateSpeech(this.data.text);
        const audio = wx.createInnerAudioContext();
        audio.autoplay = true;
        audio.src = dataUrl;
        audio.onEnded(() => { audio.destroy(); });
        audio.onError(() => { audio.destroy(); });
      } catch (err) {
      } finally {
        this.setData({ loading: false });
      }
    }
  }
});
