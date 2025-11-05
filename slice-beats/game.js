// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1000;
canvas.height = 700;

// Game state
let gameState = "start"; // 'start', 'playing', 'gameover'
let score = 0;
let combo = 0;
let maxCombo = 0;
let missed = 0;
const maxMissed = 10;

// Mouse tracking
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let lastMouseX = mouseX;
let lastMouseY = mouseY;
let mouseVelocity = 0;

// Saber trail for slicing detection
let saberTrail = [];
const trailLength = 8;

// Blocks array
let blocks = [];
let blockSpawnTimer = 0;
const blockSpawnInterval = 45; // frames between spawns

// Particles for effects
let particles = [];

// Perspective settings
const vanishingPointX = canvas.width / 2;
const vanishingPointY = canvas.height / 2;
const startZ = -5; // Blocks start far away
const endZ = 5; // Blocks reach the player

// Block class with 3D perspective
class Block {
  constructor() {
    this.size = 30;
    // Random position in 3D space
    this.x = (Math.random() - 0.5) * 6; // -3 to 3
    this.y = (Math.random() - 0.5) * 4; // -2 to 2
    this.z = startZ;
    this.speed = 0.06 + Math.random() * 0.02;

    // Color
    this.colors = ["#ff0000", "#0066ff", "#ffff00", "#ff00ff", "#00ff00"];
    this.color = this.colors[Math.floor(Math.random() * this.colors.length)];

    // Direction arrow
    this.direction = Math.random() > 0.5 ? "left" : "right";

    this.sliced = false;
    this.sliceTime = 0;
    this.sliceParts = [];
    this.rotation = 0;
  }

  update() {
    if (!this.sliced) {
      this.z += this.speed;
      this.rotation += 0.02;
    } else {
      this.sliceTime++;
      // Animate slice parts flying apart
      for (let part of this.sliceParts) {
        part.x += part.vx;
        part.y += part.vy;
        part.z += part.vz;
        part.rotation += part.rotSpeed;
        part.alpha -= 0.015;
      }
    }
  }

  // Convert 3D position to 2D screen position
  project() {
    const scale = 400 / (this.z + 6); // Perspective scale
    const screenX = vanishingPointX + this.x * scale;
    const screenY = vanishingPointY + this.y * scale;
    const screenSize = (this.size * scale) / 4;

    return { x: screenX, y: screenY, size: screenSize, scale: scale };
  }

