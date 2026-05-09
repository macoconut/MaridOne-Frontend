type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let audioContext: AudioContext | null = null;
let primerInstalled = false;

function resolveAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

async function unlockAudioContext() {
  const context = resolveAudioContext();
  if (!context) return false;

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }

  return context.state === 'running';
}

export function installNotificationSoundPrimer() {
  if (typeof window === 'undefined' || primerInstalled) return;

  primerInstalled = true;

  const attemptUnlock = () => {
    void unlockAudioContext();
  };

  window.addEventListener('pointerdown', attemptUnlock, true);
  window.addEventListener('keydown', attemptUnlock, true);
  window.addEventListener('touchstart', attemptUnlock, true);
}

export async function playNotificationSound() {
  const context = resolveAudioContext();
  if (!context) return;

  const unlocked = await unlockAudioContext();
  if (!unlocked) return;

  const now = context.currentTime;
  const masterGain = context.createGain();
  const brightener = context.createBiquadFilter();

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.036, now + 0.03);
  masterGain.gain.exponentialRampToValueAtTime(0.02, now + 0.16);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

  brightener.type = 'highshelf';
  brightener.frequency.setValueAtTime(2200, now);
  brightener.gain.setValueAtTime(1.8, now);

  masterGain.connect(brightener);
  brightener.connect(context.destination);

  const noteOne = context.createOscillator();
  noteOne.type = 'sine';
  noteOne.frequency.setValueAtTime(784, now);
  noteOne.frequency.exponentialRampToValueAtTime(880, now + 0.16);
  noteOne.connect(masterGain);
  noteOne.start(now);
  noteOne.stop(now + 0.22);

  const noteTwo = context.createOscillator();
  noteTwo.type = 'triangle';
  noteTwo.frequency.setValueAtTime(1046.5, now + 0.12);
  noteTwo.frequency.exponentialRampToValueAtTime(1174.66, now + 0.34);
  noteTwo.connect(masterGain);
  noteTwo.start(now + 0.12);
  noteTwo.stop(now + 0.42);

  window.setTimeout(() => {
    noteOne.disconnect();
    noteTwo.disconnect();
    masterGain.disconnect();
    brightener.disconnect();
  }, 900);
}
