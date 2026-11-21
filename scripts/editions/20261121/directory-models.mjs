import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
// Research thumbnails use the same district models and project records as the map.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
if (!process.argv[2])
  throw new Error('Supply the working directory for the rendered thumbnails.');
const workDir = path.resolve(process.argv[2]),
  publicDir = path.join(repo, 'public'),
  ppmDirectory = path.join(workDir, 'ppm');
fs.mkdirSync(ppmDirectory, { recursive: true });
register(pathToFileURL(path.join(repo, 'scripts/recovery-three-loader.mjs')));
const THREE = await import(
  pathToFileURL(path.join(publicDir, 'vendor/three.module.js'))
);
const { GLTFLoader } = await import(
  pathToFileURL(path.join(publicDir, 'vendor/addons/loaders/GLTFLoader.js'))
);
const { MeshoptDecoder } = await import(
  pathToFileURL(path.join(publicDir, 'vendor/meshopt_decoder.mjs'))
);
const loadJSON = (name) =>
  JSON.parse(fs.readFileSync(path.join(publicDir, 'data', name + '.json')));
const catalogue = loadJSON('building-catalogue').entries,
  projects = new Map(loadJSON('projects').map((p) => [p.id, p])),
  districts = loadJSON('districts'),
  refine = loadJSON('refinement-models').assets;
const { resolveModelLifecycle, displayStatusForLifecycle, statusColours } =
  await import(
    pathToFileURL(path.join(publicDir, 'model-status-materials.js'))
  );
const { existingEnvelopeColour } = await import(
  pathToFileURL(path.join(publicDir, 'existing-materials.js'))
);
const overrides = loadJSON('overrides'),
  pictures = loadJSON('directory-pictures').entries;
const reviews = new Map(loadJSON('project-lifecycle-20261121').projects.map(row => [row.id, row]));
const neutralModels = JSON.parse(fs.readFileSync(new URL('./plan-massing-materials.json', import.meta.url), 'utf8')).neutralModels;
const schematicLifecycle = new WeakMap();
const completedBodyRGB = new WeakMap();
const requestedIDs = new Set(
  pictures.filter((row) => row.kind !== 'study').map((row) => row.id)
);
const remaining = catalogue.filter((entry) => requestedIDs.has(entry.id));
const sourceHashes = {},
  municipalMeshes = new Map(),
  municipalFiles = new Map();
async function load(file) {
  const data = fs.readFileSync(path.join(publicDir, file));
  sourceHashes[file] = createHash('sha256').update(data).digest('hex');
  const raw = data[0] === 31 ? gunzipSync(data) : data;
  const scene = (
    await new GLTFLoader()
      .register(() => ({
        name: 'GeometryOnly',
        loadTexture: () => Promise.resolve(null)
      }))
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(
        raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
        ''
      )
  ).scene;
  scene.updateMatrixWorld(true);
  const out = [];
  scene.traverse((o) => {
    if (o.isMesh) out.push(o);
  });
  return out;
}
const wanted = new Set(
  remaining.flatMap((e) => projects.get(e.projectId)?.retainedMeshIds ?? [])
);
for (const d of [
  ...districts.filter((d) => d.id !== 'citywide'),
  districts[0]
]) {
  const file = 'models/' + d.file;
  if (!fs.existsSync(path.join(publicDir, file))) continue;
  const meshes = await load(file);
  for (const m of meshes) {
    const id = m.userData.id || m.geometry.userData.id || m.name;
    if (wanted.has(id) && !municipalMeshes.has(id)) {
      municipalMeshes.set(id, m);
      municipalFiles.set(id, file);
    }
  }
}
const imageWidth = 900,
  imageHeight = 600;
