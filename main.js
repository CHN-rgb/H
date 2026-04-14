const screens = document.querySelectorAll('.screen');
const piece = document.getElementById('piece');
const flowerName = document.getElementById('flowerName');
const leftArrow = document.getElementById('leftArrow');
const rightArrow = document.getElementById('rightArrow');
const musicToggle = document.getElementById('musicToggle');
const bgm = document.getElementById('bgm');

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('outputCanvas');
const cameraStatus = document.getElementById('cameraStatus');
const canvasCtx = canvasElement.getContext('2d');

const names = [
    "Maʻo hau hele (Hibiscus brackenridgei)",
    "Kokiʻo keʻokeʻo (Hibiscus arnottianus)",
    "Kokiʻo keʻokeʻo (Hibiscus waimeae)",
    "Clay's hibiscus",
    "Kokiʻo ʻula (Hibiscus kokio)"
];

let current = 0;

function updateScreen() {
    screens.forEach((screen, index) => {
        screen.classList.toggle('active', index === current);
    });
    piece.textContent = `PIECE ${current + 1}`;
    flowerName.textContent = names[current];
}

leftArrow.addEventListener('click', () => {
    current = (current + 4) % 5;
    updateScreen();
});

rightArrow.addEventListener('click', () => {
    current = (current + 1) % 5;
    updateScreen();
});

musicToggle.addEventListener('click', async () => {
    musicToggle.classList.toggle('active');

    if (musicToggle.classList.contains('active')) {
        try {
            bgm.volume = 0.3;
            await bgm.play();
        } catch (error) {
            console.warn('Audio play failed:', error);
        }
    } else {
        bgm.pause();
    }
});

updateScreen();

/* -------------------------
   손 인식 1단계
------------------------- */

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: '#EDCDD2',
                lineWidth: 2
            });

            drawLandmarks(canvasCtx, landmarks, {
                color: '#EDCDD2',
                lineWidth: 1,
                radius: 3
            });

            const handednessLabel =
                results.multiHandedness &&
                results.multiHandedness[index] &&
                results.multiHandedness[index].label
                    ? results.multiHandedness[index].label
                    : 'Hand';

            const wrist = landmarks[0];
            canvasCtx.font = '12px Arial';
            canvasCtx.fillStyle = '#EDCDD2';
            canvasCtx.fillText(
                handednessLabel,
                wrist.x * canvasElement.width + 8,
                wrist.y * canvasElement.height - 8
            );
        });

        cameraStatus.textContent = `hands detected: ${results.multiHandLandmarks.length}`;
    } else {
        cameraStatus.textContent = 'show your hand to camera';
    }

    canvasCtx.restore();
}

async function startHandTracking() {
    if (!window.Hands || !window.Camera) {
        cameraStatus.textContent = 'mediapipe load failed';
        return;
    }

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    try {
        cameraStatus.textContent = 'requesting camera...';
        await camera.start();

        canvasElement.width = 640;
        canvasElement.height = 480;
        cameraStatus.textContent = 'hand tracking ready';
    } catch (error) {
        console.error(error);
        cameraStatus.textContent = 'camera permission denied';
    }
}

startHandTracking();