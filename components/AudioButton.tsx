import React, { useState, useRef } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface AudioButtonProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Helper: Convert raw PCM 16-bit integers to AudioBuffer
// The Gemini API returns raw PCM data (16-bit signed integer, 24kHz usually for this model)
// Native ctx.decodeAudioData expects a file container (WAV/MP3), so we must decode manually.
const pcmToAudioBuffer = (
  buffer: ArrayBuffer,
  ctx: AudioContext,
  sampleRate: number = 24000
): AudioBuffer => {
  const byteLength = buffer.byteLength;
  // Ensure we map to Int16 correctly. 
  // Int16Array requires byteLength to be a multiple of 2.
  const int16Data = new Int16Array(buffer, 0, Math.floor(byteLength / 2));
  
  const audioBuffer = ctx.createBuffer(1, int16Data.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < int16Data.length; i++) {
    // Normalize 16-bit signed integer (-32768 to 32767) to float [-1.0, 1.0]
    channelData[i] = int16Data[i] / 32768.0;
  }
  
  return audioBuffer;
};

const AudioButton: React.FC<AudioButtonProps> = ({ text, size = 'md', className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      // Initialize Audio Context on user gesture
      // We do not enforce a sampleRate on the context itself to ensure hardware compatibility.
      // The buffer will define the source sample rate (24kHz).
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioData = await generateSpeech(text); // Returns ArrayBuffer of raw PCM
      
      // Manually decode raw PCM instead of using decodeAudioData
      const audioBuffer = pcmToAudioBuffer(audioData, ctx, 24000);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setIsLoading(false);
    }
  };

  const iconSize = size === 'sm' ? 16 : size === 'md' ? 20 : 24;

  return (
    <button
      onClick={playAudio}
      disabled={isLoading}
      className={`text-secondary hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100 ${className}`}
      title="Listen"
    >
      {isLoading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <Volume2 size={iconSize} />
      )}
    </button>
  );
};

export default AudioButton;