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
const trailLength = 10;

// Blocks array
let blocks = [];
let blockSpawnTimer = 0;
const blockSpawnInterval = 60; // frames between spawns

// Particles for effects
let particles = [];

// 4x3 grid positions (like Beat Saber)
const GRID_COLS = 4;
const GRID_ROWS = 3;
const GRID_SPACING = 120;
const GRID_OFFSET_X =
  canvas.width / 2 - (GRID_COLS * GRID_SPACING) / 2 + GRID_SPACING / 2;
const GRID_OFFSET_Y =
  canvas.height / 2 - (GRID_ROWS * GRID_SPACING) / 2 + GRID_SPACING / 2;

// Direction arrows (8 directions like Beat Saber)
const DIRECTIONS = [
  { name: "up", arrow: "↑", dx: 0, dy: -1 },
  { name: "down", arrow: "↓", dx: 0, dy: 1 },
  { name: "left", arrow: "←", dx: -1, dy: 0 },
  { name: "right", arrow: "→", dx: 1, dy: 0 },
  { name: "up-left", arrow: "↖", dx: -1, dy: -1 },
  { name: "up-right", arrow: "↗", dx: 1, dy: -1 },
  { name: "down-left", arrow: "↙", dx: -1, dy: 1 },
  { name: "down-right", arrow: "↘", dx: 1, dy: 1 },
];

// Block class - Beat Saber style
class Block {
  constructor() {
    // Much smaller size - like actual Beat Saber blocks
    this.baseSize = 50;

    // Pick a grid position (0-11 for 4x3 grid)
    const gridPos = Math.floor(Math.random() * (GRID_COLS * GRID_ROWS));
    this.gridX = gridPos % GRID_COLS;
    this.gridY = Math.floor(gridPos / GRID_COLS);

    // Target screen position
    this.targetX = GRID_OFFSET_X + this.gridX * GRID_SPACING;
    this.targetY = GRID_OFFSET_Y + this.gridY * GRID_SPACING;

    // Depth (z-axis: 0 = far away, 1 = at player)
    this.z = 0;
    this.speed = 0.008;

    // Color (red or blue like Beat Saber)
    this.color = Math.random() > 0.5 ? "#ff0040" : "#00a0ff";
    this.saberType = this.color === "#ff0040" ? "red" : "blue";

    // Direction
    this.direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];

