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
    this.createBonus();
    // Time bonus: a star that shows up briefly and adds a second to the clock.
    this.timeBonus = this.add.star(0, 0, 5, 6, 13, t.timeBonus).setVisible(false);
    this.physics.add.existing(this.timeBonus);
    this.timeBonus.body.setCircle(13);
    this.timeBonus.body.enable = false;
    this.scheduleTimeBonus();
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
    this.physics.add.overlap(this.player, this.timeBonus, () => {
      if (this.finished || !this.timeBonus.visible) return;
      this.deadline += 1000;
      this.showTimeBonusText(this.timeBonus.x, this.timeBonus.y);
      this.hideTimeBonus();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.time.now >= this.frozenUntil) this.finish('A drone caught you!');
    });
    this.createHunter();
    this.createFreeze();
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
    this.drones.getChildren().forEach(drone => drone.setFillStyle(this.savedVelocities ? t.freeze : t.drone));
    this.hunter.setFillStyle(t.hunter);
    this.bonus.setFillStyle(t.bonus);
    this.freeze.setFillStyle(t.freeze);
    this.freezeText.setColor(t.freezeText);
    this.timeBonus.setFillStyle(t.timeBonus);
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

  createBonus() {
    // Violet diamond worth extra points; appears now and then, vanishes after bonusLifetime.
    this.bonus = this.add.rectangle(0, 0, 16, 16, theme().bonus).setAngle(45);
    this.physics.add.existing(this.bonus);
    this.bonusTimers = [];
    this.hideBonus();
    this.physics.add.overlap(this.player, this.bonus, () => {
      if (this.finished || !this.bonus.active) return;
      this.score += COIN_DASH.bonusValue;
      playCoinSound();
      this.hideBonus();
    });
  }

  hideBonus() {
    // Hide the gem, disable its body and schedule the next one.
    this.bonusTimers.forEach(t => t.remove());
    this.tweens.killTweensOf(this.bonus);
    this.bonus.setActive(false).setVisible(false).setAlpha(1);
    this.bonus.body.enable = false;
    if (this.finished) return;
    const c = COIN_DASH;
    this.bonusTimers = [this.time.delayedCall(
      Phaser.Math.Between(c.bonusDelayMin, c.bonusDelayMax), () => this.spawnBonus())];
  }

  spawnBonus() {
    if (this.finished) return;
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60
      || Phaser.Math.Distance.Between(x, y, this.coin.x, this.coin.y) < 30);
    this.bonus.setPosition(x, y).setActive(true).setVisible(true);
    this.bonus.body.enable = true;
    this.bonus.body.reset(x, y);
    // Blink during the last second, then vanish.
    this.bonusTimers = [
      this.time.delayedCall(Math.max(0, c.bonusLifetime - 1000), () => {
        if (!this.finished) this.tweens.add({ targets: this.bonus, alpha: 0.2, duration: 125, yoyo: true, repeat: 3 });
      }),
      this.time.delayedCall(c.bonusLifetime, () => { if (!this.finished) this.hideBonus(); })
    ];
  }

  scheduleTimeBonus() {
    this.time.delayedCall(Phaser.Math.Between(6000, 10000), () => this.spawnTimeBonus());
  }

  spawnTimeBonus() {
    if (this.finished) return;
    const c = COIN_DASH;
    // Keep the star well away from the player, and off any gem or freeze pickup on screen.
    const near = (item, x, y) => item.visible && Phaser.Math.Distance.Between(x, y, item.x, item.y) < 40;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 180
      || near(this.bonus, x, y) || near(this.freeze, x, y));
    this.timeBonus.setPosition(x, y).setVisible(true);
    this.timeBonus.body.enable = true;
    this.timeBonus.body.reset(x, y);
    this.timeBonusTimer = this.time.delayedCall(2000, () => this.hideTimeBonus());
  }

  hideTimeBonus() {
    if (!this.timeBonus.visible) return;
    this.timeBonusTimer.remove();
    this.timeBonus.setVisible(false);
    this.timeBonus.body.enable = false;
    this.scheduleTimeBonus();
  }

  showTimeBonusText(x, y) {
    const color = '#' + theme().timeBonus.toString(16).padStart(6, '0');
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
    this.updateHunter();
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}          Best: ${bestScore}          Time: ${seconds}s`);
    this.updateFreeze();
    if (seconds === 0) this.finish('Time is up!');
  }

  createHunter() {
    const c = COIN_DASH;
    // Spawn the hunter well away from the player, initially heading towards them.
    let x, y;
    do {
      x = Phaser.Math.Between(40, c.width - 40);
      y = Phaser.Math.Between(80, c.height - 40);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 280);
    this.hunter = this.add.triangle(x, y, 0, 28, 14, 0, 28, 28, theme().hunter);
    this.physics.add.existing(this.hunter);
    this.hunter.body.setCircle(10, 4, 4).setCollideWorldBounds(true);
    this.hunterHeading = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    this.physics.add.overlap(this.player, this.hunter, () => this.finish('The hunter caught you!'));
  }

  updateHunter() {
    const c = COIN_DASH;
    const body = this.hunter.body;
    // Freeze power-up convention: frozenUntil is a time comparable to this.time.now.
    if (this.frozenUntil && this.time.now < this.frozenUntil) {
      body.setVelocity(0, 0);
      return;
    }
    // Aim slightly ahead of the player, but turn towards it at a limited rate.
    const v = this.player.body.velocity;
    const goal = Phaser.Math.Angle.Between(this.hunter.x, this.hunter.y,
      this.player.x + v.x * c.hunterLead, this.player.y + v.y * c.hunterLead);
    const step = c.hunterTurnRate * this.game.loop.delta / 1000;
    this.hunterHeading = Phaser.Math.Angle.Wrap(
      Phaser.Math.Angle.RotateTo(this.hunterHeading, goal, step));
    this.physics.velocityFromRotation(this.hunterHeading, c.hunterSpeed, body.velocity);
    this.hunter.setRotation(this.hunterHeading + Math.PI / 2);
  }

  createFreeze() {
    const c = COIN_DASH;
    // Shared convention: drones (and other enemies) stop while time.now < frozenUntil.
    this.frozenUntil = 0;
    this.savedVelocities = null;
    this.freeze = this.add.star(0, 0, 6, 6, 12, theme().freeze);
    this.physics.add.existing(this.freeze);
    this.freeze.body.setCircle(12);
    this.hideFreeze();
    this.freezeText = this.add.text(c.width - 18, 12, '',
      { font: '18px monospace', color: theme().freezeText }).setOrigin(1, 0);
    this.physics.add.overlap(this.player, this.freeze, () => this.collectFreeze());
  }

  hideFreeze() {
    // A hidden pickup has its body disabled so it cannot be collected.
    this.freeze.setVisible(false);
    this.freeze.body.enable = false;
    this.nextFreezeAt = this.time.now + COIN_DASH.freezeInterval;
  }

  showFreeze() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 150);
    this.freeze.setPosition(x, y).setVisible(true);
    this.freeze.body.enable = true;
    this.freeze.body.reset(x, y);
    this.freezeExpiresAt = this.time.now + c.freezeLifetime;
  }

  collectFreeze() {
    if (this.finished || !this.freeze.visible) return;
    this.hideFreeze();
    // Save velocities only on the first pickup so a second one just extends the freeze.
    if (!this.savedVelocities) {
      this.savedVelocities = this.drones.getChildren().map((drone) => {
        const saved = { drone, x: drone.body.velocity.x, y: drone.body.velocity.y };
        drone.body.setVelocity(0, 0);
        drone.setFillStyle(theme().freeze);
        return saved;
      });
    }
    this.frozenUntil = this.time.now + COIN_DASH.freezeDuration;
  }

  updateFreeze() {
    const now = this.time.now;
    if (!this.freeze.visible && now >= this.nextFreezeAt) this.showFreeze();
    else if (this.freeze.visible && now >= this.freezeExpiresAt) this.hideFreeze();
    if (this.savedVelocities && now >= this.frozenUntil) {
      for (const { drone, x, y } of this.savedVelocities) {
        drone.body.setVelocity(x, y);
        drone.setFillStyle(theme().drone);
      }
      this.savedVelocities = null;
    }
    const left = Math.ceil((this.frozenUntil - now) / 1000);
    this.freezeText.setText(this.savedVelocities ? `Freeze: ${left}s` : '');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    // Clear every pickup so nothing lingers behind the end-of-round box.
    this.hideBonus();
    this.hideFreeze();
    this.timeBonus.setVisible(false);
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
