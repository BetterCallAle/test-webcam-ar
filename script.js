import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

const video = document.getElementById('video');

// THREE.js scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = 0;
renderer.domElement.style.left = 0;
renderer.domElement.style.pointerEvents = 'auto';
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 1);
scene.add(light);

// Load 3D model
let occhiali = null;
const loader = new GLTFLoader();
loader.load('./occhiali.glb', (gltf) => {
  occhiali = gltf.scene;
  occhiali.rotation.set(0, Math.PI / 3, 0);
  occhiali.scale.set(0.85, 0.85, 0.85);
  scene.add(occhiali);
});
camera.position.z = 1;

// FaceMesh setup
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Drag & manual adjustments
let manualOffset = { x: 0, y: 0, z: 0 };
let isDragging = false;
let lastMouse = { x: 0, y: 0 };
let manualZRotation = 0;
let manualYRotation = 0;
let manualScale = 0.85;

// Sliders & buttons
const scaleSlider = document.getElementById('scaleSlider');
scaleSlider.addEventListener('input', () => {
  manualScale = parseFloat(scaleSlider.value);
  if (occhiali) occhiali.scale.set(manualScale, manualScale, manualScale);
});

const rotationSlider = document.getElementById('rotationSlider');
rotationSlider.addEventListener('input', () => {
  manualZRotation = parseFloat(rotationSlider.value);
});

const rotationYSlider = document.getElementById('rotationYSlider');
rotationYSlider.addEventListener('input', () => {
  manualYRotation = parseFloat(rotationYSlider.value);
});

document.getElementById('resetBtn').addEventListener('click', () => {
  manualOffset = { x: 0, y: 0, z: 0 };
  manualZRotation = 0;
  manualYRotation = 0;
  rotationSlider.value = 0;
  rotationYSlider.value = 0;
});

const screenshotBtn = document.getElementById('screenshotBtn');
screenshotBtn.addEventListener('click', () => {
    const videoCanvas = document.createElement('canvas');
    const ctx = videoCanvas.getContext('2d');

    videoCanvas.width = renderer.domElement.width;
    videoCanvas.height = renderer.domElement.height;

    // Disegna il video
    ctx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);

    // Disegna sopra il canvas 3D con gli occhiali
    ctx.drawImage(renderer.domElement, 0, 0);

    // Salva immagine
    const dataURL = videoCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'screenshot_occhiali3D.png';
    a.click();
});


function startDrag(x, y) {
  isDragging = true;
  lastMouse = { x, y };
}

function dragMove(x, y) {
  if (!isDragging) return;
  const dx = (x - lastMouse.x) / window.innerWidth;
  const dy = (y - lastMouse.y) / window.innerHeight;
  manualOffset.x += dx;
  manualOffset.y -= dy;
  lastMouse = { x, y };
}

function endDrag() {
  isDragging = false;
}

renderer.domElement.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
renderer.domElement.addEventListener('mousemove', (e) => dragMove(e.clientX, e.clientY));
renderer.domElement.addEventListener('mouseup', endDrag);
renderer.domElement.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  startDrag(t.clientX, t.clientY);
});
renderer.domElement.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  dragMove(t.clientX, t.clientY);
});
renderer.domElement.addEventListener('touchend', endDrag);

faceMesh.onResults(results => {
  if (!occhiali || !results.multiFaceLandmarks) return;

  const landmarks = results.multiFaceLandmarks[0];
  if (!landmarks || landmarks.length < 455) return;  // Assicuriamoci che landmarks sia definito e abbia abbastanza punti

  const nose = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  const leftEye = landmarks[159];
  const rightEye = landmarks[386];

  const dx = rightEar.x - leftEar.x;
  const dy = rightEye.y - leftEye.y;

  occhiali.position.set(
    nose.x - 0.5 + manualOffset.x,
    -nose.y + 0.5 + manualOffset.y,
    -0.5 + manualOffset.z
  );

  occhiali.rotation.y = -dx * 5 + manualYRotation;
  occhiali.rotation.z = -dy * 2.5 + manualZRotation;
  occhiali.scale.set(manualScale, manualScale, manualScale);
});

// Start camera and render loop
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' }
  });
  video.srcObject = stream;
  video.onloadedmetadata = () => {
    video.play();
    animate();
  };
}

async function animate() {
  await faceMesh.send({ image: video });
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

setupCamera();
