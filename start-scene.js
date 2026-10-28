/* global Phaser, COIN_DASH */
const BACKGROUND_IMAGE_KEY = 'playerBackground';

// Adds the player's picture behind the grid, or returns null when the game was started without one.
// The picture is scaled to cover the play field and cropped to its centre. It never leaves the browser.
function addBackgroundImage(scene) {
  if (!scene.textures.exists(BACKGROUND_IMAGE_KEY)) return null;
  const c = COIN_DASH;
  const source = scene.textures.get(BACKGROUND_IMAGE_KEY).getSourceImage();
  const scale = Math.max(c.width / source.width, c.height / source.height);
  const cropW = c.width / scale, cropH = c.height / scale;
  // Depth -1 keeps it under the grid, so the grid lines stay visible on top of it.
  return scene.add.image(c.width / 2, c.height / 2, BACKGROUND_IMAGE_KEY)
    .setCrop((source.width - cropW) / 2, (source.height - cropH) / 2, cropW, cropH)
    .setScale(scale).setDepth(-1);
}

class StartScene extends Phaser.Scene {
  constructor() { super('StartScene'); }

  create() {
    const c = COIN_DASH;
    const cx = c.width / 2;
    this.add.text(cx, 80, 'Coin Dash', { font: '48px monospace', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(cx, 140, 'Optional: play on top of your own picture', { font: '18px monospace', color: '#71e8ce' }).setOrigin(0.5);
    this.fileName = this.add.text(cx, 290, 'No image chosen', { font: '18px monospace', color: '#ffffff' }).setOrigin(0.5);
    // A hidden file input does the picking; the visible button just opens it.
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => this.loadChosenFile(this.fileInput.files[0]));
    document.body.appendChild(this.fileInput);
    this.events.once('shutdown', () => this.fileInput.remove());
    this.button(cx, 225, 'Choose image', () => this.fileInput.click());
    this.startButton = this.button(cx, 340, 'Start', () => this.scene.start('CoinDash'));
    this.setStartEnabled(false);
    this.button(cx, 425, 'Skip / play without image', () => this.skip());
  }

  button(x, y, label, onClick) {
    const bg = this.add.rectangle(0, 0, 300, 46, 0x1c2b44).setStrokeStyle(2, 0x34445e);
    const text = this.add.text(0, 0, label, { font: '20px monospace', color: '#ffffff' }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, text]).setSize(300, 46);
    button.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    return button;
  }

  setStartEnabled(on) {
    if (on) this.startButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    else this.startButton.disableInteractive().setAlpha(0.4);
  }

  loadChosenFile(file) {
    if (!file) return;
    this.setStartEnabled(false);
    this.fileName.setText(`Loading ${file.name}...`);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Replace any earlier choice; the game reads the texture when it starts.
      if (this.textures.exists(BACKGROUND_IMAGE_KEY)) this.textures.remove(BACKGROUND_IMAGE_KEY);
      this.textures.addImage(BACKGROUND_IMAGE_KEY, img);
      this.fileName.setText(file.name);
      this.setStartEnabled(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.fileName.setText('Could not read that file. Choose another or skip.');
    };
    img.src = url;
  }

  skip() {
    // Drop any picture chosen earlier so the game starts exactly as before.
    if (this.textures.exists(BACKGROUND_IMAGE_KEY)) this.textures.remove(BACKGROUND_IMAGE_KEY);
    this.scene.start('CoinDash');
  }
}
