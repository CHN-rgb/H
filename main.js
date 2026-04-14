import { setupHandTracking } from "./hand.js";

const screens = document.querySelectorAll(".screen");
const piece = document.getElementById("piece");
const flowerName = document.getElementById("flowerName");
const leftArrow = document.getElementById("leftArrow");
const rightArrow = document.getElementById("rightArrow");
const musicToggle = document.getElementById("musicToggle");
const bgm = document.getElementById("bgm");

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
    screen.classList.toggle("active", index === current);
  });

  piece.textContent = `PIECE ${current + 1}`;
  flowerName.textContent = names[current];
}

leftArrow.addEventListener("click", () => {
  current = (current + 4) % 5;
  updateScreen();
});

rightArrow.addEventListener("click", () => {
  current = (current + 1) % 5;
  updateScreen();
});

musicToggle.addEventListener("click", async () => {
  musicToggle.classList.toggle("active");

  if (musicToggle.classList.contains("active")) {
    try {
      bgm.volume = 0.3;
      await bgm.play();
    } catch (error) {
      console.warn("Audio play failed:", error);
    }
  } else {
    bgm.pause();
  }
});

updateScreen();
setupHandTracking();