  draw() {
    if (!this.sliced) {
      const pos = this.project();

      // Don't draw if behind camera
      if (this.z > 5) return;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(this.rotation);

      // Block shadow/glow
      ctx.shadowBlur = 30 * pos.scale;
      ctx.shadowColor = this.color;

      // Draw 3D-ish block
      ctx.fillStyle = this.color;
      ctx.fillRect(-pos.size / 2, -pos.size / 2, pos.size, pos.size);

      // Highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(
        -pos.size / 2 + 3,
        -pos.size / 2 + 3,
        pos.size - 6,
        pos.size - 6,
      );

      // Draw direction arrow
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `${pos.size * 0.6}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const arrow = this.direction === "left" ? "←" : "→";
      ctx.fillText(arrow, 0, 0);

      ctx.restore();
    } else {
      // Draw sliced parts
      for (let part of this.sliceParts) {
        const pos = part.project();
        if (part.z > 5) continue;

        ctx.save();
        ctx.globalAlpha = part.alpha;
        ctx.translate(pos.x, pos.y);
        ctx.rotate(part.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-pos.size / 2, -pos.size / 2, pos.size, pos.size);
        ctx.restore();
      }
    }
  }

  isOffScreen() {
    if (!this.sliced) {
      return this.z > endZ;
    } else {
      return this.sliceTime > 60;
    }
  }

  checkSlice(mouseX, mouseY, lastMouseX, lastMouseY, velocity) {
    if (this.sliced) return false;

    const pos = this.project();

    // Check if mouse is near the block
    const distToMouse = Math.sqrt(
      Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2),
    );

    // Need to be close and moving fast
    if (distToMouse < pos.size * 0.8 && velocity > 10) {
      // Check slice direction
      const dx = mouseX - lastMouseX;
      const sliceDirection = dx > 0 ? "right" : "left";

      // Must match the arrow direction
      if (sliceDirection === this.direction) {
        this.slice(dx, mouseY - lastMouseY);
        return true;
      }
    }

    return false;
  }

  slice(dx, dy) {
    this.sliced = true;
    const pos = this.project();

    // Create two halves flying apart
    this.sliceParts = [
      {
        x: this.x - 0.3,
        y: this.y,
        z: this.z,
        vx: -0.08,
        vy: -0.05,
        vz: 0.02,
        rotation: this.rotation,
        rotSpeed: -0.1,
        alpha: 1,
        size: this.size * 0.6,
        project: function () {
          const scale = 400 / (this.z + 6);
          return {
            x: vanishingPointX + this.x * scale,
            y: vanishingPointY + this.y * scale,
            size: (this.size * scale) / 4,
          };
        },
      },
      {
        x: this.x + 0.3,
        y: this.y,
        z: this.z,
        vx: 0.08,
        vy: -0.05,
        vz: 0.02,
        rotation: this.rotation,
        rotSpeed: 0.1,
        alpha: 1,
        size: this.size * 0.6,
        project: function () {
          const scale = 400 / (this.z + 6);
          return {
            x: vanishingPointX + this.x * scale,
            y: vanishingPointY + this.y * scale,
            size: (this.size * scale) / 4,
          };
        },
      },
    ];

    // Create particles
    createParticles(pos.x, pos.y, this.color);
  }
}

// Particle class
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.size = Math.random() * 5 + 2;
    this.color = color;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isDead() {
    return this.alpha <= 0;
  }
}

function createParticles(x, y, color) {
  for (let i = 0; i < 20; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// Mouse events
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  // Calculate velocity
  const dx = mouseX - lastMouseX;
  const dy = mouseY - lastMouseY;
  mouseVelocity = Math.sqrt(dx * dx + dy * dy);

  // Add to trail
  saberTrail.push({ x: mouseX, y: mouseY, time: Date.now() });
  if (saberTrail.length > trailLength) {
    saberTrail.shift();
  }
});

// Start button
document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("startScreen").style.display = "none";
  gameState = "playing";
  resetGame();
});

// Restart button
document.getElementById("restartBtn").addEventListener("click", () => {
  document.getElementById("gameOver").style.display = "none";
  gameState = "playing";
  resetGame();
});

function resetGame() {
  score = 0;
  combo = 0;
  maxCombo = 0;
  missed = 0;
  blocks = [];
  particles = [];
  blockSpawnTimer = 0;
  updateUI();
}

function spawnBlock() {
  blocks.push(new Block());
}

function checkCollisions() {
  if (mouseVelocity < 10) return; // Not moving fast enough

  for (let block of blocks) {
    if (
      block.checkSlice(mouseX, mouseY, lastMouseX, lastMouseY, mouseVelocity)
    ) {
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      score += 10 * combo;
      updateUI();
    }
  }
}

function updateUI() {
  document.getElementById("score").textContent = `Score: ${score}`;
  document.getElementById("combo").textContent = `Combo: ${combo}x`;
}

function drawSaber() {
  // Draw trail with glow
  if (saberTrail.length > 1) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ffff";

    for (let i = 1; i < saberTrail.length; i++) {
      const alpha = i / saberTrail.length;
      ctx.strokeStyle = `rgba(0, 255, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 8 * alpha;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(saberTrail[i - 1].x, saberTrail[i - 1].y);
      ctx.lineTo(saberTrail[i].x, saberTrail[i].y);
      ctx.stroke();
    }
  }

  // Draw cursor
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00ffff";
  ctx.fillStyle = "#00ffff";
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 15, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBackground() {
  // Draw grid lines for depth perception
  ctx.strokeStyle = "rgba(100, 100, 200, 0.2)";
  ctx.lineWidth = 2;

  // Vertical lines
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();

    // Draw line from far to near
    for (let z = startZ; z <= endZ; z += 0.5) {
      const scale = 400 / (z + 6);
      const x = vanishingPointX + i * scale;
      const y = vanishingPointY;

      if (z === startZ) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // Horizontal lines
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();

    for (let z = startZ; z <= endZ; z += 0.5) {
      const scale = 400 / (z + 6);
      const x = vanishingPointX;
      const y = vanishingPointY + i * scale;

      if (z === startZ) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

function gameLoop() {
  // Clear canvas with fade effect
  ctx.fillStyle = "rgba(15, 15, 30, 0.4)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw background grid
  drawBackground();

  if (gameState === "playing") {
    // Spawn blocks
    blockSpawnTimer++;
    if (blockSpawnTimer >= blockSpawnInterval) {
      spawnBlock();
      blockSpawnTimer = 0;
    }

    // Update and draw blocks
    for (let i = blocks.length - 1; i >= 0; i--) {
      blocks[i].update();
      blocks[i].draw();

      if (blocks[i].isOffScreen()) {
        if (!blocks[i].sliced) {
          missed++;
          combo = 0;
          updateUI();

          if (missed >= maxMissed) {
            gameState = "gameover";
            document.getElementById("gameOver").style.display = "block";
            document.getElementById("finalScore").textContent =
              `Final Score: ${score}`;
            document.getElementById("finalCombo").textContent =
              `Max Combo: ${maxCombo}x`;
          }
        }
        blocks.splice(i, 1);
      }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();

      if (particles[i].isDead()) {
        particles.splice(i, 1);
      }
    }

    // Check collisions
    checkCollisions();

    // Draw saber trail
    drawSaber();

    // Draw missed counter
    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Missed: ${missed}/${maxMissed}`, canvas.width - 20, 30);
    ctx.textAlign = "left";
  } else if (gameState === "start") {
    // Draw saber on start screen
    drawSaber();
  }

  requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();
