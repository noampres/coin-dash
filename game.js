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
    this.drones.getChildren().forEach(drone => drone.setFillStyle(t.drone));
    this.bonus.setFillStyle(t.bonus);
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

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH, t = theme();
    this.overlay = this.add.rectangle(c.width / 2, c.height / 2, 460, 150, t.overlay, 0.95);
    this.overlayText = this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
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
