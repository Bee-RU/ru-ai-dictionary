const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getApiKey() {
  try {
    const app = getApp();
    const key = wx.getStorageSync(app?.globalData?.apiKeyStorageKey || 'lingopop_api_key');
    return key || '';
  } catch (e) {
    return '';
  }
}

function callModel(model, body) {
  const apiKey = getApiKey();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: body,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`));
        }
      },
      fail: reject,
    });
  });
}

function extractText(data) {
  const c = data && data.candidates && data.candidates[0];
  const parts = c && c.content && c.content.parts ? c.content.parts : [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].text) return parts[i].text;
  }
  return '';
}

export async function fetchDefinition(term, nativeLang, targetLang) {
  const prompt = `Act as a fun, modern dictionary.\nTerm: "${term}"\nTarget Language: ${targetLang.name}\nUser's Native Language: ${nativeLang.name}\n\nProvide:\n1. A natural explanation in ${nativeLang.name}.\n2. Two example sentences in ${targetLang.name} with ${nativeLang.name} translations.\n3. A "funUsage" section: Explain it like a cool friend. Include cultural context, vibes, slang, or how to avoid awkward mistakes. Be concise and witty.`;
  const data = await callModel('gemini-2.5-flash', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: 'application/json'
    }
  });
  const text = extractText(data);
  try {
    return JSON.parse(text);
  } catch (e) {
    return { explanation: text || '', examples: [], funUsage: '' };
  }
}

export async function generateIllustration(term) {
  const prompt = `Create a fun, vibrant, simple vector-art style illustration that represents the concept of "${term}". Minimalist background. Bright colors.`;
  const data = await callModel('gemini-2.5-flash-image', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  const c = data && data.candidates && data.candidates[0];
  const parts = c && c.content && c.content.parts ? c.content.parts : [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].inlineData && parts[i].inlineData.data) {
      const mime = parts[i].inlineData.mimeType || 'image/png';
      return `data:${mime};base64,${parts[i].inlineData.data}`;
    }
  }
  return undefined;
}

function pcmToWavBase64(pcmBase64, sampleRate = 24000, numChannels = 1) {
  const raw = wx.base64ToArrayBuffer(pcmBase64);
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = raw.byteLength;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, headerSize).set(new Uint8Array(raw));
  const wavBase64 = wx.arrayBufferToBase64(buffer);
  return `data:audio/wav;base64,${wavBase64}`;
}

export async function generateSpeech(text, voiceName = 'Puck') {
  const data = await callModel('gemini-2.5-flash-preview-tts', {
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      response_modalities: ['AUDIO'],
      speech_config: {
        voice_config: {
          prebuilt_voice_config: { voiceName }
        }
      }
    }
  });
  const c = data && data.candidates && data.candidates[0];
  const part = c && c.content && c.content.parts && c.content.parts[0];
  const base64Audio = part && part.inlineData && part.inlineData.data;
  if (!base64Audio) throw new Error('No audio data');
  return pcmToWavBase64(base64Audio, 24000, 1);
}

export async function generateStoryFromWords(words, nativeLang, targetLang) {
  const wordList = words.map(w => w.term).join(', ');
  const prompt = `Write a short, funny, and coherent story in ${targetLang.name} using these words: [${wordList}].\nAfter the story, provide a translation in ${nativeLang.name}.\nKeep it simple and engaging.`;
  const data = await callModel('gemini-2.5-flash', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  return extractText(data) || 'Could not generate story.';
}

export async function sendChatMessage(history, newMessage, context, targetLang) {
  const systemIntro = `We are discussing the word "${context.term}" (Definition: ${context.explanation}, Usage: ${context.funUsage}). Target Language: ${targetLang.name}.`;
  const contents = [
    { role: 'user', parts: [{ text: systemIntro }] },
    { role: 'model', parts: [{ text: "Got it! I'm ready to answer any follow-up questions about this word contextually." }] }
  ];
  for (let i = 0; i < history.length; i++) {
    contents.push({ role: history[i].role, parts: [{ text: history[i].text }] });
  }
  contents.push({ role: 'user', parts: [{ text: newMessage }] });
  const data = await callModel('gemini-2.5-flash', { contents });
  return extractText(data);
}
