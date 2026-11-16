import * as THREE from 'three';
import { GLTFLoader, skeletonClone } from '../vendor/GLTFLoader.min.js';
export { skeletonClone } from '../vendor/GLTFLoader.min.js';

const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

export function loadGLTF(url) {
  if (gltfCache.has(url)) {
    return gltfCache.get(url);
  }
  const promise = new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (err) => reject(err)
    );
  });
  gltfCache.set(url, promise);
  return promise;
}

export function makeCharacterInstance(gltf) {
  const group = skeletonClone(gltf.scene);
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m) => m.clone());
      } else {
        child.material = child.material.clone();
      }
    }
  });
  const mixer = new THREE.AnimationMixer(group);
  const actions = new Map();
  if (gltf.animations) {
    for (const clip of gltf.animations) {
      actions.set(clip.name, mixer.clipAction(clip));
    }
  }
  return { group, mixer, actions };
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

export function loadTextureSet(basePath) {
  const mapUrl = basePath + '_diff_1k.jpg';
  const normalUrl = basePath + '_nor_gl_1k.jpg';
  const roughUrl = basePath + '_rough_1k.jpg';

  const loadTex = (url, srgb = false) => {
    if (textureCache.has(url)) return textureCache.get(url);
    const tex = textureLoader.load(
      url,
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
      },
      undefined,
      () => {}
    );
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, tex);
    return tex;
  };

  return {
    map: loadTex(mapUrl, true),
    normalMap: loadTex(normalUrl, false),
    roughnessMap: loadTex(roughUrl, false),
  };
}
