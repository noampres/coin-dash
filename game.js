/* global Phaser, COIN_DASH */
// Active theme comes from <html data-theme>, set from localStorage in index.html before anything draws.
COIN_DASH.theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const theme = () => COIN_DASH.themes[COIN_DASH.theme];

// Plain Audio rather than this.load.audio: Phaser's XHR loader fails when opened via file://.
const coinSound = new Audio('assets/coin.wav');
function playCoinSound() {
  coinSound.currentTime = 0;
  coinSound.play().catch(() => {});
}

// Personal best survives restarts and reloads; falls back to 0 when storage is unavailable.
let bestScore = 0;
try { bestScore = Number(localStorage.getItem('coinDashBest')) || 0; } catch (e) { /* storage unavailable */ }
function saveBest(score) {
  bestScore = score;
  try { localStorage.setItem('coinDashBest', String(score)); } catch (e) { /* storage unavailable */ }
}
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH, t = theme();
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.overlay = this.overlayText = null;
    this.grid = this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      t.background, 1, t.grid, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: t.hud });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, t.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, t.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    // Bonus coin: a star that shows up briefly and adds a second to the clock.
    this.bonus = this.add.star(0, 0, 5, 6, 13, t.bonus).setVisible(false);
    this.physics.add.existing(this.bonus);
    this.bonus.body.setCircle(13);
    this.bonus.body.enable = false;
    this.scheduleBonus();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, t.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      playCoinSound();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.bonus, () => {
      if (this.finished || !this.bonus.visible) return;
      this.deadline += 1000;
      this.showBonusText(this.bonus.x, this.bonus.y);
      this.hideBonus();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-T', toggleTheme);
  }

  applyTheme() {
    const t = theme();
    this.game.config.backgroundColor.setFromRGB(Phaser.Display.Color.IntegerToRGB(t.background));
    this.grid.setFillStyle(t.background, 1).setOutlineStyle(t.grid, 0.45);
    this.hud.setColor(t.hud);
    this.player.setFillStyle(t.player);
    this.coin.setFillStyle(t.coin);
    this.bonus.setFillStyle(t.bonus);
    this.drones.getChildren().forEach(drone => drone.setFillStyle(t.drone));
    if (this.overlay) {
      this.overlay.setFillStyle(t.overlay, 0.95);
      this.overlayText.setColor(t.overlayText);
    }
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  scheduleBonus() {
    this.time.delayedCall(Phaser.Math.Between(6000, 10000), () => this.spawnBonus());
  }

  spawnBonus() {
    if (this.finished) return;
    const c = COIN_DASH;
    // Keep the bonus well away from the player so it takes some effort to reach.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 180);
    this.bonus.setPosition(x, y).setVisible(true);
    this.bonus.body.enable = true;
    this.bonus.body.reset(x, y);
    this.bonusTimer = this.time.delayedCall(2000, () => this.hideBonus());
  }

  hideBonus() {
    if (!this.bonus.visible) return;
    this.bonusTimer.remove();
    this.bonus.setVisible(false);
    this.bonus.body.enable = false;
    this.scheduleBonus();
  }

  showBonusText(x, y) {
    const color = '#' + theme().bonus.toString(16).padStart(6, '0');
    const label = this.add.text(x, y - 16, '+1s', { font: 'bold 20px monospace', color }).setOrigin(0.5);
    this.tweens.add({ targets: label, y: y - 46, alpha: 0, duration: 700, onComplete: () => label.destroy() });
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}          Best: ${bestScore}          Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const newBest = this.score > bestScore;
    if (newBest) saveBest(this.score);
    const c = COIN_DASH, t = theme();
    this.overlay = this.add.rectangle(c.width / 2, c.height / 2, 460, 190, t.overlay, 0.95);
    this.overlayText = this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\n${newBest ? 'New best!' : `Best: ${bestScore}`}\nPress R to try again`,
      { font: '24px monospace', color: t.overlayText, align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: theme().background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});

// Button and T key share this path; it recolours the running scene in place.
function setTheme(name) {
  COIN_DASH.theme = name;
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem('coinDashTheme', name); } catch (e) { /* storage unavailable */ }
  const button = document.getElementById('theme-toggle');
  if (button) {
    button.textContent = name === 'dark' ? '☀️' : '🌙';
    button.setAttribute('aria-label', `Switch to ${name === 'dark' ? 'light' : 'dark'} theme`);
  }
  const scene = window.coinDashGame.scene.getScene('CoinDash');
  if (scene && scene.grid) scene.applyTheme();
}
function toggleTheme() { setTheme(COIN_DASH.theme === 'dark' ? 'light' : 'dark'); }
document.getElementById('theme-toggle').addEventListener('click', event => {
  toggleTheme();
  event.currentTarget.blur();
});
setTheme(COIN_DASH.theme);
