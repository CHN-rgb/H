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

/* 꽃 상태값 */
let bloomValue = 0.5;   // 0 ~ 1
let rotateValue = 0;    // deg

function updateScreen() {
    screens.forEach((screen, index) => {
        screen.classList.toggle('active', index === current);
    });

    piece.textContent = `PIECE ${current + 1}`;
    flowerName.textContent = names[current];
    updateFlower();
}

function updateFlower() {
    const activeFlower = screens[current].querySelector('.flower-container');
    const activePetals = screens[current].querySelectorAll('.petal');

    /* 왼손 회전 */
    activeFlower.style.transform = `rotate(${rotateValue}deg)`;

    /* 오른손 개화 */
    activePetals.forEach((petal, index) => {
        const angle = index * 45;

        /* bloomValue 0 = 닫힘 / 1 = 핌 */
        const spreadY = 10 + bloomValue * 25;
        const openAngle = 8 + bloomValue * 55;
        const scaleX = 0.72 + bloomValue * 0.38;
        const scaleY = 0.82 + bloomValue * 0.28;

        petal.style.transform = `
            translateX(-50%)
            rotate(${angle}deg)
            translateY(${spreadY}px)
            rotateX(-${openAngle}deg)
            scale(${scaleX}, ${scaleY})
        `;
    });
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
    const isActive = musicToggle.classList.contains('active');

    if (!isActive) {
        musicToggle.classList.add('active');
        try {
            bgm.volume = 0.2;
            await bgm.play();
        } catch (error) {
            console.warn('Audio play failed:', error);
            musicToggle.classList.remove('active');
        }
    } else {
        musicToggle.classList.remove('active');
        bgm.pause();
        bgm.currentTime = 0;
    }
});

updateScreen();

/* -------------------------
   손 인식 + 꽃 연결
------------------------- */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/* 손 펴짐 정도 계산: 값이 클수록 더 핀 손 */
function getHandOpenAmount(landmarks) {
    const wrist = landmarks[0];

    const tipIds = [8, 12, 16, 20];     // 검지, 중지, 약지, 새끼 끝
    const baseIds = [5, 9, 13, 17];     // 각 손가락 시작점

    let total = 0;

    for (let i = 0; i < tipIds.length; i++) {
        const tip = landmarks[tipIds[i]];
        const base = landmarks[baseIds[i]];

        const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const baseDist = Math.hypot(base.x - wrist.x, base.y - wrist.y);

        total += (tipDist - baseDist);
    }

    /* 엄지 반영 */
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    const thumbTipDist = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
    const thumbBaseDist = Math.hypot(thumbBase.x - wrist.x, thumbBase.y - wrist.y);
    total += (thumbTipDist - thumbBaseDist) * 0.8;

    /* 경험적으로 맞춘 범위 */
    return clamp((total - 0.12) / 0.32, 0, 1);
}

/* 왼손 x 위치를 회전값으로 변환 */
function getRotationFromHand(landmarks) {
    const wrist = landmarks[0];
    const x = wrist.x; // 0 ~ 1
    return (x - 0.5) * 180; // -90 ~ 90 정도
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let rightHandBloom = null;
    let leftHandRotate = null;

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

            if (handednessLabel === 'Right') {
                rightHandBloom = getHandOpenAmount(landmarks);
            } else if (handednessLabel === 'Left') {
                leftHandRotate = getRotationFromHand(landmarks);
            }
        });

        if (rightHandBloom !== null) {
            /* 값이 너무 튀지 않게 부드럽게 */
            bloomValue = bloomValue * 0.75 + rightHandBloom * 0.25;
        }

        if (leftHandRotate !== null) {
            rotateValue = rotateValue * 0.8 + leftHandRotate * 0.2;
        }

        updateFlower();
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
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
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
