// Offline geometry inspection only. No browser, server, WebGL, or page capture.
// SVGRenderer omits textures, shadows, water shaders, and post-processing.
// Usage: node scripts/render-harbor-preview.mjs [--position=25,22,33] [--target=-3,0,0]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [name, ...value] = argument.replace(/^--/, '').split('=');
  return [name, value.join('=')];
}));
const vector = (input, fallback) => (input ? input.split(',').map(Number) : fallback);
const width = Number(args.width || 1600), height = Number(args.height || 1000);
const position = vector(args.position, [25, 22, 33]);
const target = vector(args.target, [-3, 0, 0]);
const fov = Number(args.fov || 38);
if (![width, height, fov, ...position, ...target].every(Number.isFinite)) throw new Error('Invalid numeric argument.');

// Minimal serialization adapter for Three's CPU vector renderer, not a DOM/browser.
class VectorElement {
  constructor(tag) { this.tag = tag; this.attributes = {}; this.childNodes = []; this.style = {}; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) { this.childNodes.push(child); return child; }
  removeChild(child) { this.childNodes.splice(this.childNodes.indexOf(child), 1); return child; }
  get outerHTML() {
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    const attributes = Object.entries(this.attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ');
    return `<${this.tag} ${attributes}>${this.childNodes.map(child => child.outerHTML).join('')}</${this.tag}>`;
  }
}
globalThis.document = { createElementNS: (_namespace, tag) => new VectorElement(tag) };
const { createHarbor } = await import('../src/components/resume/harbor-model.ts');
const harbor = createHarbor();
harbor.updateTheme?.(args.theme !== 'light');
harbor.group.updateMatrixWorld(true);

const scene = new THREE.Scene();
scene.background = new THREE.Color(args.theme === 'light' ? '#a6b5b2' : '#132c34');
const ambient = new THREE.AmbientLight('#72969c', 0.8);
const key = new THREE.DirectionalLight('#ffe4bb', 1.5);
key.position.set(-10, 22, 13);
scene.add(ambient, key);
const copies = [];
let meshCount = 0, instanceCount = 0, triangles = 0;
const matrix = new THREE.Matrix4();
harbor.group.traverse(object => {
  if (!object.isMesh || !object.visible) return;
  if (!object.matrixWorld.elements.every(Number.isFinite)) throw new Error(`Non-finite transform: ${object.name}`);
  const original = Array.isArray(object.material) ? object.material[0] : object.material;
  // A giant water plane cannot be depth-tested by a painter's-algorithm SVG
  // renderer, so omit it rather than let its triangles hide the waterfront.
  if (original.isShaderMaterial) return;
  const material = original.isShaderMaterial
    ? new THREE.MeshBasicMaterial({ color: args.theme === 'light' ? '#779ea2' : '#193c45', side: THREE.DoubleSide })
    : original.clone();
  // Textures and shader hooks do not run under the CPU renderer.
  material.map = null;
  if (material.emissive) material.emissive.multiplyScalar(original.emissiveIntensity ?? 1);
  copies.push(material);
  meshCount++;
  const count = object.isInstancedMesh ? object.count : 1;
  const geometryTriangles = (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  triangles += geometryTriangles * count;
  instanceCount += count;
  for (let index = 0; index < count; index++) {
    const copy = new THREE.Mesh(object.geometry, material);
    if (object.isInstancedMesh) {
      object.getMatrixAt(index, matrix);
      matrix.premultiply(object.matrixWorld);
    } else matrix.copy(object.matrixWorld);
    if (!matrix.elements.every(Number.isFinite)) throw new Error(`Non-finite instance matrix: ${object.name}/${index}`);
    matrix.decompose(copy.position, copy.quaternion, copy.scale);
    copy.frustumCulled = false;
    copy.renderOrder = object.renderOrder;
    scene.add(copy);
  }
});
const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 500);
camera.position.set(...position);
camera.lookAt(...target);
camera.updateMatrixWorld(true);
const renderer = new SVGRenderer();
renderer.setSize(width, height);
renderer.setPrecision(2);
renderer.render(scene, camera);
const markup = renderer.domElement.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
const background = scene.background.getStyle();
const svg = markup.replace(/(<svg[^>]*>)/, `$1<rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" fill="${background}"/>`);
const directory = resolve('artifacts');
await mkdir(directory, { recursive: true });
const basename = args.name || 'harbor-model-preview';
if (!/^[a-z0-9_-]+$/i.test(basename)) throw new Error('Invalid output basename.');
await writeFile(resolve(directory, `${basename}.svg`), svg);
await sharp(Buffer.from(svg)).png().toFile(resolve(directory, `${basename}.png`));
console.log(JSON.stringify({
  note: 'Offline model geometry preview. No WebGL shadows/textures/water; not a page screenshot or FPS measurement.',
  output: resolve(directory, `${basename}.png`), meshCount, instanceCount, triangles,
  renderedFaces: renderer.info.render.faces, camera: { position, target, fov, width, height },
}, null, 2));
copies.forEach(material => material.dispose());
harbor.dispose?.();