    this.sliced = false;
    this.sliceTime = 0;
    this.sliceParts = [];
    this.rotation = 0;
  }

  update() {
    if (!this.sliced) {
      this.z += this.speed;
      this.rotation += 0.01;
    } else {
      this.sliceTime++;
      // Animate slice parts
      for (let part of this.sliceParts) {
        part.x += part.vx;
        part.y += part.vy;
        part.vx *= 0.96;
        part.vy += 0.5; // gravity
        part.rotation += part.rotSpeed;
        part.alpha -= 0.02;
      }
    }
  }

  // Get current screen position with perspective
  getScreenPos() {
    // Perspective scaling: blocks start small and grow as they approach
    const scale = this.z * 0.8 + 0.2; // Scale from 0.2 to 1.0
    const size = this.baseSize * scale;

    // Linear interpolation from center to grid position
    const startX = canvas.width / 2;
    const startY = canvas.height / 2;
    const x = startX + (this.targetX - startX) * this.z;
    const y = startY + (this.targetY - startY) * this.z;

    return { x, y, size, scale };
  }

  draw() {
    if (!this.sliced) {
      const pos = this.getScreenPos();

      // Don't draw if not visible yet
      if (this.z < 0.1) return;

      // Check if in hit zone
      const inHitZone = this.z >= 0.7 && this.z <= 1.1;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(this.rotation);

      // Enhanced glow effect when in hit zone
      if (inHitZone) {
        ctx.shadowBlur = 35 * pos.scale;
        ctx.shadowColor = this.color;
      } else {
        ctx.shadowBlur = 20 * pos.scale;
        ctx.shadowColor = this.color;
      }

      // Main block (cube-like with slight 3D effect)
      ctx.fillStyle = this.color;
      ctx.fillRect(-pos.size / 2, -pos.size / 2, pos.size, pos.size);

      // Inner darker square for depth
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(
        -pos.size / 2 + 4,
        -pos.size / 2 + 4,
        pos.size - 8,
        pos.size - 8,
      );

      // Highlight on top-left for 3D effect
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(
        -pos.size / 2,
        -pos.size / 2,
        pos.size * 0.3,
        pos.size * 0.3,
      );

      // Add pulsing white border when in hit zone
      if (inHitZone) {
        const pulseAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(
          -pos.size / 2 - 2,
          -pos.size / 2 - 2,
          pos.size + 4,
          pos.size + 4,
        );
      }

      // Draw direction arrow (larger and clearer)
      ctx.shadowBlur = 5;
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${pos.size * 0.6}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.direction.arrow, 0, 0);

      ctx.restore();
    } else {
      // Draw sliced parts
      for (let part of this.sliceParts) {
        if (part.alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = part.alpha;
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rotation);

        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(-part.size / 2, -part.size / 2, part.size, part.size);

        ctx.restore();
      }
    }
  }

  isOffScreen() {
    if (!this.sliced) {
      return this.z > 1.2; // Past the player
    } else {
      return this.sliceTime > 100 || this.sliceParts[0].alpha <= 0;
    }
  }

  checkSlice(mouseX, mouseY, lastMouseX, lastMouseY, velocity) {
    if (this.sliced) return false;
    if (this.z < 0.7 || this.z > 1.1) return false; // Only slice in the hit zone

    const pos = this.getScreenPos();

    // Check if mouse is near the block
    const distToMouse = Math.sqrt(
      Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2),
    );

    // Need to be close and moving fast
    if (distToMouse < pos.size * 0.9 && velocity > 8) {
      // Calculate slice direction
      const dx = mouseX - lastMouseX;
      const dy = mouseY - lastMouseY;
      const magnitude = Math.sqrt(dx * dx + dy * dy);

      if (magnitude === 0) return false;

      const sliceDirX = dx / magnitude;
      const sliceDirY = dy / magnitude;

      // Check if slice direction matches the arrow (with some tolerance)
      const dotProduct =
        sliceDirX * this.direction.dx + sliceDirY * this.direction.dy;

      // Need at least 70% alignment with the arrow direction
      if (dotProduct > 0.7) {
        this.slice(dx, dy);
        return true;
      }
    }

    return false;
  }

  slice(dx, dy) {
    this.sliced = true;
    const pos = this.getScreenPos();

    // Create two halves flying apart
    this.sliceParts = [
      {
        x: pos.x - pos.size * 0.25,
        y: pos.y,
        vx: -3 - Math.random() * 2,
        vy: -4 - Math.random() * 2,
        rotation: this.rotation,
        rotSpeed: -0.15,
        alpha: 1,
        size: pos.size * 0.5,
      },
      {
        x: pos.x + pos.size * 0.25,
        y: pos.y,
        vx: 3 + Math.random() * 2,
        vy: -4 - Math.random() * 2,
        rotation: this.rotation,
        rotSpeed: 0.15,
        alpha: 1,
        size: pos.size * 0.5,
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
    this.vx = (Math.random() - 0.5) * 12;
    this.vy = (Math.random() - 0.5) * 12;
    this.size = Math.random() * 4 + 2;
    this.color = color;
    this.alpha = 1;
    this.decay = Math.random() * 0.04 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
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
  for (let i = 0; i < 25; i++) {
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
  if (mouseVelocity < 8) return;

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
  // Draw glowing trail
  if (saberTrail.length > 1) {
    for (let i = 1; i < saberTrail.length; i++) {
      const alpha = i / saberTrail.length;

      // Determine color based on position (left side red, right side blue)
      const avgX = (saberTrail[i].x + saberTrail[i - 1].x) / 2;
      const trailColor = avgX < canvas.width / 2 ? "#ff0040" : "#00a0ff";

      ctx.save();
      ctx.shadowBlur = 20 * alpha;
      ctx.shadowColor = trailColor;
      ctx.strokeStyle = trailColor;
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineWidth = 12 * alpha;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(saberTrail[i - 1].x, saberTrail[i - 1].y);
      ctx.lineTo(saberTrail[i].x, saberTrail[i].y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw cursor (changes color based on side)
  const cursorColor = mouseX < canvas.width / 2 ? "#ff0040" : "#00a0ff";

  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = cursorColor;
  ctx.fillStyle = cursorColor;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = cursorColor;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBackground() {
  // Draw Beat Saber style grid/track
  ctx.strokeStyle = "rgba(0, 180, 255, 0.15)";
  ctx.lineWidth = 2;

  // Draw the 4x3 grid at the hit zone with enhanced visibility
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const x = GRID_OFFSET_X + col * GRID_SPACING;
      const y = GRID_OFFSET_Y + row * GRID_SPACING;

      // Pulsing effect for hit zone grid
      const pulseAlpha = 0.15 + Math.sin(Date.now() / 200) * 0.08;
      ctx.strokeStyle = `rgba(0, 255, 200, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 30, y - 30, 60, 60);
    }
  }

  // Draw hit zone plane (subtle glowing rectangle)
  const hitZonePulse = 0.08 + Math.sin(Date.now() / 300) * 0.04;
  ctx.fillStyle = `rgba(0, 255, 200, ${hitZonePulse})`;
  ctx.fillRect(
    GRID_OFFSET_X - GRID_SPACING / 2 - 20,
    GRID_OFFSET_Y - GRID_SPACING / 2 - 20,
    GRID_COLS * GRID_SPACING + 40,
    GRID_ROWS * GRID_SPACING + 40,
  );

  // Draw perspective lines from center to grid positions
  ctx.strokeStyle = "rgba(0, 180, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const targetX = GRID_OFFSET_X + col * GRID_SPACING;
      const targetY = GRID_OFFSET_Y + row * GRID_SPACING;

      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
    }
  }
}

function gameLoop() {
  // Clear with fade effect
  ctx.fillStyle = "rgba(10, 10, 20, 0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw background
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
    ctx.fillStyle = missed > 7 ? "#ff4444" : "white";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Missed: ${missed}/${maxMissed}`, canvas.width - 20, 30);
    ctx.textAlign = "left";
  } else if (gameState === "start") {
    drawSaber();
  }

  requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();
