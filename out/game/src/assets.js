import * as THREE from 'three';
import { GLTFLoader, skeletonClone } from '../vendor/GLTFLoader.min.js';

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

const gltfCache = new Map();
const textureCache = new Map();

export async function loadGLTF(url) {
  if (gltfCache.has(url)) return gltfCache.get(url);
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => {
      gltfCache.set(url, gltf);
      resolve(gltf);
    }, undefined, reject);
  });
}

export function makeCharacterInstance(gltf, teamId) {
  const clone = skeletonClone(gltf.scene);
  const mixer = new THREE.AnimationMixer(clone);
  const actions = {};

  if (gltf.animations && gltf.animations.length > 0) {
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip, clone);
      actions[clip.name] = action;
    });
  }

  // Clone materials so we can tint team Ember orange or keep Slate natural
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map(m => {
          const mat = m.clone();
          if (teamId === 0) {
            mat.color.lerp(new THREE.Color(0xf97316), 0.35);
          }
          return mat;
        });
      } else {
        child.material = child.material.clone();
        if (teamId === 0) {
          child.material.color.lerp(new THREE.Color(0xf97316), 0.35);
        }
      }
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return { group: clone, mixer, actions };
}

export function loadTextureSet(basePath) {
  const loadTex = (suffix, srgb = false) => {
    const url = `${basePath}_${suffix}_1k.jpg`;
    if (textureCache.has(url)) return textureCache.get(url);
    const tex = textureLoader.load(url, (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    });
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, tex);
    return tex;
  };

  return {
    map: loadTex('diff', true),
    normalMap: loadTex('nor_gl', false),
    roughnessMap: loadTex('rough', false)
  };
}
