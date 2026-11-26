import Phaser from 'phaser'
import { scene } from './model.mjs'

export function createRenderer(container, read, ready, rendered) {
  class CanvasWitness extends Phaser.Scene {
    create() {
      this.paint = this.add.graphics()
      this.game.events.on(Phaser.Core.Events.POST_RENDER, rendered)
      ready()
    }

    update() {
      const graphics = this.paint
      if (!graphics) return
      const state = read()
      const width = this.scale.width
      const height = this.scale.height
      const cell = Math.min(width / 25, height / 17)
      const toX = (x) => width / 2 + x * cell
      const toY = (z) => height / 2 + z * cell
      graphics.clear()
      graphics.fillStyle(0x344a57).fillRect(toX(-12), toY(-8), 24 * cell, 16 * cell)
      const drawBox = ({ x, z, w, d }, color, offset = 0) => {
        graphics.fillStyle(color).fillRoundedRect(toX(x - w / 2), toY(z - d / 2) + offset, w * cell, d * cell, 2)
      }
      for (const path of scene.paths) drawBox(path, 0x687584)
      for (const prop of [...scene.buildings, ...scene.obstacles]) {
        drawBox(prop, 0x263440, 4)
        drawBox(prop, Phaser.Display.Color.HexStringToColor(prop.color).color)
        graphics.lineStyle(1, 0x8a9ba6).strokeRect(toX(prop.x - prop.w / 2), toY(prop.z - prop.d / 2), prop.w * cell, prop.d * cell)
      }
      for (const [index, station] of scene.stations.entries()) {
        graphics.fillStyle(0x425d6b).fillCircle(toX(station.x), toY(station.z), cell * 0.73)
        graphics.lineStyle(2, index === state.active ? 0xffab88 : 0x85a8c2).strokeCircle(toX(station.x), toY(station.z), cell * 0.66)
      }
      const x = toX(state.x)
      const y = toY(state.z)
      const stride = state.walking && !state.reduced ? Math.sin(state.step) * cell * 0.1 : 0
      graphics.fillStyle(0x253342).fillEllipse(x, y + cell * 0.28, cell * 0.62, cell * 0.55)
      graphics.fillStyle(0x34475f).fillRoundedRect(x - cell * 0.23, y + stride, cell * 0.19, cell * 0.38, 2)
      graphics.fillRoundedRect(x + cell * 0.04, y - stride, cell * 0.19, cell * 0.38, 2)
      graphics.fillStyle(0x98485d).fillRoundedRect(x - cell * 0.30, y - cell * 0.19, cell * 0.6, cell * 0.37, 2)
      graphics.fillStyle(0xe4e5df).fillRoundedRect(x - cell * 0.10, y - cell * 0.19, cell * 0.20, cell * 0.37, 2)
      graphics.fillStyle(0x49353c).fillCircle(x, y - cell * 0.24, cell * 0.17)
      graphics.fillStyle(0xc08067).fillCircle(x + Math.sin(state.yaw) * cell * 0.11, y - cell * 0.23 + Math.cos(state.yaw) * cell * 0.11, cell * 0.09)
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS, parent: container, width: container.clientWidth, height: container.clientHeight,
    backgroundColor: '#536c85', banner: false, audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    callbacks: { postBoot: (instance) => instance.canvas.setAttribute('aria-hidden', 'true') },
    scene: CanvasWitness,
  })
  new ResizeObserver(() => {
    if (container.clientWidth > 0 && container.clientHeight > 0) game.scale.resize(container.clientWidth, container.clientHeight)
  }).observe(container)
}
