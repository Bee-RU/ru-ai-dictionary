import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DefinitionResponse, Language, DictionaryEntry } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 1. Generate Dictionary Definition (JSON)
 */
export const fetchDefinition = async (
  term: string,
  nativeLang: Language,
  targetLang: Language
): Promise<DefinitionResponse> => {
  try {
    const prompt = `
      Act as a fun, modern dictionary.
      Term: "${term}"
      Target Language: ${targetLang.name}
      User's Native Language: ${nativeLang.name}

      Provide:
      1. A natural explanation in ${nativeLang.name}.
      2. Two example sentences in ${targetLang.name} with ${nativeLang.name} translations.
      3. A "funUsage" section: Explain it like a cool friend. Include cultural context, vibes, slang, or how to avoid awkward mistakes. Be concise and witty. Do NOT be textbook style.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING },
                  native: { type: Type.STRING },
                },
              },
            },
            funUsage: { type: Type.STRING },
          },
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as DefinitionResponse;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Definition Error:", error);
    throw error;
  }
};

/**
 * 2. Generate Image
 * Uses gemini-2.5-flash-image for generating a visual representation.
 */
export const generateIllustration = async (term: string): Promise<string | undefined> => {
  try {
    const prompt = `Create a fun, vibrant, simple vector-art style illustration that represents the concept of "${term}". Minimalist background. Bright colors.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      // No responseMimeType for image generation models generally
    });

    // Extract image from parts
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    return undefined;
  } catch (error) {
    console.error("Image Gen Error:", error);
    // Fail silently for images, app can live without it
    return undefined;
  }
};

/**
 * 3. Text to Speech
 * Uses gemini-2.5-flash-preview-tts
 */
export const generateSpeech = async (text: string, voiceName: 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' = 'Puck'): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

/**
 * 4. Story Generation
 */
export const generateStoryFromWords = async (
  words: DictionaryEntry[],
  nativeLang: Language,
  targetLang: Language
): Promise<string> => {
  try {
    const wordList = words.map(w => w.term).join(", ");
    const prompt = `
      Write a short, funny, and coherent story in ${targetLang.name} using these words: [${wordList}].
      After the story, provide a translation in ${nativeLang.name}.
      Keep it simple and engaging.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Could not generate story.";
  } catch (error) {
    console.error("Story Error:", error);
    return "Sorry, I couldn't write a story right now.";
  }
};

/**
 * 5. Chat Response
 */
export const sendChatMessage = async (
  history: { role: 'user' | 'model'; text: string }[],
  newMessage: string,
  context: DictionaryEntry,
  targetLang: Language
) => {
    try {
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: [
                {
                    role: 'user',
                    parts: [{ text: `We are discussing the word "${context.term}" (Definition: ${context.explanation}, Usage: ${context.funUsage}). Target Language: ${targetLang.name}.` }]
                },
                {
                    role: 'model',
                    parts: [{ text: "Got it! I'm ready to answer any follow-up questions about this word contextually." }]
                },
                ...history.map(h => ({
                    role: h.role,
                    parts: [{ text: h.text }]
                }))
            ]
        });

        const result = await chat.sendMessage({ message: newMessage });
        return result.text;
    } catch (e) {
        console.error(e);
        return "Sorry, I'm having trouble chatting right now.";
    }
}
