// User Profile & Stats
let globalCoins = parseInt(localStorage.getItem('globalCoins')) || 0;
let bestTime = parseInt(localStorage.getItem('bestTime')) || 0;
let userName = localStorage.getItem('userName') || ('User' + Math.floor(100 + Math.random() * 900));
let userAvatar = localStorage.getItem('userAvatar') || 'logo.jpg';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width, height;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

window.addEventListener('resize', resize);
resize();

const headImg = new Image();
headImg.src = 'sperm_head_white.jpg';

const coinImg = new Image();
coinImg.src = 'coin.jpg';

let bgScrollY = 0;
let projectiles = [];
let particles = [];
let screenShake = 0;
let bots = [];
let lastBotSpawn = Date.now();
let coins = [];
let lastCoinSpawn = Date.now();
let coinsCollected = 0;
let GAME_START_TIME = Date.now();

let gameState = 'splash'; // 'splash', 'menu', 'playing', 'gameover', 'paused'
let timeScale = 1.0;

setTimeout(() => {
    if (gameState === 'splash') {
        document.getElementById('main-menu').classList.add('show-menu');
        gameState = 'menu';
    }
}, 2500);

let hp = 3;
let invulnerableTime = 0;
let ammo = 10;
let isReloading = false;
let reloadStartTime = 0;
const RELOAD_DURATION = 2500;

let player = {
    x: width / 2,
    y: height - 150,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    history: []
};
for (let i = 0; i < 40; i++) {
    player.history.push({x: player.x, y: player.y + i * 4});
}

let isPointerDown = false;
let pointerX = player.x;
let pointerY = player.y;

// Shoot logic
const shootBtnContainer = document.getElementById('shoot-btn-container');

function shoot() {
    if (isReloading || ammo <= 0 || gameState !== 'playing') return;
    
    const speed = 8; // Bullet speed reduced
    projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(player.angle) * speed,
        vy: Math.sin(player.angle) * speed
    });
    
    screenShake = 6;
    for(let i=0; i<8; i++) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(player.angle + (Math.random()-0.5)*1.5) * (Math.random()*6 + 2),
            vy: Math.sin(player.angle + (Math.random()-0.5)*1.5) * (Math.random()*6 + 2),
            life: 1.0,
            decay: Math.random() * 0.05 + 0.05
        });
    }
    
    shootBtnContainer.classList.add('pressed');
    setTimeout(() => shootBtnContainer.classList.remove('pressed'), 100);
    
    ammo--;
    if (ammo <= 0) {
        isReloading = true;
        reloadStartTime = Date.now();
    }
}

shootBtnContainer.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // Prevents moving player when pressing shoot
    shoot();
});
shootBtnContainer.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!e.repeat) shoot();
        e.preventDefault();
    }
});

// Handle both mouse and touch via Pointer Events
window.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
    if (isPointerDown) {
        pointerX = e.clientX;
        pointerY = e.clientY;
    }
});

window.addEventListener('pointerup', () => {
    isPointerDown = false;
});

window.addEventListener('pointercancel', () => {
    isPointerDown = false;
});

let time = 0;

