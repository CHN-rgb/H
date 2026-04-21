const petals = document.querySelectorAll('.petal');
const flowerName = document.getElementById('flowerName');
const piece = document.getElementById('piece');

let bloomValue = 0.5;
let rotateYValue = 0;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function updateFlower() {

    const flower = document.querySelector('.flower-container');

    flower.style.transform = `
        translate(-50%, -50%)
        rotateX(-8deg)
        rotateY(${rotateYValue}deg)
    `;

    petals.forEach((petal, i) => {
        const angle = i * 45;

        const spread = 2 + bloomValue * 28;
        const open = 2 + bloomValue * 60;

        petal.style.transform = `
            translateX(-50%)
            rotate(${angle}deg)
            translateY(${spread}px)
            rotateX(-${open}deg)
        `;
    });
}

/* -------------------------
   손 인식
------------------------- */

function getOpenAmount(landmarks) {
    const wrist = landmarks[0];
    const tipIds = [8, 12, 16, 20];
    const baseIds = [5, 9, 13, 17];

    let total = 0;

    for (let i = 0; i < tipIds.length; i++) {
        const tip = landmarks[tipIds[i]];
        const base = landmarks[baseIds[i]];
        total += Math.hypot(tip.x - wrist.x, tip.y - wrist.y)
              - Math.hypot(base.x - wrist.x, base.y - wrist.y);
    }

    total += Math.hypot(
        landmarks[4].x - landmarks[8].x,
        landmarks[4].y - landmarks[8].y
    ) * 0.7;

    return clamp((total - 0.1) / 0.38, 0, 1);
}

function onResults(results) {

    if (!results.multiHandLandmarks) return;

    results.multiHandLandmarks.forEach((landmarks, i) => {

        const label = results.multiHandedness[i].label;

        if (label === 'Right') {
            bloomValue = getOpenAmount(landmarks);
        }

        if (label === 'Left') {
            rotateYValue = (landmarks[0].x - 0.5) * 110;
        }
    });

    updateFlower();
}

const hands = new Hands({
    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
});

hands.setOptions({
    maxNumHands: 2
});

hands.onResults(onResults);

const video = document.createElement('video');

const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 640,
    height: 480
});

camera.start();
