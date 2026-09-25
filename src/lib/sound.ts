// Web Audio API ile harici mp3 dosyasına ihtiyaç duymadan gerçekçi otel mutfak sipariş zili
export function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Çift tonlu prestijli otel mutfak zili (Ding - Dong)
    playNote(880, now, 0.4);       // A5
    playNote(1174.66, now + 0.15, 0.8); // D6
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}
