import fs from 'node:fs';
import path from 'node:path';
import occtimportjs from 'occt-import-js';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

class NodeFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader = NodeFileReader;

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error('Usage: node scripts/convert-step.mjs <source.step> <output.glb>');
}

function meshColor(mesh) {
  if (mesh.name === 'BOARD_OUTLINE') return [0.035, 0.24, 0.12];
  if (!mesh.color) return [0.24, 0.26, 0.27];
  return mesh.color.map((value) => Math.round(value * 31) / 31);
}

function geometryFromOcct(mesh) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
  geometry.setIndex(mesh.index.array);
  geometry.scale(0.001, 0.001, 0.001);
  return geometry;
}

console.log(`Reading ${sourcePath}`);
const occt = await occtimportjs();
const file = fs.readFileSync(sourcePath);
const result = occt.ReadStepFile(file, {
  linearUnit: 'millimeter',
  linearDeflectionType: 'absolute_value',
  linearDeflection: 0.16,
  angularDeflection: 0.3
});

if (!result.success) throw new Error('OpenCascade could not read the STEP file.');

const byColor = new Map();
for (const mesh of result.meshes) {
  const color = meshColor(mesh);
  const key = color.join(':');
  const entry = byColor.get(key) ?? { color, geometries: [] };
  entry.geometries.push(geometryFromOcct(mesh));
  byColor.set(key, entry);
}

const model = new THREE.Group();
model.name = path.basename(sourcePath, path.extname(sourcePath));
let triangleCount = 0;

for (const [index, entry] of [...byColor.values()].entries()) {
  const merged = mergeGeometries(entry.geometries, false);
  if (!merged) throw new Error('Could not merge STEP geometry.');
  triangleCount += merged.index.count / 3;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(...entry.color),
    roughness: 0.48,
    metalness: Math.max(...entry.color) < 0.2 ? 0.18 : 0.08
  });
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = `material_${index}`;
  model.add(mesh);
  entry.geometries.forEach((geometry) => geometry.dispose());
}

const bounds = new THREE.Box3().setFromObject(model);
const size = bounds.getSize(new THREE.Vector3());
const exported = await new GLTFExporter().parseAsync(model, {
  binary: true,
  onlyVisible: true
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Buffer.from(exported));
console.log(JSON.stringify({
  meshes: result.meshes.length,
  materials: byColor.size,
  triangles: triangleCount,
  dimensionsMm: size.toArray().map((value) => Math.round(value * 1000)),
  outputBytes: exported.byteLength
}, null, 2));
