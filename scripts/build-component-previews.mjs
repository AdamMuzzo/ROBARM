import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { draco, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstreamRoot = process.argv[2] ?? path.join(process.env.TEMP ?? '', 'PAROL6-Desktop-robot-arm');
const sourceRoot = path.join(upstreamRoot, 'STL');
const outputRoot = path.join(projectRoot, 'public', 'models', 'parol6', 'components');
const loader = new STLLoader();
const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule() });

async function listStls(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listStls(absolute));
    else if (/\.stl$/i.test(entry.name)) files.push(absolute);
  }
  return files;
}

function createDocument(name, positions, normals, indices) {
  const document = new Document();
  const buffer = document.createBuffer();
  const material = document.createMaterial('PETG preview').setBaseColorFactor([0.84, 0.87, 0.88, 1]).setRoughnessFactor(0.72);
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setAttribute('NORMAL', document.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
    .setIndices(document.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
    .setMaterial(material);
  const mesh = document.createMesh(name).addPrimitive(primitive);
  document.createScene('Scene').addChild(document.createNode(name).setMesh(mesh));
  return document;
}

await MeshoptSimplifier.ready;
const files = await listStls(sourceRoot);
let sourceBytes = 0;
let outputBytes = 0;

for (const sourceFile of files) {
  const relative = path.relative(sourceRoot, sourceFile);
  const outputFile = path.join(outputRoot, relative.replace(/\.stl$/i, '.glb'));
  const data = await fs.readFile(sourceFile);
  sourceBytes += data.byteLength;

  let geometry = loader.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  geometry.deleteAttribute('normal');
  geometry = mergeVertices(geometry, 1e-4);
  geometry.computeVertexNormals();

  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  if (!index) throw new Error(`Unable to index ${relative}`);

  const document = createDocument(
    path.basename(relative, path.extname(relative)),
    new Float32Array(position.array),
    new Float32Array(normal.array),
    position.count > 65_535 ? new Uint32Array(index.array) : new Uint16Array(index.array)
  );
  const ratio = Math.min(1, Math.max(0.2, 150_000 / position.count));
  if (ratio < 0.98) {
    await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.00045 }));
  }
  await document.transform(prune(), draco({ method: 'edgebreaker', encodeSpeed: 4, decodeSpeed: 6 }));
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await io.write(outputFile, document);
  const stat = await fs.stat(outputFile);
  outputBytes += stat.size;
  process.stdout.write(`${relative} -> ${(stat.size / 1024).toFixed(0)} KiB\n`);
}

process.stdout.write(`Converted ${files.length} STLs: ${(sourceBytes / 1048576).toFixed(1)} MiB -> ${(outputBytes / 1048576).toFixed(1)} MiB\n`);
