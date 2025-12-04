export type LanguageCode = string;

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
}

export interface ExampleSentence {
  target: string;
  native: string;
}

export interface DictionaryEntry {
  id: string; // Unique ID for keying
  term: string;
  explanation: string;
  examples: ExampleSentence[];
  funUsage: string; // The "chatty" explanation
  imageUrl?: string; // Base64 or URL
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Response schema for the Gemini JSON generation
export interface DefinitionResponse {
  explanation: string;
  examples: ExampleSentence[];
  funUsage: string;
}
