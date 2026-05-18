/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundManager {
  private ctx: AudioContext | null = null;

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    try {
      const ctx = this.getCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playPlace() {
    this.playTone(440, 'sine', 0.1, 0.05);
  }

  playClear() {
    this.playTone(220, 'sine', 0.15, 0.03);
  }

  playHint() {
    const ctx = this.getCtx();
    this.playTone(523.25, 'triangle', 0.2, 0.05);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.05), 100);
  }

  playWin() {
    const tones = [523.25, 659.25, 783.99, 1046.50];
    tones.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.5, 0.05), i * 150);
    });
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.2, 0.03);
  }
}

export const sounds = new SoundManager();
