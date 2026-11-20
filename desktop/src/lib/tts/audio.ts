/**
 * Text-To-Speech (TTS) Engine for Audio Storytelling
 * Uses Web Speech API with fallback and offline support.
 */

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  rate: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 1.5
  volume: number; // 0.0 - 1.0
  currentSentence: string;
}

export class NovelTTSPlayer {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  public rate: number = 1.0;
  public pitch: number = 1.0;
  public volume: number = 1.0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public getVietnameseVoice(): SpeechSynthesisVoice | null {
    const voices = this.getAvailableVoices();
    return voices.find(v => v.lang.startsWith('vi')) || voices[0] || null;
  }

  public speak(
    text: string,
    onProgress?: (charIndex: number) => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): boolean {
    if (!this.synth) {
      onError?.('Trình duyệt không hỗ trợ Web Speech API TTS.');
      return false;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    const vnVoice = this.getVietnameseVoice();
    if (vnVoice) {
      utterance.voice = vnVoice;
    }
    utterance.lang = 'vi-VN';
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    utterance.onboundary = (e) => {
      onProgress?.(e.charIndex);
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      onError?.(e.error);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    return true;
  }

  public pause(): void {
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
    }
  }

  public resume(): void {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return Boolean(this.synth && this.synth.speaking && !this.synth.paused);
  }
}

export const ttsPlayer = new NovelTTSPlayer();