function update() {
    if (gameState === 'splash' || gameState === 'menu') {
        time += 0.15;
        bgScrollY += 4;
        
        // Spawn visual ascending bots
        if (Math.random() < 0.04) {
            bots.push({
                x: Math.random() * width,
                y: height + 100,
                vx: (Math.random() - 0.5) * 2,
                vy: -3 - Math.random() * 3,
                angle: -Math.PI/2,
                history: []
            });
            let b = bots[bots.length - 1];
            for (let i=0; i<40; i++) b.history.push({x: b.x, y: b.y + i * 4});
        }
        
        for (let i = bots.length - 1; i >= 0; i--) {
            let b = bots[i];
            b.x += b.vx;
            b.y += b.vy;
            b.angle = Math.atan2(b.vy, b.vx);
            updateTail(b, Math.hypot(b.vx, b.vy));
            if (b.y < -150) bots.splice(i, 1);
        }
        return;
    }

    if (gameState === 'gameover' || gameState === 'paused') {
        timeScale += (0 - timeScale) * 0.05; // Smoothly stop time
    } else if (gameState === 'playing') {
        timeScale += (1.0 - timeScale) * 0.1; // Smoothly resume time
    }
    
    time += 0.15 * timeScale;
    
    // Background scroll logic
    bgScrollY += 4 * timeScale;
    // No wrap needed, modulus math in draw handles infinite scrolling seamlessly
    
    if (isPointerDown) {
        const dx = pointerX - player.x;
        const dy = pointerY - player.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 2) {
            const maxSpeed = 3.5; // Player speed reduced
            const moveSpeed = Math.min(maxSpeed, dist); // Prevents overshoot and shaking
            player.vx = (dx / dist) * moveSpeed;
            player.vy = (dy / dist) * moveSpeed;
            
            // Smoothly interpolate angle
            const targetAngle = Math.atan2(dy, dx);
            let angleDiff = targetAngle - player.angle;
            
            // Normalize angle diff to -PI to PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            player.angle += angleDiff * 0.15;
        } else {
            player.vx *= 0.8;
            player.vy *= 0.8;
        }
    } else {
        player.vx *= 0.95;
        player.vy *= 0.95;
        
        // Slowly face upwards when drifting
        const targetAngle = -Math.PI / 2;
        let angleDiff = targetAngle - player.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        player.angle += angleDiff * 0.05;
    }
    
    player.x += player.vx * timeScale;
    player.y += player.vy * timeScale;
    
    // Boundary collision against the walls
    const scale = Math.min(width / 400, 1.5);
    const wallThickness = width * 0.12 + 35 * scale; // approximate inner wall boundary
    const playerRadius = 25; // approximate radius of the head
    
    if (player.x < wallThickness + playerRadius) {
        player.x = wallThickness + playerRadius;
        player.vx = 0;
    }
    if (player.x > width - wallThickness - playerRadius) {
        player.x = width - wallThickness - playerRadius;
        player.vx = 0;
    }
    if (player.y < playerRadius) player.y = playerRadius;
    if (player.y > height - playerRadius) player.y = height - playerRadius;
    
    const speed = Math.hypot(player.vx, player.vy);

    updateTail(player, speed);

    // Handle reload
    if (isReloading) {
        if (Date.now() - reloadStartTime >= RELOAD_DURATION) {
            ammo = 10;
            isReloading = false;
        }
    }
    
    if (invulnerableTime > 0) invulnerableTime -= 16;

    // Spawn bots and coins
    if (Date.now() - GAME_START_TIME > 3000) {
        if (Date.now() - lastBotSpawn > 2000) {
            spawnBot();
            lastBotSpawn = Date.now();
        }
        
        if (Date.now() - lastCoinSpawn > 6000 + Math.random() * 5000) {
            spawnCoin();
            lastCoinSpawn = Date.now();
        }
    }
    
    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
        let c = coins[i];
        c.y += c.vy * timeScale;
        c.rotation += 0.05 * timeScale;
        
        let dist = Math.hypot(c.x - player.x, c.y - player.y);
        if (dist < 40 && gameState === 'playing') {
            coinsCollected++;
            document.getElementById('coin-text').innerText = coinsCollected;
            
            const counter = document.getElementById('coin-counter');
            counter.classList.remove('coin-pop');
            void counter.offsetWidth;
            counter.classList.add('coin-pop');
            
            for(let k=0; k<15; k++) {
                particles.push({
                    x: c.x, y: c.y,
                    vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                    life: 1.0, decay: Math.random() * 0.04 + 0.02,
                    color: '#ffd700'
                });
            }
            coins.splice(i, 1);
            continue;
        }
        
        if (c.y > height + 50) {
            coins.splice(i, 1);
        }
    }
    
    // Update bots
    for (let i = bots.length - 1; i >= 0; i--) {
        let b = bots[i];
        
        // Player collision
        let distToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
        if (distToPlayer < 40 && invulnerableTime <= 0 && gameState === 'playing') {
            hp--;
            if (hp >= 0) {
                const heartEl = document.getElementById('heart-' + (hp + 1));
                if (heartEl) heartEl.classList.add('lost');
            }
            invulnerableTime = 2000;
            screenShake = 15;
            for(let k=0; k<20; k++) {
                particles.push({
                    x: player.x, y: player.y,
                    vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
                    life: 1.0, decay: Math.random() * 0.03 + 0.01,
                    color: '#ff3b5c'
                });
            }
            if (hp <= 0) {
                gameState = 'gameover';
                document.getElementById('game-over-screen').classList.add('visible');
                
                // Save stats
                globalCoins += coinsCollected;
                localStorage.setItem('globalCoins', globalCoins);
                
                let runTime = Math.floor((Date.now() - GAME_START_TIME) / 1000);
                if (runTime > bestTime) {
                    bestTime = runTime;
                    localStorage.setItem('bestTime', bestTime);
                }
            }
        }
        
        const dx = b.targetX - b.x;
        const dy = b.targetY - b.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 50) {
            const minX = wallThickness + 30;
            const maxX = width - wallThickness - 30;
            b.targetX = minX + Math.random() * (maxX - minX);
            b.targetY = height * 0.1 + Math.random() * (height * 0.8);
        }
        
        const bSpeed = 2; // Bot speed reduced
        b.vx += ((dx / dist) * bSpeed - b.vx) * 0.05;
        b.vy += ((dy / dist) * bSpeed - b.vy) * 0.05;
        
        if (Math.hypot(b.vx, b.vy) > 0.1) {
            b.angle = Math.atan2(b.vy, b.vx);
        }
        
        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;
        
        updateTail(b, Math.hypot(b.vx, b.vy) * timeScale);
    }
    
    // Update screen shake
    screenShake *= 0.8;
    if (screenShake < 0.1) screenShake = 0;

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        
        let hit = false;
        for (let j = bots.length - 1; j >= 0; j--) {
            let b = bots[j];
            if (Math.hypot(b.x - p.x, b.y - p.y) < 30) {
                bots.splice(j, 1);
                hit = true;
                screenShake = 8;
                for(let k=0; k<15; k++) {
                    particles.push({
                        x: b.x, y: b.y,
                        vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                        life: 1.0, decay: Math.random() * 0.05 + 0.02
                    });
                }
                break;
            }
        }
        
        if (hit || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
            projectiles.splice(i, 1);
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        p.life -= p.decay * timeScale;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawScallopLayer(ctx, width, height, scrollY, wallWidth, radius, spacing, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, wallWidth, height);
    ctx.fillRect(width - wallWidth, 0, wallWidth, height);
    
    const startY = (scrollY % spacing) - spacing;
    ctx.beginPath();
    for (let y = startY; y < height + spacing + radius; y += spacing) {
        ctx.moveTo(wallWidth + radius, y);
        ctx.arc(wallWidth, y, radius, 0, Math.PI * 2);
        
        ctx.moveTo(width - wallWidth + radius, y);
        ctx.arc(width - wallWidth, y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
}

function draw() {
    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }
    
    // Center background
    ctx.fillStyle = '#8f3d45'; 
    ctx.fillRect(0, 0, width, height);
    
    // Scale for responsive design (base width 400px for mobile)
    const scale = Math.min(width / 400, 1.5);
    
    // Medium dark layer
    drawScallopLayer(ctx, width, height, bgScrollY, width * 0.12, 35 * scale, 75 * scale, '#cc5b68');
    
    // Lighter pink layer (outer edge)
    drawScallopLayer(ctx, width, height, bgScrollY, width * 0.04, 30 * scale, 75 * scale, '#e58c97');
    
    // Draw coins
    for (let c of coins) {
        ctx.save();
        ctx.translate(c.x, c.y);
        
        // Halo glow
        const pulse = Math.sin(time * 3) * 5;
        ctx.beginPath();
        ctx.arc(0, 0, 25 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fill();
        
        // Spin effect
        ctx.scale(Math.cos(c.rotation), 1); 
        
        if (coinImg.complete && coinImg.naturalWidth !== 0) {
            ctx.globalCompositeOperation = 'screen';
            const size = 45; 
            ctx.drawImage(coinImg, -size/2, -size/2, size, size);
        } else {
            // fallback
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    // Draw bots
    for (let b of bots) {
        drawTail(ctx, b, time);
        if (headImg.complete && headImg.naturalWidth !== 0) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.angle);
            ctx.globalCompositeOperation = 'screen';
            const imgW = 70; // slightly smaller
            const imgH = 70;
            ctx.drawImage(headImg, -imgW/2, -imgH/2, imgW, imgH);
            ctx.restore();
        }
    }

    // Draw player tail
    if (invulnerableTime <= 0 || Math.floor(Date.now() / 100) % 2 === 0) {
        drawTail(ctx, player, time);
        
        // Draw head image
        if (headImg.complete && headImg.naturalWidth !== 0) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(player.angle);
            
            // Screen blend mode removes black background
            ctx.globalCompositeOperation = 'screen';
            
            const imgW = 80;
            const imgH = 80;
            
            // Offset so it connects nicely to the tail
            ctx.drawImage(headImg, -imgW/2, -imgH/2, imgW, imgH);
            
            ctx.restore();
        }
    }
    
    // Draw reload bar
    if (isReloading) {
        const progress = (Date.now() - reloadStartTime) / RELOAD_DURATION;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(player.x - 30, player.y - 60, 60, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(player.x - 30, player.y - 60, 60 * progress, 6);
    }
    
    // Draw projectiles
    ctx.fillStyle = '#ffffff';
    for (let p of projectiles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw particles
    for (let p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color || '#ffc864';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    ctx.restore(); // Restore screen shake
}

function spawnCoin() {
    const scale = Math.min(width / 400, 1.5);
    const wallThickness = width * 0.12 + 35 * scale;
    const padding = 30;
    
    const minX = wallThickness + padding;
    const maxX = width - wallThickness - padding;
    
    coins.push({
        x: minX + Math.random() * (maxX - minX),
        y: -50,
        vy: 1.5 + Math.random() * 1.5, // falls down slower
        rotation: 0
    });
}

function spawnBot() {
    const scale = Math.min(width / 400, 1.5);
    const wallThickness = width * 0.12 + 35 * scale;
    const padding = 30;
    
    const minX = wallThickness + padding;
    const maxX = width - wallThickness - padding;
    const startX = minX + Math.random() * (maxX - minX);
    
    let bot = {
        x: startX,
        y: height + 150,
        vx: 0,
        vy: -4,
        angle: -Math.PI / 2,
        history: [],
        targetX: minX + Math.random() * (maxX - minX),
        targetY: height * 0.1 + Math.random() * (height * 0.8)
    };
    
    for (let i = 0; i < 40; i++) {
        bot.history.push({x: bot.x, y: bot.y + i * 4});
    }
    bots.push(bot);
}

function updateTail(entity, speed) {
    if (speed > 0.5) {
        entity.history.unshift({x: entity.x, y: entity.y});
        if (entity.history.length > 40) entity.history.pop();
    } else {
        for (let i = 0; i < entity.history.length; i++) {
            const targetX = entity.x - Math.cos(entity.angle) * i * 4;
            const targetY = entity.y - Math.sin(entity.angle) * i * 4;
            entity.history[i].x += (targetX - entity.history[i].x) * 0.15;
            entity.history[i].y += (targetY - entity.history[i].y) * 0.15;
        }
    }
}

function drawTail(ctx, entity, time) {
    if (entity.history.length > 1) {
        const leftPts = [];
        const rightPts = [];
        
        for (let i = 0; i < entity.history.length; i++) {
             const pt = entity.history[i];
             const progress = i / entity.history.length;
             
             const speed = Math.hypot(entity.vx, entity.vy);
             const waveMultiplier = speed > 0.5 ? 1 : 0.3;
             
             const waveAmplitude = 12 * Math.pow(progress, 0.5) * waveMultiplier;
             const waveOffset = Math.sin(time - i * 0.3) * waveAmplitude;
             
             let nx = 0, ny = 0;
             if (i < entity.history.length - 1) {
                 const nextPt = entity.history[i+1];
                 const dx = nextPt.x - pt.x;
                 const dy = nextPt.y - pt.y;
                 const dist = Math.hypot(dx, dy);
                 if(dist > 0) {
                     nx = -dy / dist;
                     ny = dx / dist;
                 }
             } else {
                 nx = Math.cos(entity.angle + Math.PI/2);
                 ny = Math.sin(entity.angle + Math.PI/2);
             }
             const drawX = pt.x + nx * waveOffset;
             const drawY = pt.y + ny * waveOffset;
             
             const thickness = 6 * (1 - progress) + 1; // Smooth taper
             
             leftPts.push({x: drawX + nx * thickness, y: drawY + ny * thickness});
             rightPts.push({x: drawX - nx * thickness, y: drawY - ny * thickness});
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        for (let i = 0; i < leftPts.length; i++) {
            if (i === 0) ctx.moveTo(leftPts[i].x, leftPts[i].y);
            else ctx.lineTo(leftPts[i].x, leftPts[i].y);
        }
        for (let i = rightPts.length - 1; i >= 0; i--) {
            ctx.lineTo(rightPts[i].x, rightPts[i].y);
        }
        ctx.closePath();
        ctx.fill();
    }
}

function restartGame() {
    gameState = 'playing';
    timeScale = 1.0;
    hp = 3;
    ammo = 10;
    isReloading = false;
    invulnerableTime = 0;
    bots = [];
    coins = [];
    projectiles = [];
    particles = [];
    screenShake = 0;
    coinsCollected = 0;
    document.getElementById('coin-text').innerText = '0';
    
    player.x = width / 2;
    player.y = height - 150;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    for (let i = 0; i < player.history.length; i++) {
        player.history[i] = {x: player.x, y: player.y + i * 4};
    }
    
    document.getElementById('game-over-screen').classList.remove('visible');
    document.getElementById('pause-screen').classList.remove('visible');
    
    for (let i = 1; i <= 3; i++) {
        const heartEl = document.getElementById('heart-' + i);
        if (heartEl) {
            heartEl.classList.remove('lost');
        }
    }
    
    lastBotSpawn = Date.now();
    lastCoinSpawn = Date.now();
}

document.getElementById('btn-restart').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    restartGame();
});

function showMainMenu() {
    gameState = 'menu';
    const menu = document.getElementById('main-menu');
    
    // Clear game entities so they don't stay frozen in background
    bots = []; 
    coins = [];
    projectiles = [];
    particles = [];
    
    menu.style.display = 'flex';
    menu.classList.remove('fade-out-zoom'); // Just in case it was stuck
    
    // Replay the transition animations for a smooth effect
    menu.classList.remove('show-menu');
    void menu.offsetWidth;
    menu.style.opacity = '1';
    menu.classList.add('show-menu');
    
    document.getElementById('game-over-screen').classList.remove('visible');
    document.getElementById('pause-screen').classList.remove('visible');
}

document.getElementById('btn-menu').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    showMainMenu();
});
document.getElementById('btn-menu-pause').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    showMainMenu();
});

