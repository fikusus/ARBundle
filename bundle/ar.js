// ar.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from './ar-button';

function initializeAR(buttonContainerId, videoUrl, scale = 1.0) {
  let videoParent, videoMesh, shadowMesh, reticle, hitTestSource = null;
  let videoStarted = false;


  const buttonContainer = document.getElementById(buttonContainerId);
  if (!buttonContainer) {
    console.error(`Container with id '${buttonContainerId}' not found.`);
    return;
  }

  // Set up the scene, camera, and renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    70, 
    window.innerWidth / window.innerHeight, 
    0.01, 
    20
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = false;

  // Create the AR button
  const arButton = ARButton.createButton(renderer, { 
    requiredFeatures: ['hit-test']
  });
  arButton.classList.add('ar-button');
  buttonContainer.appendChild(arButton);

  // Set up the video element
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = false; 

  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.NearestFilter;
  videoTexture.magFilter = THREE.NearestFilter;
  videoTexture.format = THREE.RGBAFormat; 

  const videoMaterial = new THREE.MeshBasicMaterial({ 
    map: videoTexture, 
    transparent: true, 
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  // Create the video mesh
  const geometry = new THREE.PlaneGeometry(0.6, 0.5); 
  videoMesh = new THREE.Mesh(geometry, videoMaterial);
  videoMesh.visible = false; 
  videoMesh.renderOrder = 2;

  // Create the shadow mesh
  const shadowGeometry = new THREE.CircleGeometry(0.8, 64);
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      color: { value: new THREE.Color(0x000000) },
      opacity: { value: 0.5 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float dist = length(vUv - 0.5);
        float alpha = 1.0 - smoothstep(0.01, 0.4, dist);
        gl_FragColor = vec4(color, alpha * opacity);
      }
    `
  });

  shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.02;
  shadowMesh.visible = false;
  shadowMesh.renderOrder = 1;

  // Create a parent object and add meshes
  videoParent = new THREE.Object3D();
  videoParent.add(videoMesh);
  videoParent.add(shadowMesh);
  scene.add(videoParent);

  // Load the reticle model
  const loader = new GLTFLoader();
  loader.load('media/gltf/reticle/reticle.gltf', (gltf) => {
    reticle = gltf.scene;
    reticle.visible = false;
    scene.add(reticle);
  });

  // Variables for interaction
  const reusableViewMatrix = new THREE.Matrix4();
  const reusableVector = new THREE.Vector3();
  const reusableDirection = new THREE.Vector3();

  const maxRotationX = Math.PI / 12;
  const minRotationX = 0;
  const minDistance = 0.5;
  const maxDistance = 5;

  // Function to reset the scene
  function resetScene() {
    videoMesh.visible = false;
    shadowMesh.visible = false;
    video.pause();
    video.currentTime = 0;

    videoMesh.position.set(0, 0, 0);
    videoParent.rotation.set(0, 0, 0);
    videoMesh.rotation.set(0, 0, 0);
    videoMesh.scale.set(1, 1, 1);

    videoStarted = false;
    if (reticle) reticle.visible = false;
  }

  // Animation loop
  function animate() {
    renderer.setAnimationLoop(render);
  }

  // Render function
  function render(timestamp, frame) {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();

      if (!videoStarted) {
        const session = renderer.xr.getSession();

        if (hitTestSource === null) {
          session.requestReferenceSpace('viewer').then((viewerSpace) => {
            session.requestHitTestSource({ space: viewerSpace }).then((source) => {
              hitTestSource = source;
            });
          });
        }

        if (hitTestSource && reticle) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);

          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const hitPose = hit.getPose(referenceSpace);

            reticle.visible = true;
            reticle.position.set(
              hitPose.transform.position.x, 
              hitPose.transform.position.y, 
              hitPose.transform.position.z
            );
          } else {
            reticle.visible = false;
          }
        }
      } else {
        const viewerPose = frame.getViewerPose(referenceSpace);
        if (viewerPose) {
          const view = viewerPose.views[0];
          reusableViewMatrix.fromArray(view.transform.matrix);

          reusableVector.setFromMatrixPosition(reusableViewMatrix);

          reusableDirection.subVectors(reusableVector, videoParent.position);
          reusableDirection.y = 0; 
          reusableDirection.normalize();

          const angleY = Math.atan2(reusableDirection.x, reusableDirection.z);

          videoParent.rotation.y = angleY;

          const distance = reusableVector.distanceTo(videoParent.position);

          const clampedDistance = THREE.MathUtils.clamp(distance, minDistance, maxDistance);
          const normalizedDistance = (maxDistance - clampedDistance) / (maxDistance - minDistance);

          let angleX = normalizedDistance * maxRotationX;

          angleX = THREE.MathUtils.clamp(angleX, minRotationX, maxRotationX);

          videoMesh.rotation.x = -angleX;
        }
      }
    }

    renderer.render(scene, camera);
  }

  // Handle selection
  function onSelect() {
    if (!videoStarted && reticle && reticle.visible) {
      video.play();
      videoParent.position.set(
        reticle.position.x, 
        reticle.position.y, 
        reticle.position.z
      );
      videoMesh.scale.set(scale, scale, scale);
      videoMesh.visible = true;
      shadowMesh.visible = true;
      videoStarted = true;
      if (hitTestSource) {
        hitTestSource.cancel(); 
        hitTestSource = null;
      }
      reticle.visible = false; 
    }
  }

  // Adjust video mesh based on video metadata
  video.addEventListener('loadedmetadata', () => {
    const aspectRatio = video.videoWidth / video.videoHeight;
    videoMesh.geometry.dispose(); 
    const newHeight = 1 / aspectRatio;
    const newWidth = 1;
    const newGeometry = new THREE.PlaneGeometry(newWidth, newHeight);
    newGeometry.translate(0, newHeight / 2, 0);
    videoMesh.geometry = newGeometry; 
  });

  // Event listeners for session
  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    session.addEventListener('select', onSelect);
    session.addEventListener('end', resetScene); 
  });

  renderer.xr.addEventListener('sessionend', () => {
    resetScene();
  });

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Start the animation loop
  animate();
}

export { initializeAR };
