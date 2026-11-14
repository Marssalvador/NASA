/**
 * Offline authoring tool (never runs in the app): generates one section still and a slow
 * image-to-video clip through the Sunra queue API. The key is read from the project .env
 * and never printed. Outputs go to assets/illustrations/source/ (git-ignored originals).
 *
 *   node frontend/scripts/generate-section-video.mjs image heart
 *   node frontend/scripts/generate-section-video.mjs video heart
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = root + 'assets/illustrations/source/';
const API = 'https://api.sunra.ai/v1';

const env = await readFile(root + '.env', 'utf8');
const key = env
  .split(/\r?\n/)
  .map((line) => line.match(/^\s*sunra[a-z_]*\s*=\s*(.+?)\s*$/i)?.[1])
  .find(Boolean)
  ?.replace(/^['"]|['"]$/g, '');
if (!key) throw new Error('No Sunra key found in .env');
const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };

const SECTIONS = {
  heart: {
    image:
      'Photorealistic futuristic medical 3D visualization, close-up of an adult human torso from the neck to the upper abdomen, ' +
      'frontal view, centered. Translucent frosted-glass anatomy in soft white and pale grey: skin and muscles semi-transparent ' +
      'but clearly visible, ribcage and clavicles, trachea, translucent grey lungs with fine bronchial trees, thin red arteries ' +
      'and soft grey-blue veins. The anatomical heart in the center glows warm red-orange from within with a soft halo. ' +
      'Healthy generic anatomy, no lesions, no blood. Warm off-white studio background (#f4f1ee), soft diffused studio light, ' +
      'subtle depth of field, premium scientific render. No text, no labels, no UI, no watermark, no border.',
    video:
      'Locked-off camera, no camera movement. The heart beats gently and slowly; its soft red glow pulses calmly and ' +
      'light flows softly through the red arteries. The rest of the anatomy stays perfectly still. Fixed lighting, ' +
      'smooth slow motion, the last frame matches the first frame.',
    negative:
      'text, labels, watermark, morphing, distortion, extra organs, blood, wounds, fast motion, flicker, camera shake, cuts',
  },
};

async function run(model, input) {
  const submit = await fetch(`${API}/queue/${model}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const ticket = await submit.json();
  if (!submit.ok || !ticket.request_id)
    throw new Error(`Submit failed (${submit.status}): ${JSON.stringify(ticket).slice(0, 400)}`);
  console.log(model, 'queued', ticket.request_id);
  for (let i = 0; i < 360; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await (
      await fetch(`${API}/queue/requests/${ticket.request_id}/status`, { headers })
    ).json();
    if (i % 6 === 0) console.log('  status', status.status, status.queue_position ?? '');
    if (status.status === 'COMPLETED') {
      if (status.success === false || status.error)
        throw new Error(`Generation failed: ${JSON.stringify(status.error).slice(0, 400)}`);
      return (await fetch(`${API}/queue/requests/${ticket.request_id}`, { headers })).json();
    }
  }
  throw new Error('Timed out waiting for Sunra');
}

/** Finds the first media URL in a result payload, whatever the model's schema. */
function mediaUrl(value) {
  if (typeof value === 'string') return /^https?:\/\/\S+\.(png|jpe?g|webp|mp4|webm)(\?|$)/i.test(value) ? value : null;
  if (value && typeof value === 'object')
    for (const item of Object.values(value)) {
      const found = mediaUrl(item);
      if (found) return found;
    }
  return null;
}
async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log('saved', file.replace(root, ''));
}

const [step, section = 'heart'] = process.argv.slice(2);
const spec = SECTIONS[section];
if (!spec) throw new Error(`Unknown section ${section}`);
await mkdir(out, { recursive: true });

if (step === 'image') {
  const result = await run('openai/gpt-image-2/text-to-image', {
    prompt: spec.image,
    quality: 'high',
    size: '1536x1024',
    output_format: 'png',
  });
  const url = mediaUrl(result);
  if (!url) throw new Error(`No image in result: ${JSON.stringify(result).slice(0, 400)}`);
  await writeFile(out + `${section}-sunra.json`, JSON.stringify({ url, model: 'openai/gpt-image-2', prompt: spec.image }, null, 2));
  await download(url, out + `${section}-sunra.png`);
} else if (step === 'video') {
  const still = JSON.parse(await readFile(out + `${section}-sunra.json`, 'utf8'));
  // Same start and end frame: the model authors a closed loop instead of a hard cut.
  const result = await run('kling/kling-v3-standard/image-to-video', {
    prompt: spec.video,
    negative_prompt: spec.negative,
    cfg_scale: 0.5,
    duration: '10',
    generate_audio: false,
    start_image_url: still.url,
    end_image_url: still.url,
  });
  const url = mediaUrl(result);
  if (!url) throw new Error(`No video in result: ${JSON.stringify(result).slice(0, 400)}`);
  await writeFile(
    out + `${section}-sunra-video.json`,
    JSON.stringify({ url, model: 'kling/kling-v3-standard', prompt: spec.video, negative: spec.negative }, null, 2),
  );
  await download(url, out + `${section}-sunra-raw.mp4`);
} else throw new Error('Usage: image|video <section>');
