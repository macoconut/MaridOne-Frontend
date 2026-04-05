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
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.028, now + 0.02);
  masterGain.gain.exponentialRampToValueAtTime(0.012, now + 0.14);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  masterGain.connect(context.destination);

  const noteOne = context.createOscillator();
  noteOne.type = 'sine';
  noteOne.frequency.setValueAtTime(740, now);
  noteOne.frequency.exponentialRampToValueAtTime(880, now + 0.12);
  noteOne.connect(masterGain);
  noteOne.start(now);
  noteOne.stop(now + 0.16);

  const noteTwo = context.createOscillator();
  noteTwo.type = 'triangle';
  noteTwo.frequency.setValueAtTime(988, now + 0.12);
  noteTwo.frequency.exponentialRampToValueAtTime(1174, now + 0.28);
  noteTwo.connect(masterGain);
  noteTwo.start(now + 0.12);
  noteTwo.stop(now + 0.34);

  window.setTimeout(() => {
    noteOne.disconnect();
    noteTwo.disconnect();
    masterGain.disconnect();
  }, 750);
}
