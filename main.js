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

    /* 왼손 회전 */
    activeFlower.style.transform = `rotate(${rotateValue}deg)`;

    /* 오른손 개화 */
    activePetals.forEach((petal, index) => {
        const angle = index * 45;

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

/* 셀피 카메라 기준 좌우가 사용자 체감과 반대로 잡힐 수 있어서 보정 */
function toUserHandLabel(mediapipeLabel) {
    if (mediapipeLabel === 'Left') return 'Right';
    if (mediapipeLabel === 'Right') return 'Left';
    return mediapipeLabel;
}

/* 오른손 개화용: 손이 얼마나 펴졌는지 계산 */
function getHandOpenAmount(landmarks) {
    const wrist = landmarks[0];

    const tipIds = [8, 12, 16, 20];
    const baseIds = [5, 9, 13, 17];

    let total = 0;

    for (let i = 0; i < tipIds.length; i++) {
        const tip = landmarks[tipIds[i]];
        const base = landmarks[baseIds[i]];

        const tipDist = distance(tip, wrist);
        const baseDist = distance(base, wrist);

        total += (tipDist - baseDist);
    }

    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    const thumbTipDist = distance(thumbTip, wrist);
    const thumbBaseDist = distance(thumbBase, wrist);
    total += (thumbTipDist - thumbBaseDist) * 0.8;

    return clamp((total - 0.12) / 0.32, 0, 1);
}

/* 오른손 조건: 손바닥이 카메라를 향하고 있는지 대략 판정 */
function isPalmFacingCamera(landmarks) {
    const palmZ =
        (landmarks[0].z + landmarks[5].z + landmarks[9].z + landmarks[13].z + landmarks[17].z) / 5;

    const fingerTipZ =
        (landmarks[8].z + landmarks[12].z + landmarks[16].z + landmarks[20].z) / 4;

    /* 손가락 끝이 손바닥보다 카메라에 가깝거나 비슷하면 손바닥이 전면일 가능성이 높음 */
    return fingerTipZ < palmZ + 0.02;
}

/* 왼손 조건: 구슬 집듯이 오므린 손 모양인지 판정 */
function isPinchBallGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const thumbIndex = distance(thumbTip, indexTip);
    const thumbMiddle = distance(thumbTip, middleTip);

    const openAmount = getHandOpenAmount(landmarks);

    /* 엄지-검지가 가깝고, 전체적으로 손이 너무 활짝 펴져 있지 않으면 집는 손 모양으로 판단 */
    const gatheredFingers =
        thumbIndex < 0.10 &&
        thumbMiddle < 0.14 &&
        openAmount < 0.65;

    /* 약지/새끼도 너무 멀리 벌어지지 않게 */
    const compactHand =
        distance(indexTip, middleTip) < 0.10 &&
        distance(middleTip, ringTip) < 0.12 &&
        distance(ringTip, pinkyTip) < 0.12;

    return gatheredFingers && compactHand;
}

/* 왼손 회전용: 집은 손 모양의 방향각 */
function getPinchRotationAngle(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    /* 엄지-검지 방향 벡터의 각도 */
    const angle = Math.atan2(indexTip.y - thumbTip.y, indexTip.x - thumbTip.x) * 180 / Math.PI;

    /* 적당한 범위로 제한 */
    return clamp(angle * 1.2, -90, 90);
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let userRightBloom = null;
    let userLeftRotate = null;

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

            /* 오른손 = 개화 */
            if (userLabel === 'Right') {
                if (isPalmFacingCamera(landmarks)) {
                    userRightBloom = getHandOpenAmount(landmarks);
                }
            }

            /* 왼손 = 회전 */
            if (userLabel === 'Left') {
                if (isPinchBallGesture(landmarks)) {
                    userLeftRotate = getPinchRotationAngle(landmarks);
                }
            }
        });

        if (userRightBloom !== null) {
            bloomValue = lerp(bloomValue, userRightBloom, 0.25);
        }

        if (userLeftRotate !== null) {
            rotateValue = lerp(rotateValue, userLeftRotate, 0.2);
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