function picture(bg) {
  const color = Buffer.alloc(imageWidth * imageHeight * 3),
    depth = new Float32Array(imageWidth * imageHeight);
  depth.fill(-Infinity);
  for (let i = 0; i < color.length; i += 3) {
    color[i] = bg[0];
    color[i + 1] = bg[1];
    color[i + 2] = bg[2];
  }
  function triangle(a, b, c, cl) {
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
      x1 = Math.min(imageWidth - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
      y1 = Math.min(imageHeight - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    if (x0 > x1 || y0 > y1) return;
    const ax = b[0] - a[0],
      ay = b[1] - a[1],
      bx = c[0] - a[0],
      by = c[1] - a[1],
      det = ax * by - ay * bx;
    if (Math.abs(det) < 0.001) return;
    const ux = by / det,
      uy = -bx / det,
      vx = -ay / det,
      vy = ax / det,
      da = b[2] - a[2],
      db = c[2] - a[2];
    for (let y = y0; y <= y1; y++) {
      let u = (x0 + 0.5 - a[0]) * ux + (y + 0.5 - a[1]) * uy,
        v = (x0 + 0.5 - a[0]) * vx + (y + 0.5 - a[1]) * vy;
      for (let x = x0; x <= x1; x++, u += ux, v += vx) {
        if (u < 0 || v < 0 || u + v > 1) continue;
        let p = y * imageWidth + x,
          z = a[2] + u * da + v * db;
        if (z <= depth[p]) continue;
        depth[p] = z;
        p *= 3;
        color[p] = cl[0];
        color[p + 1] = cl[1];
        color[p + 2] = cl[2];
      }
    }
  }
  return {
    triangle,
    save: (id) =>
      fs.writeFileSync(
        path.join(ppmDirectory, id + '.ppm'),
        Buffer.concat([
          Buffer.from('P6\n' + imageWidth + ' ' + imageHeight + '\n255\n'),
          color
        ])
      )
  };
}
function vertices(m) {
  const pos = m.geometry.attributes.position,
    w = m.matrixWorld.elements,
    vertexColours = m.geometry.attributes.color;
  const positions = new Float64Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i),
      k = i * 3;
    positions[k] = w[0] * x + w[4] * y + w[8] * z + w[12];
    positions[k + 1] = w[1] * x + w[5] * y + w[9] * z + w[13];
    positions[k + 2] = w[2] * x + w[6] * y + w[10] * z + w[14];
  }
  return { positions, indices: m.geometry.index?.array, vertexColours };
}
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
const eye = norm([0.76, 0.6, 1]),
  right = norm([eye[2], 0, -eye[0]]),
  up = [
    eye[1] * right[2],
    eye[2] * right[0] - eye[0] * right[2],
    -eye[1] * right[0]
  ];
