import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

const program = new Command();

program
  .name('prompt-asset-sound')
  .description('Generate WAV audio')
  .version('0.1.0');

function generateWave(freq: number, duration: number, type: string): Float32Array {
  const sampleRate = 44100;
  const n = Math.floor(sampleRate * duration);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    switch (type) {
      case 'square': data[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
      case 'saw': data[i] = 2 * ((freq * t) % 1) - 1; break;
      case 'triangle': data[i] = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1; break;
      default: data[i] = Math.sin(2 * Math.PI * freq * t);
    }
  }
  return data;
}

function encodeWav(channelData: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channelData.length;
  const length = channelData[0].length;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + dataSize, true); // file size - 8
  view.setUint32(8, 0x57415645, false); // 'WAVE'

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, dataSize, true);

  // Interleave channel data
  const dataOffset = 44;
  const dataView = new Int16Array(buffer, dataOffset, dataSize / 2);
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      dataView[i * numChannels + ch] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
  }

  return new Uint8Array(buffer);
}

program
  .command('synth')
  .requiredOption('--out <path>', 'Output WAV')
  .option('--freq <hz>', 'Frequency', '440')
  .option('--duration <sec>', 'Duration', '2')
  .option('--type <kind>', 'Waveform', 'sine')
  .action(async (opts) => {
    const data = generateWave(parseFloat(opts.freq), parseFloat(opts.duration), opts.type);
    const wavBytes = encodeWav([data], 44100);
    await fs.ensureDir(path.dirname(opts.out));
    await fs.writeFile(opts.out, Buffer.from(wavBytes));
    console.log(`Wrote ${opts.out}`);
  });

program.parse();