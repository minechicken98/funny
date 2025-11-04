// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1000;
canvas.height = 700;

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let combo = 0;
let missed = 0;
const maxMissed = 5;

// Mouse tracking
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let lastMouseX = mouseX;
let lastMouseY = mouseY;
let saberTrail = [];

// Saber settings
const saberLength = 100;
let saberAngle = 0;
let saberColor = '#00ffff';

// Blocks array
let blocks = [];
let blockSpawnTimer = 0;
const blockSpawnInterval = 60; // frames between spawns

// Particles for effects
let particles = [];

// Block class
class Block {
    constructor() {
        this.size = 50;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = -this.size;
        this.speed = 2 + Math.random() * 2;
        this.colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.sliced = false;
        this.sliceTime = 0;
        this.sliceParts = [];
    }

    update() {
        if (!this.sliced) {
            this.y += this.speed;
            this.rotation += this.rotationSpeed;
        } else {
            this.sliceTime++;
            // Animate slice parts
            for (let part of this.sliceParts) {
                part.x += part.vx;
                part.y += part.vy;
                part.vy += 0.3; // gravity
                part.rotation += part.rotSpeed;
                part.alpha -= 0.02;
            }
        }
    }

    draw() {
        if (!this.sliced) {
            ctx.save();
            ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
            ctx.rotate(this.rotation);

            // Draw block with glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

            // Inner square for effect
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(-this.size / 2 + 5, -this.size / 2 + 5, this.size - 10, this.size - 10);

            ctx.restore();
        } else {
            // Draw sliced parts
            for (let part of this.sliceParts) {
                ctx.save();
                ctx.globalAlpha = part.alpha;
                ctx.translate(part.x, part.y);
                ctx.rotate(part.rotation);
                ctx.fillStyle = this.color;
                ctx.fillRect(-part.width / 2, -part.height / 2, part.width, part.height);
                ctx.restore();
            }
        }
    }

    isOffScreen() {
        if (!this.sliced) {
            return this.y > canvas.height;
        } else {
            return this.sliceTime > 100;
        }
    }

    slice(angle) {
        this.sliced = true;

        // Create two halves
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;

        this.sliceParts = [
            {
                x: centerX - 10,
                y: centerY,
                width: this.size / 2,
                height: this.size,
                vx: -3 * Math.cos(angle),
                vy: -3 * Math.sin(angle) - 2,
                rotation: this.rotation,
                rotSpeed: -0.1,
                alpha: 1
            },
            {
                x: centerX + 10,
                y: centerY,
                width: this.size / 2,
                height: this.size,
                vx: 3 * Math.cos(angle),
                vy: 3 * Math.sin(angle) - 2,
                rotation: this.rotation,
                rotSpeed: 0.1,
                alpha: 1
            }
        ];

        // Create particles
        createParticles(centerX, centerY, this.color);
    }
}

// Particle class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.size = Math.random() * 4 + 2;
        this.color = color;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
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
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Mouse events
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    // Calculate saber angle based on movement
    const dx = mouseX - lastMouseX;
    const dy = mouseY - lastMouseY;
    if (dx !== 0 || dy !== 0) {
        saberAngle = Math.atan2(dy, dx);
    }

    // Add to trail
    saberTrail.push({ x: mouseX, y: mouseY, alpha: 1 });
    if (saberTrail.length > 15) {
        saberTrail.shift();
    }
});

// Start button
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    gameState = 'playing';
    resetGame();
});

// Restart button
document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOver').style.display = 'none';
    gameState = 'playing';
    resetGame();
});

function resetGame() {
    score = 0;
    combo = 0;
    missed = 0;
    blocks = [];
    particles = [];
    blockSpawnTimer = 0;
}

function spawnBlock() {
    blocks.push(new Block());
}

function checkCollisions() {
    const speed = Math.sqrt(
        Math.pow(mouseX - lastMouseX, 2) +
        Math.pow(mouseY - lastMouseY, 2)
    );

    // Only slice if moving fast enough
    if (speed < 5) return;

    for (let block of blocks) {
        if (block.sliced) continue;

        // Check if saber passes through block
        const blockCenterX = block.x + block.size / 2;
        const blockCenterY = block.y + block.size / 2;

        // Distance from mouse to block center
        const dist = Math.sqrt(
            Math.pow(mouseX - blockCenterX, 2) +
            Math.pow(mouseY - blockCenterY, 2)
        );

        if (dist < block.size) {
            block.slice(saberAngle);
            combo++;
            score += 10 * combo;
            updateUI();
        }
    }
}

function updateUI() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('combo').textContent = `Combo: ${combo}x`;
}

function drawSaber() {
    // Draw trail
    for (let i = 0; i < saberTrail.length; i++) {
        const trail = saberTrail[i];
        const alpha = (i / saberTrail.length) * 0.5;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = saberColor;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';

        if (i > 0) {
            ctx.beginPath();
            ctx.moveTo(saberTrail[i - 1].x, saberTrail[i - 1].y);
            ctx.lineTo(trail.x, trail.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Draw saber
    ctx.save();
    ctx.translate(mouseX, mouseY);
    ctx.rotate(saberAngle);

    // Saber glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = saberColor;

    // Saber blade
    const gradient = ctx.createLinearGradient(0, 0, saberLength, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.3, saberColor);
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.3)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, -5, saberLength, 10);

    // Saber handle
    ctx.fillStyle = '#666';
    ctx.fillRect(-20, -8, 25, 16);
    ctx.fillStyle = '#333';
    ctx.fillRect(-20, -6, 25, 12);

    ctx.restore();

    // Draw cursor point
    ctx.fillStyle = saberColor;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
    ctx.fill();
}

function gameLoop() {
    // Clear canvas
    ctx.fillStyle = 'rgba(15, 15, 30, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'playing') {
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
                        gameState = 'gameover';
                        document.getElementById('gameOver').style.display = 'block';
                        document.getElementById('finalScore').textContent = `Final Score: ${score}`;
                        document.getElementById('finalCombo').textContent = `Best Combo: ${combo}x`;
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

        // Draw saber
        drawSaber();

        // Draw missed counter
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Missed: ${missed}/${maxMissed}`, canvas.width - 20, 30);
        ctx.textAlign = 'left';

    } else if (gameState === 'start') {
        // Draw saber on start screen
        drawSaber();
    }

    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();
