import Phaser from 'phaser'
import type { StageId } from '../domain/mission'
import { antoineAtlas, campusArt } from './art'
import { facing, movement, nearbyStation, size, stations, walk } from './campus'
import type { Direction, Position } from './campus'

export interface CampusOptions {
  host: HTMLElement
  initialPosition: Position
  directions: Set<Direction>
  getProgress: () => readonly StageId[]
  getReducedMotion: () => boolean
  onPosition: (position: Position) => void
  onSettled: () => void
  onNearby: (stage: StageId | null) => void
  onFrame: (delta: number, spriteFrame: string) => void
  onReady: () => void
  onError: () => void
}

const atlasRows: readonly Direction[] = ['down', 'left', 'right', 'up']

export function createCampus(options: CampusOptions): () => void {
  let position = { ...options.initialPosition }
  let direction: Direction = 'down'
  let wasMoving = false
  let nearby: StageId | null = null
  let previousProgress: readonly StageId[] | undefined

  class CampusScene extends Phaser.Scene {
    private player?: Phaser.GameObjects.Sprite
    private shadow?: Phaser.GameObjects.Ellipse
    private markers?: Phaser.GameObjects.Graphics
    private labels: Phaser.GameObjects.Text[] = []
    private failed = false

    preload() {
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
        this.failed = true
        options.onError()
      })
      this.load.image('campus', campusArt)
      this.load.spritesheet('antoine', antoineAtlas, { frameWidth: 40, frameHeight: 64 })
    }

    create() {
      if (this.failed) return
      this.add.image(0, 0, 'campus').setOrigin(0)
      this.markers = this.add.graphics()
      this.labels = stations.map((station) => this.add.text(station.x, station.y - 31, station.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f9f7ff',
        backgroundColor: '#141b29',
        padding: { x: 8, y: 5 },
      }).setOrigin(0.5))
      this.shadow = this.add.ellipse(position.x, position.y + 1, 28, 10, 0x080c16, 0.58).setDepth(3)
      this.player = this.add.sprite(position.x, position.y, 'antoine', 0).setOrigin(0.5, 63 / 64).setDepth(4)

      atlasRows.forEach((row, index) => {
        const first = index * 4
        this.anims.create({
          key: row,
          frames: this.anims.generateFrameNumbers('antoine', { start: first, end: first + 3 }),
          frameRate: 9,
          repeat: -1,
        })
      })
      this.paintMarkers()
      this.refreshNearby()
      const canvas = this.game.canvas
      canvas.setAttribute('aria-hidden', 'true')
      options.onReady()
    }

    update(_time: number, delta: number) {
      if (!this.player || !this.shadow) return
      this.paintMarkers()

      const vector = movement(options.directions)
      const next = walk(position, vector, delta)
      const moving = next.x !== position.x || next.y !== position.y
      if (moving) {
        position = next
        direction = facing(vector)
        this.player.setPosition(position.x, position.y)
        this.shadow.setPosition(position.x, position.y + 1)
        options.onPosition(position)
        this.refreshNearby()
      }

      if (moving && !options.getReducedMotion()) {
        this.player.play(direction, true)
      } else {
        this.player.stop().setFrame(atlasRows.indexOf(direction) * 4)
      }
      options.onFrame(delta, String(this.player.frame.name))
      if (wasMoving && !moving) options.onSettled()
      wasMoving = moving
    }

    private refreshNearby() {
      const current = nearbyStation(position)
      if (current === nearby) return
      nearby = current
      options.onNearby(nearby)
    }

    private paintMarkers() {
      const progress = options.getProgress()
      if (!this.markers || progress === previousProgress) return
      previousProgress = progress
      this.markers.clear()
      stations.forEach((station, index) => {
        const active = index === progress.length
        const reached = index < progress.length
        const color = active ? 0xffad91 : reached ? 0x83ddbb : 0x94a6ca
        this.markers?.fillStyle(0x101826, 0.9).fillCircle(station.x, station.y, active ? 15 : 11)
        this.markers?.lineStyle(active ? 3 : 2, color, 1).strokeCircle(station.x, station.y, active ? 15 : 11)
        this.markers?.fillStyle(color, 1).fillCircle(station.x, station.y, active ? 5 : 3)
        this.labels[index]?.setColor(active ? '#ffd4c4' : reached ? '#a1edce' : '#e1e9fb')
      })
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: options.host,
    width: size.width,
    height: size.height,
    backgroundColor: '#101827',
    banner: false,
    loader: { imageLoadType: 'HTMLImageElement' },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scene: CampusScene,
  })

  return () => game.destroy(true)
}