const dot = (v, x, y, z) => v[0] * x + v[1] * y + v[2] * z;
function render3D(id, meshes, useStatusColour, project) {
  const parts = [],
    projectPoint = (x, y, z) => [
      dot(right, x, y, z),
      -dot(up, x, y, z),
      dot(eye, x, y, z)
    ];
  let left = Infinity,
    top = Infinity,
    end = -Infinity,
    bottom = -Infinity;
  for (const m of meshes) {
    let { positions, indices, vertexColours } = vertices(m);
    const a = [];
    for (let k = 0; k < positions.length; k += 3) {
      const v = projectPoint(positions[k], positions[k + 1], positions[k + 2]);
      left = Math.min(left, v[0]);
      end = Math.max(end, v[0]);
      top = Math.min(top, v[1]);
      bottom = Math.max(bottom, v[1]);
      a.push(v);
    }
    parts.push({ positions, indices, vertexColours, a, m });
  }
  if (!(end > left && bottom > top)) return false;
  const scale = Math.min(
      (imageWidth * 0.76) / (end - left),
      (imageHeight * 0.78) / (bottom - top)
    ),
    xOffset = (imageWidth - (end - left) * scale) / 2 - left * scale,
    yOffset = (imageHeight - (bottom - top) * scale) / 2 - top * scale;
  const pic = picture([241, 240, 237]);
  let faces = 0;
  for (const part of parts) {
    const { positions, indices, vertexColours, a, m } = part;
    const meshId = m.userData.id || m.geometry.userData.id || m.name;
    const lifecycle = resolveModelLifecycle(
      m.userData,
      overrides[meshId],
      { ...project, lifecycle: schematicLifecycle.get(m) || reviews.get(project.id)?.lifecycle || project.lifecycle }
    );
    const colour = statusColours[displayStatusForLifecycle(lifecycle)];
    const statusRGB = [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255];
    const bodyRGB = completedBodyRGB.get(m);
    const useAuthoredFinish = !bodyRGB && !useStatusColour && !schematicLifecycle.has(m);
    for (const p of a) {
      p[0] = p[0] * scale + xOffset;
      p[1] = p[1] * scale + yOffset;
    }
    for (let i = 0, nn = indices?.length ?? a.length; i < nn; i += 3) {
      const i0 = indices ? indices[i] : i,
        i1 = indices ? indices[i + 1] : i + 1,
        i2 = indices ? indices[i + 2] : i + 2;
      const k = i0 * 3,
        k1 = i1 * 3,
        k2 = i2 * 3,
        dx = positions[k1] - positions[k],
        dy = positions[k1 + 1] - positions[k + 1],
        dz = positions[k1 + 2] - positions[k + 2],
        ex = positions[k2] - positions[k],
        ey = positions[k2 + 1] - positions[k + 1],
        ez = positions[k2 + 2] - positions[k + 2];
      let nx = dy * ez - dz * ey,
        ny = dz * ex - dx * ez,
        nz = dx * ey - dy * ex,
        l = Math.hypot(nx, ny, nz);
      if (l < 1e-10) continue;
      if (nx * eye[0] + ny * eye[1] + nz * eye[2] < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const light =
        0.63 + 0.34 * Math.max(0, (-0.5 * nx + 0.83 * ny + 0.24 * nz) / l);
      let col = bodyRGB || statusRGB;
      if (useAuthoredFinish) {
        const mat = m.material?.color;
        let c = vertexColours
          ? [
              vertexColours.getX(i0),
              vertexColours.getY(i0),
              vertexColours.getZ(i0)
            ]
          : mat
            ? [mat.r, mat.g, mat.b]
            : [0.5, 0.55, 0.55];
        c = c.map((v, i) => {
          const srgb =
            v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
          return 50 + Math.max(0, Math.min(1, srgb)) * 167;
        });
        col = c;
      }
      pic.triangle(
        a[i0],
        a[i1],
        a[i2],
        col.map((v) => Math.round(v * light))
      );
      faces++;
    }
  }
  pic.save(id);
  return faces;
}
const out = [],
  locationOnly = [];
for (const entry of remaining) {
  const p = projects.get(entry.projectId);
  let meshes = [],
    sourcesUsed = [],
    kind;
  let modelAssets = refine.filter(
    (a) =>
      a.projectId === p.id &&
      a.url &&
      (a.modes || ['future']).includes('future')
  );
  if (p.id === 'exchange-district') {
    const phaseModel = loadJSON('tower-stage-calibration').exchange;
    const file = phaseModel.publicFile;
    meshes = await load(file);
    if (sourceHashes[file] !== phaseModel.publicSHA256)
      throw new Error('Exchange phase model has changed.');
    sourcesUsed.push({
      file,
      sha256: sourceHashes[file],
      asset: 'exchange-district-phases'
    });
    kind = 'project-model';
    modelAssets = [];
  }
  if (modelAssets.length) {
    for (const a of modelAssets) {
      const f = a.url;
      if (!fs.existsSync(path.join(publicDir, f))) continue;
      const m = await load(f);
      const completedBodies = [];
      for (const part of m) {
        const colour = existingEnvelopeColour({
          name: part.name,
          userData: {
            ...part.userData, assetId: a.id, projectId: p.id, sourceAssetSHA256: sourceHashes[f],
            lifecycle: a.lifecycle || reviews.get(p.id)?.lifecycle,
            nativeTexture: Boolean(part.material?.map) || part.userData.nativeTexture
          }
        });
        if (colour) {
          completedBodyRGB.set(part, colour.slice(1).match(/../g).map(channel => parseInt(channel, 16)));
          completedBodies.push(part.name);
        }
      }
      const pin = neutralModels[a.id];
      if (pin && pin.project === p.id && !a.preserveMaterials && pin.matchedPartCount === m.length) {
        if (pin.sha256 !== sourceHashes[f]) throw new Error('Planning model has changed: ' + a.id);
        for (const part of m) schematicLifecycle.set(part, a.lifecycle || reviews.get(p.id)?.lifecycle);
      }
      meshes.push(...m);
      sourcesUsed.push({
        file: f,
        sha256: sourceHashes[f],
        asset: a.id || a.assetId,
        ...(completedBodies.length ? { completedBodies } : {}),
        ...(m.length && schematicLifecycle.has(m[0]) ? { lifecycleFinish: schematicLifecycle.get(m[0]) } : {})
      });
    }
    kind = 'project-model';
  }
  if (!meshes.length) {
    for (const id of p.retainedMeshIds || []) {
      if (municipalMeshes.has(id)) {
        meshes.push(municipalMeshes.get(id));
        const f = municipalFiles.get(id);
        sourcesUsed.push({ file: f, sha256: sourceHashes[f], mesh: id });
      }
    }
    kind = 'city-massing';
  }
  if (!meshes.length) {
    locationOnly.push(entry);
    continue;
  }
  const faces = render3D(entry.id, meshes, kind === 'city-massing', p);
  if (!faces) {
    locationOnly.push(entry);
    continue;
  }
  out.push({ id: entry.id, kind, source: sourcesUsed, faces });
}
console.log(
  'individual geometry',
  out.length,
  'locator or neighbourhood',
  locationOnly.length
);
const mapMeshes = [];
const files = loadJSON('context-assets').citywide;
for (const f of files) {
  // Only planimetric land/water/road layers go on the locator.
  const head = fs.readFileSync(path.join(publicDir, f));
  const js = JSON.parse(head.subarray(20, 20 + head.readUInt32LE(12)));
  if (
    !js.nodes.some((n) =>
      /^(RoadPaved|WoodedArea|Park|River|Waterbody|LakeOntario|Shoreline)/i.test(
        n.name || ''
      )
    )
  )
    continue;
  const mm = await load(f);
  for (const m of mm) {
    const n = m.name || '';
    let style = /RoadPaved/.test(n)
      ? [2, [182, 189, 189]]
      : /(Shoreline|LakeOntario|Waterbody|^River(?!Crossing))/.test(n)
        ? [1, [160, 196, 206]]
        : /(WoodedArea|Park)/.test(n)
          ? [0, [202, 215, 193]]
          : null;
    if (!style) continue;
    const { positions, indices } = vertices(m),
      box = new THREE.Box3().setFromObject(m);
    mapMeshes.push({ file: f, positions, indices, style, box });
  }
}
for (const entry of locationOnly) {
  const p = projects.get(entry.projectId);
  if (!Array.isArray(p.position)) {
    out.push({ id: entry.id, kind: 'neighbourhood', area: p.district });
    continue;
  }
  const [cx, , cz] = p.position,
    pic = picture([239, 239, 231]),
    z = 0.8,
    halfX = imageWidth / (2 * z),
    halfZ = imageHeight / (2 * z);
  let faces = 0;
  const source = new Set();
  for (const block of mapMeshes) {
    const { positions, indices, style, box } = block;
    if (
      box.max.x < cx - halfX ||
      box.min.x > cx + halfX ||
      box.max.z < cz - halfZ ||
      box.min.z > cz + halfZ
    )
      continue;
    const c = (k) => [
      (positions[k] - cx) * z + imageWidth / 2,
      (positions[k + 2] - cz) * z + imageHeight / 2,
      style[0]
    ];
    for (
      let i = 0, num = indices?.length ?? positions.length / 3;
      i < num;
      i += 3
    ) {
      const a = (indices ? indices[i] : i) * 3,
        b = (indices ? indices[i + 1] : i + 1) * 3,
        d = (indices ? indices[i + 2] : i + 2) * 3;
      if (
        Math.min(positions[a], positions[b], positions[d]) > cx + halfX ||
        Math.max(positions[a], positions[b], positions[d]) < cx - halfX ||
        Math.min(positions[a + 2], positions[b + 2], positions[d + 2]) >
          cz + halfZ ||
        Math.max(positions[a + 2], positions[b + 2], positions[d + 2]) <
          cz - halfZ
      )
        continue;
      pic.triangle(c(a), c(b), c(d), style[1]);
      source.add(block.file);
      faces++;
    }
  }
  if (!faces) {
    out.push({
      id: entry.id,
      kind: 'neighbourhood',
      area: p.district || entry.areaId
    });
    continue;
  }
  pic.save(entry.id);
  out.push({
    id: entry.id,
    kind: 'site-location',
    fileSources: [...source].map((f) => ({ file: f, sha256: sourceHashes[f] })),
    position: p.position,
    faces
  });
}
fs.writeFileSync(
  path.join(workDir, 'geometry-pictures.json'),
  JSON.stringify(out, null, 2)
);
console.log(
  Object.groupBy
    ? Object.fromEntries(
        Object.entries(Object.groupBy(out, (r) => r.kind)).map(([k, v]) => [
          k,
          v.length
        ])
      )
    : out.length
);
