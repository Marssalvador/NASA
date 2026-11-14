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

/** Shared art direction: dark mission-control theme, luminous glass anatomy, one warm focus. */
const STYLE =
  'Photorealistic futuristic medical 3D visualization on a deep space-black background (#04060b) with a very faint cool ' +
  'blue haze. Translucent frosted-glass anatomy in luminous white and pale silver-blue with soft cyan-white rim light, ' +
  'thin red arteries and subtle blue veins. Premium cinematic scientific render, high detail, soft depth of field, ' +
  'composition centered with generous dark margins on every side. Healthy generic anatomy, no lesions, no blood. ' +
  'No text, no labels, no UI, no watermark, no border.';
const NEGATIVE =
  'text, labels, watermark, morphing, distortion, extra organs, blood, wounds, fast motion, flicker, camera shake, cuts';
const SECTIONS = {
  heart: {
    image:
      'Close-up of an adult human torso from the neck to the upper abdomen, frontal view: ribcage, clavicles, trachea, ' +
      'translucent lungs with fine bronchial trees; the anatomical heart in the center glows warm red-orange from within ' +
      'with a soft halo. ' + STYLE,
    video:
      'Locked-off camera, no camera movement. The heart beats gently and slowly; its warm glow pulses calmly and light ' +
      'flows softly through the red arteries. The rest of the anatomy stays perfectly still. Fixed lighting, smooth slow ' +
      'motion, the last frame matches the first frame.',
    negative: NEGATIVE,
  },
  lungs: {
    image:
      'Close-up of an adult human torso from the neck to the upper abdomen, frontal view: the trachea and both lungs with ' +
      'detailed bronchial trees glow soft warm orange from within; ribcage and heart faintly visible behind glass. ' + STYLE,
  },
  kidneys: {
    image:
      'Posterior oblique view of an adult lower back and abdomen: lumbar spine, lower ribs and both kidneys with renal ' +
      'arteries and ureters; the kidneys glow warm red-orange from within. ' + STYLE,
  },
  brain: {
    image:
      'Three-quarter view of an adult head and neck: a calm translucent glass face and skull revealing the brain and ' +
      'brainstem; the brain glows warm red-orange from within with fine neural detail. ' + STYLE,
  },
  skeleton: {
    image:
      'Adult pelvis, lumbar spine and upper femurs inside a translucent glass body, frontal view; ivory-white bones, the ' +
      'hip joints and femoral necks glow warm red-orange from within. ' + STYLE,
  },
  muscles: {
    image:
      'Adult torso and thighs, frontal view: translucent glass skin over clearly defined pectoral, abdominal and ' +
      'quadriceps muscles in soft red tones that glow gently warm from within. ' + STYLE,
  },
  metabolic: {
    image:
      'Adult abdomen, frontal view inside a translucent glass torso: liver, stomach, pancreas and intestines; the liver ' +
      'and pancreas glow warm red-orange from within. ' + STYLE,
  },
  backdrop: {
    image:
      'Ultra-wide cinematic deep space background for a futuristic mission-control interface. The upper 80% is calm, ' +
      'almost black navy space with a sparse fine starfield and a very faint nebula haze. At the very bottom edge, the ' +
      'curved horizon of planet Earth at night: golden city lights, a thin luminous blue atmospheric rim and a soft glow ' +
      'reflecting upward. Huge empty dark negative space, photorealistic, no spacecraft, no text, no UI, no watermark.',
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
