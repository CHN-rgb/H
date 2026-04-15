
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

/* 꽃 상태 */
let bloomValue = 0.5;   // 0 ~ 1
let rotateYValue = 0;   // -55 ~ 55
let tiltXValue = -8;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(currentValue, targetValue, amount) {
    return currentValue * (1 - amount) + targetValue * amount;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

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

    activeFlower.style.transform = `
        rotateX(${tiltXValue}deg)
        rotateY(${rotateYValue}deg)
    `;

    activePetals.forEach((petal, index) => {
        const angle = index * 45;

        /* 0 = 닫힘 / 1 = 핌 */
        const spreadY = 2 + bloomValue * 28;
        const openAngle = 2 + bloomValue * 62;
        const scaleX = 0.62 + bloomValue * 0.48;
        const scaleY = 0.74 + bloomValue * 0.34;

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

/* 셀피 카메라 좌우 보정 */
function toUserHandLabel(mediapipeLabel) {
    if (mediapipeLabel === 'Left') return 'Right';
    if (mediapipeLabel === 'Right') return 'Left';
    return mediapipeLabel;
}

/* 손 펼침 정도: 0 = 오므림, 1 = 펼침 */
function getHandOpenAmount(landmarks) {
    const wrist = landmarks[0];
    const tipIds = [8, 12, 16, 20];
    const baseIds = [5, 9, 13, 17];

    let total = 0;

    for (let i = 0; i < tipIds.length; i++) {
        const tip = landmarks[tipIds[i]];
        const base = landmarks[baseIds[i]];
        total += distance(tip, wrist) - distance(base, wrist);
    }

    /* 엄지는 검지와의 거리로 추가 */
    total += distance(landmarks[4], landmarks[8]) * 0.7;

    return clamp((total - 0.10) / 0.38, 0, 1);
}

/* 오른손: 손바닥이 카메라를 향하는지 */
function isPalmFacingCamera(landmarks) {
    const palmZ =
        (landmarks[0].z + landmarks[5].z + landmarks[9].z + landmarks[13].z + landmarks[17].z) / 5;

    const tipZ =
        (landmarks[8].z + landmarks[12].z + landmarks[16].z + landmarks[20].z) / 4;

    return tipZ < palmZ + 0.03;
}

/* 왼손: 주먹 판정 */
function isFistGesture(landmarks) {
    const openAmount = getHandOpenAmount(landmarks);
    return openAmount < 0.28;
}

/* 왼손 주먹의 x 위치로 3D 회전 */
function getRotateYFromFistX(landmarks) {
    const wrist = landmarks[0];
    return clamp((wrist.x - 0.5) * 110, -55, 55);
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let userRightBloom = null;
    let userLeftRotateY = null;

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

            const rawLabel =
                results.multiHandedness &&
                results.multiHandedness[index] &&
                results.multiHandedness[index].label
                    ? results.multiHandedness[index].label
                    : 'Hand';

            const userLabel = toUserHandLabel(rawLabel);

            const wrist = landmarks[0];
            canvasCtx.font = '12px Arial';
            canvasCtx.fillStyle = '#EDCDD2';
            canvasCtx.fillText(
                userLabel,
                wrist.x * canvasElement.width + 8,
                wrist.y * canvasElement.height - 8
            );

            /* 오른손 = 개화
               손가락 벌어질수록 값 커짐 */
            if (userLabel === 'Right') {
                if (isPalmFacingCamera(landmarks)) {
                    userRightBloom = getHandOpenAmount(landmarks);
                }
            }

            /* 왼손 = 주먹 쥐고 좌우 이동 */
            if (userLabel === 'Left') {
                if (isFistGesture(landmarks)) {
                    userLeftRotateY = getRotateYFromFistX(landmarks);
                }
            }
        });

        if (userRightBloom !== null) {
            bloomValue = lerp(bloomValue, userRightBloom, 0.25);
        }

        if (userLeftRotateY !== null) {
            rotateYValue = lerp(rotateYValue, userLeftRotateY, 0.20);
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