document.getElementById('btn-play').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('main-menu');
    menu.classList.add('fade-out-zoom');
    
    // Smooth transition flash
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(0, 0, width, height);
    
    setTimeout(() => {
        menu.style.display = 'none';
        menu.classList.remove('fade-out-zoom');
    }, 800);
    
    GAME_START_TIME = Date.now();
    restartGame();
});

// Profile Logic
function formatTime(seconds) {
    let m = Math.floor(seconds / 60);
    let s = seconds % 60;
    return (m < 10 ? '0'+m : m) + ':' + (s < 10 ? '0'+s : s);
}

function updateProfileUI() {
    document.getElementById('profile-name-input').value = userName;
    document.getElementById('profile-avatar-img').src = userAvatar;
    document.getElementById('stat-coins').innerText = globalCoins;
    document.getElementById('stat-time').innerText = formatTime(bestTime);
}

document.getElementById('btn-profile').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    updateProfileUI();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('profile-screen').classList.add('visible');
});

document.getElementById('btn-profile-back').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    document.getElementById('profile-screen').classList.remove('visible');
    const menu = document.getElementById('main-menu');
    menu.style.display = 'flex';
});

document.getElementById('btn-edit-avatar').addEventListener('click', () => {
    document.getElementById('avatar-upload').click();
});

document.getElementById('avatar-upload').addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            userAvatar = e.target.result;
            localStorage.setItem('userAvatar', userAvatar);
            document.getElementById('profile-avatar-img').src = userAvatar;
        }
        reader.readAsDataURL(file);
    }
});

document.getElementById('profile-name-input').addEventListener('input', function() {
    userName = this.value;
    localStorage.setItem('userName', userName);
});

document.getElementById('pause-btn').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pause-screen').classList.add('visible');
    }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

document.getElementById('btn-continue').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    gameState = 'playing';
    document.getElementById('pause-screen').classList.remove('visible');
});

document.getElementById('btn-restart-pause').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    restartGame();
});

let lastTime = 0;
let accumulator = 0;
const TICK_RATE = 1000 / 60; 

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let frameTime = timestamp - lastTime;
    if (frameTime > 100) frameTime = 100; 
    lastTime = timestamp;
    
    accumulator += frameTime;
    
    while (accumulator >= TICK_RATE) {
        update();
        accumulator -= TICK_RATE;
    }
    
    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
