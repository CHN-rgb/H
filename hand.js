import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

function drawHand(ctx, canvas, landmarks, label) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(237,205,210,0.95)";
  ctx.fillStyle = "rgba(237,205,210,0.95)";

  for (const [start, end] of HAND_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];

    ctx.beginPath();
    ctx.moveTo((1 - a.x) * w, a.y * h);
    ctx.lineTo((1 - b.x) * w, b.y * h);
    ctx.stroke();
  }

  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc((1 - point.x) * w, point.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const wrist = landmarks[0];
  ctx.font = "12px Arial";
  ctx.fillText(label, (1 - wrist.x) * w + 8, wrist.y * h - 8);
}

export async function setupHandTracking() {
  const webcam = document.getElementById("webcam");
  const outputCanvas = document.getElementById("outputCanvas");
  const cameraStatus = document.getElementById("cameraStatus");

  if (!webcam || !outputCanvas || !cameraStatus) {
    console.warn("Hand tracking elements not found.");
    return;
  }

  const ctx = outputCanvas.getContext("2d");
  let handLandmarker = null;
  let lastVideoTime = -1;

  try {
    cameraStatus.textContent = "requesting camera...";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: false
    });

    webcam.srcObject = stream;

    await new Promise((resolve) => {
      webcam.onloadedmetadata = () => resolve();
    });

    await webcam.play();

    outputCanvas.width = webcam.videoWidth || 640;
    outputCanvas.height = webcam.videoHeight || 480;

    cameraStatus.textContent = "loading hand model...";

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
      },
      runningMode: "VIDEO",
      numHands: 2
    });

    cameraStatus.textContent = "hand tracking ready";

    function predictLoop() {
      if (!handLandmarker) {
        requestAnimationFrame(predictLoop);
        return;
      }

      if (webcam.readyState >= 2 && lastVideoTime !== webcam.currentTime) {
        lastVideoTime = webcam.currentTime;

        const results = handLandmarker.detectForVideo(webcam, performance.now());
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          for (let i = 0; i < results.landmarks.length; i++) {
            const landmarks = results.landmarks[i];
            const label =
              results.handednesses?.[i]?.[0]?.categoryName || "Hand";
            drawHand(ctx, outputCanvas, landmarks, label);
          }

          cameraStatus.textContent = `hands detected: ${results.landmarks.length}`;
        } else {
          cameraStatus.textContent = "show your hand to camera";
        }
      }

      requestAnimationFrame(predictLoop);
    }

    requestAnimationFrame(predictLoop);
  } catch (error) {
    console.error(error);
    cameraStatus.textContent = "camera/model error";
  }
}