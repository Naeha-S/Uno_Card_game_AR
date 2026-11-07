import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import { InteractorEvent } from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import animate from "SpectaclesInteractionKit.lspkg/Utils/animate"

const CARD_FONT = requireAsset("../Fonts/Funnel Display.ttf") as Font

type CardData = {
  id: number
  color: string
  value: string
  wild: boolean
  root: SceneObject
  visual: RenderMeshVisual
  label: Text3D
  interactable: Interactable
  manipulation: InteractableManipulation
  selected: boolean
}

@component
export class SharedTableCards extends BaseScriptComponent {
  @input display!: Text3D
  @input cameraObject!: SceneObject
  @input cardMesh!: RenderMesh
  @input redMaterial!: Material
  @input blueMaterial!: Material
  @input greenMaterial!: Material
  @input yellowMaterial!: Material
  @input wildMaterial!: Material
  @input textMaterial!: Material
  @input cardInkMaterial!: Material
  @input cardOvalMesh!: RenderMesh
  @input cardOvalMaterial!: Material
  @input cardBackMaterial!: Material
  @input cardShadowMaterial!: Material
  @input tableBackdropMaterial!: Material

  private hand: CardData[] = []
  private opponentHand: string[] = []
  private opponentBacks: SceneObject[] = []
  private runtimeRoots: SceneObject[] = []
  private drawPile: string[] = []
  private randomSeed = 1
  private firstOpponentResponse = true
  private pendingWildDraw = 0
  private nextCardId = 0
  private activeColor = "BLUE"
  private topCard = "BLUE 7"
  private state = "YOUR TURN"
  private selectedId = -1
  private drawInProgress = false
  private wildPending = false
  private drawCards = 0
  private drawTarget = 4
  private pilePosition = new vec3(0, -3, -82)
  private wheelObjects: SceneObject[] = []
  private pileVisual: RenderMeshVisual | null = null
  private pileRoot: SceneObject | null = null
  private cameraComponent: Camera | null = null
  private activeColorVisual: RenderMeshVisual | null = null
  private pileLabel: Text3D | null = null
  private pileColorLabel: Text3D | null = null
  private statusLabel: Text3D | null = null
  private opponentLabel: Text3D | null = null
  private drawLabel: Text3D | null = null
  private drawCountLabel: Text3D | null = null
  private announcementLabel: Text3D | null = null
  private restartPrompt: SceneObject | null = null
  private drawDeckRoot: SceneObject | null = null
  private announcementToken = 0
  private lastCameraAspect = -1

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.startGame())
    this.createEvent("UpdateEvent").bind(() => this.onLayoutUpdate())
  }

  private startGame(): void {
    if (this.cameraObject) {
      this.cameraComponent = this.cameraObject.getComponent("Component.Camera") as Camera
      this.getSceneObject().setParentPreserveWorldTransform(this.cameraObject)
      this.lastCameraAspect = this.cameraComponent ? this.cameraComponent.aspect : -1
    }
    this.hand = []
    this.randomSeed = (((Date.now() >>> 0) ^ Math.floor(Math.random() * 0x100000000)) >>> 0) || 1
    this.activeColor = "BLUE"
    this.topCard = "BLUE 7"
    this.state = "YOUR TURN"
    this.drawInProgress = false
    this.wildPending = false
    this.drawCards = 0
    this.firstOpponentResponse = true
    this.pendingWildDraw = 0
    this.resetDrawPile()
    const initial: string[] = []
    this.opponentHand = []
    for (let i = 0; i < 7; i++) initial.push(this.drawFromDeck())
    for (let i = 0; i < 7; i++) this.opponentHand.push(this.drawFromDeck())
    const openingCardIndex = this.drawPile.findIndex((text) => {
      const value = text.split(" ").slice(1).join(" ")
      return value.length === 1 && value >= "0" && value <= "9"
    })
    if (openingCardIndex >= 0) {
      this.topCard = this.drawPile.splice(openingCardIndex, 1)[0]
      this.activeColor = this.topCard.split(" ")[0]
    }
    this.createTableDisplay()
    this.updateDiscardFace(this.topCard)
    for (const text of initial) this.hand.push(this.createCard(text, false))
    this.layoutHand(false)
    this.refresh()
    this.emitState()
    console.log("[SharedTableCards] game started hand=" + this.hand.length + " active=" + this.activeColor)
    console.log("[SharedTableCards] opening hand=" + initial.join(", "))
  }

  private createFollowObject(name: string): SceneObject {
    const object = global.scene.createSceneObject(name)
    if (this.cameraObject) object.setParentPreserveWorldTransform(this.cameraObject)
    this.runtimeRoots.push(object)
    return object
  }

  private onLayoutUpdate(): void {
    if (!this.cameraComponent || this.wildPending || this.drawInProgress) return
    const aspect = this.cameraComponent.aspect
    if (Math.abs(aspect - this.lastCameraAspect) > 0.01) {
      this.lastCameraAspect = aspect
      this.layoutHand(true)
      const halfWidth = 82 * Math.tan(this.cameraComponent.fov * 0.5) * Math.max(0.35, aspect)
      const pileX = Math.min(0, -Math.max(8, Math.min(18, halfWidth * 0.42)))
      if (this.drawDeckRoot) this.drawDeckRoot.getTransform().setLocalPosition(new vec3(pileX - 13, -3, -82))
      if (this.pileRoot) {
        const current = this.pileRoot.getTransform().getLocalPosition()
        this.pileRoot.getTransform().setLocalPosition(new vec3(pileX, current.y, current.z))
        this.pilePosition = new vec3(pileX, current.y, current.z)
      }
      const opponentWidth = Math.min(1.65, Math.max(0.85, halfWidth / 11))
      for (let i = 0; i < this.opponentBacks.length; i++) {
        const offset = i - (this.opponentBacks.length - 1) / 2
        const transform = this.opponentBacks[i].getTransform()
        const current = transform.getLocalPosition()
        transform.setLocalPosition(new vec3(offset * opponentWidth, current.y, current.z))
      }
    }
  }

  private createTableDisplay(): void {
    if (this.pileVisual) return
    const backdrop = this.createFollowObject("Shared Table Dark Backdrop")
    backdrop.getTransform().setLocalPosition(new vec3(0, 0, -115))
    backdrop.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    backdrop.getTransform().setLocalScale(new vec3(280, 1, 340))
    const backdropVisual = backdrop.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    backdropVisual.mesh = this.cardMesh
    backdropVisual.mainMaterial = this.tableBackdropMaterial
    const pile = this.createFollowObject("Shared Discard Pile")
    this.pileRoot = pile
    pile.getTransform().setLocalPosition(this.pilePosition)
    pile.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, -0.055))
    this.createShadow(pile, "Discard Pile Shadow", new vec3(3.1, 0.07, 4.7), new vec3(0.35, 0, -0.24))
    const pileFace = global.scene.createSceneObject("Discard Card Face")
    pileFace.setParent(pile)
    pileFace.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    pileFace.getTransform().setLocalScale(new vec3(4.35, 1, 6.5))
    this.pileVisual = pileFace.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.pileVisual.mesh = this.cardMesh
    this.pileVisual.mainMaterial = this.blueMaterial
    const discardOval = global.scene.createSceneObject("Discard Card Ivory Oval")
    discardOval.setParent(pile)
    discardOval.getTransform().setLocalPosition(new vec3(0, 0, 0.32))
    discardOval.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    discardOval.getTransform().setLocalScale(new vec3(1.75, 0.1, 2.55))
    const discardOvalVisual = discardOval.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    discardOvalVisual.mesh = this.cardOvalMesh
    discardOvalVisual.mainMaterial = this.cardOvalMaterial
    const pileLabelObject = global.scene.createSceneObject("Discard Pile Label")
    pileLabelObject.setParent(pile)
    this.pileLabel = pileLabelObject.createComponent("Component.Text3D") as Text3D
    this.pileLabel.mainMaterial = this.cardInkMaterial
    this.pileLabel.font = CARD_FONT
    this.pileLabel.text = "7"
    this.pileLabel.size = 74
    this.pileLabel.weight = 800
    this.pileLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const pileColorObject = global.scene.createSceneObject("Discard Card Color Label")
    pileColorObject.setParent(pile)
    this.pileColorLabel = pileColorObject.createComponent("Component.Text3D") as Text3D
    this.pileColorLabel.mainMaterial = this.textMaterial
    this.pileColorLabel.font = CARD_FONT
    this.pileColorLabel.text = "BLUE"
    this.pileColorLabel.size = 27
    this.pileColorLabel.weight = 800
    this.pileColorLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 2.35, 0.6))
    const drawDeck = this.createFollowObject("Draw Deck")
    this.drawDeckRoot = drawDeck
    drawDeck.getTransform().setLocalPosition(new vec3(-18, -3, -82))
    drawDeck.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, 0))
    const drawFace = global.scene.createSceneObject("Draw Deck Face")
    drawFace.setParent(drawDeck)
    this.createShadow(drawDeck, "Draw Deck Shadow", new vec3(4.6, 0.08, 6.3), new vec3(0.38, -0.28, -0.25))
    for (let layer = 3; layer >= 1; layer--) {
      const deckLayer = global.scene.createSceneObject("Draw Deck Stack Layer " + layer)
      deckLayer.setParent(drawDeck)
      deckLayer.getTransform().setLocalPosition(new vec3(-layer * 0.14, layer * 0.12, -layer * 0.08))
      deckLayer.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
      deckLayer.getTransform().setLocalScale(new vec3(8, 1, 11))
      const layerVisual = deckLayer.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      layerVisual.mesh = this.cardMesh
      layerVisual.mainMaterial = this.cardBackMaterial
    }
    drawFace.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    drawFace.getTransform().setLocalScale(new vec3(8, 1, 11))
    const drawVisual = drawFace.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    drawVisual.mesh = this.cardMesh
    drawVisual.mainMaterial = this.cardBackMaterial
    const drawOval = global.scene.createSceneObject("Draw Deck Ivory Emblem")
    drawOval.setParent(drawDeck)
    drawOval.getTransform().setLocalPosition(new vec3(0, 0, 0.32))
    drawOval.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    drawOval.getTransform().setLocalScale(new vec3(3.0, 0.1, 4.5))
    const drawOvalVisual = drawOval.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    drawOvalVisual.mesh = this.cardOvalMesh
    drawOvalVisual.mainMaterial = this.cardOvalMaterial
    const drawTextRoot = global.scene.createSceneObject("Draw Deck Label")
    drawTextRoot.setParent(drawDeck)
    drawTextRoot.getTransform().setLocalPosition(new vec3(0, 0, 0.65))
    this.drawLabel = drawTextRoot.createComponent("Component.Text3D") as Text3D
    this.drawLabel.mainMaterial = this.cardInkMaterial
    this.drawLabel.font = CARD_FONT
    this.drawLabel.text = "S"
    this.drawLabel.size = 104
    this.drawLabel.weight = 800
    this.drawLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.65))
    const drawTitleObject = global.scene.createSceneObject("Draw Deck Title")
    drawTitleObject.setParent(drawDeck)
    drawTitleObject.getTransform().setLocalPosition(new vec3(0, 4.2, 0.65))
    const drawTitle = drawTitleObject.createComponent("Component.Text3D") as Text3D
    drawTitle.mainMaterial = this.textMaterial
    drawTitle.font = CARD_FONT
    drawTitle.text = "DRAW"
    drawTitle.size = 30
    drawTitle.weight = 800
    const drawCountObject = global.scene.createSceneObject("Draw Deck Count")
    drawCountObject.setParent(drawDeck)
    drawCountObject.getTransform().setLocalPosition(new vec3(0, -3.25, 0.65))
    this.drawCountLabel = drawCountObject.createComponent("Component.Text3D") as Text3D
    this.drawCountLabel.mainMaterial = this.cardInkMaterial
    this.drawCountLabel.font = CARD_FONT
    this.drawCountLabel.size = 25
    this.drawCountLabel.weight = 800
    const drawCollider = drawDeck.createComponent("Physics.ColliderComponent") as ColliderComponent
    const drawBox = Shape.createBoxShape()
    drawBox.size = new vec3(8, 11, 2)
    drawCollider.shape = drawBox
    const drawInteractable = drawDeck.createComponent(Interactable.getTypeName()) as Interactable
    drawInteractable.targetingMode = 3
    drawInteractable.onTriggerStart.add(() => this.drawForPlayer())
    const statusObject = this.createFollowObject("Game Turn Indicator")
    statusObject.getTransform().setLocalPosition(new vec3(0, 18, -88))
    this.statusLabel = statusObject.createComponent("Component.Text3D") as Text3D
    this.statusLabel.mainMaterial = this.textMaterial
    this.statusLabel.font = CARD_FONT
    this.statusLabel.text = "YOUR TURN"
    this.statusLabel.size = 54
    this.statusLabel.weight = 700
    const opponentObject = this.createFollowObject("Opponent Status")
    opponentObject.getTransform().setLocalPosition(new vec3(0, 24, -88))
    this.opponentLabel = opponentObject.createComponent("Component.Text3D") as Text3D
    this.opponentLabel.mainMaterial = this.textMaterial
    this.opponentLabel.font = CARD_FONT
    this.opponentLabel.text = "OPPONENT  |  7 CARDS"
    this.opponentLabel.size = 40
    const activeColorObject = this.createFollowObject("Active Color Marker")
    activeColorObject.getTransform().setLocalPosition(new vec3(-9, 18, -88))
    activeColorObject.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    activeColorObject.getTransform().setLocalScale(new vec3(1.15, 0.18, 1.15))
    this.activeColorVisual = activeColorObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.activeColorVisual.mesh = this.cardOvalMesh
    this.activeColorVisual.mainMaterial = this.blueMaterial
    const announcementObject = this.createFollowObject("Game Announcement")
    announcementObject.getTransform().setLocalPosition(new vec3(0, 4, -78))
    this.announcementLabel = announcementObject.createComponent("Component.Text3D") as Text3D
    this.announcementLabel.mainMaterial = this.textMaterial
    this.announcementLabel.font = CARD_FONT
    this.announcementLabel.text = ""
    this.announcementLabel.size = 90
    this.announcementLabel.weight = 800
    announcementObject.enabled = false
    this.createOpponentCardArc()
    // Preserve the existing title display as a compact help/status line.
    if (this.display) {
      this.display.mainMaterial = this.textMaterial
      this.display.size = 40
      this.display.text = "SHARED TABLE"
      this.display.getSceneObject().getTransform().setLocalPosition(new vec3(0, 30, -88))
    }
  }

  private createOpponentCardArc(): void {
    this.opponentBacks = []
    const backCount = 13
    for (let i = 0; i < backCount; i++) {
      const offset = i - (backCount - 1) / 2
      const normalized = Math.abs(offset) / ((backCount - 1) / 2)
      const root = this.createFollowObject("Opponent Card Back " + (i + 1))
      root.getTransform().setLocalPosition(new vec3(offset * 1.65, 8 + normalized * normalized * 0.72, -99 + i * 0.012))
      root.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, -offset * 0.035))
      this.createShadow(root, "Opponent Card Back Shadow " + (i + 1), new vec3(2.5, 0.06, 3.8), new vec3(0.2, 0, -0.2))
      const face = global.scene.createSceneObject("Opponent Card Back Face " + (i + 1))
      face.setParent(root)
      face.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
      face.getTransform().setLocalScale(new vec3(4.3, 1, 6.5))
      const visual = face.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = this.cardMesh
      visual.mainMaterial = this.cardBackMaterial
      const oval = global.scene.createSceneObject("Opponent Card Back Emblem " + (i + 1))
      oval.setParent(root)
      oval.getTransform().setLocalPosition(new vec3(0, 0, 0.3))
      oval.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
      oval.getTransform().setLocalScale(new vec3(1.65, 0.08, 2.65))
      const ovalVisual = oval.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      ovalVisual.mesh = this.cardOvalMesh
      ovalVisual.mainMaterial = this.cardOvalMaterial
      const markObject = global.scene.createSceneObject("Opponent Card Back Mark " + (i + 1))
      markObject.setParent(root)
      markObject.getTransform().setLocalPosition(new vec3(0, 0, 0.52))
      const mark = markObject.createComponent("Component.Text3D") as Text3D
      mark.mainMaterial = this.cardInkMaterial
      mark.font = CARD_FONT
      mark.text = "S"
      mark.size = 46
      mark.weight = 800
      this.opponentBacks.push(root)
    }
  }

  private createShadow(parent: SceneObject, name: string, scale: vec3, position: vec3): void {
    const shadow = global.scene.createSceneObject(name)
    shadow.setParent(parent)
    shadow.getTransform().setLocalPosition(position)
    shadow.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    shadow.getTransform().setLocalScale(scale)
    const shadowVisual = shadow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    shadowVisual.mesh = this.cardOvalMesh
    shadowVisual.mainMaterial = this.cardShadowMaterial
  }

  private createCard(text: string, animateIn: boolean): CardData {
    const parts = text.split(" ")
    const wild = parts[0] === "WILD"
    const color = wild ? "WILD" : parts[0]
    const value = parts.slice(1).join(" ")
    const root = this.createFollowObject("Player Card " + (this.nextCardId + 1))
    root.getTransform().setLocalPosition(animateIn ? this.pilePosition : new vec3(0, -22, -88))
    this.createShadow(root, "Card Shadow " + (this.nextCardId + 1), new vec3(3.7, 0.08, 5.4), new vec3(0.28, -0.22, -0.22))
    const cardFace = global.scene.createSceneObject("Card Back " + (this.nextCardId + 1))
    cardFace.setParent(root)
    cardFace.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    cardFace.getTransform().setLocalScale(new vec3(6.2, 1, 9.3))
    const visual = cardFace.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = this.cardMesh
    visual.mainMaterial = this.materialFor(color)
    const oval = global.scene.createSceneObject("Card Oval " + (this.nextCardId + 1))
    oval.setParent(root)
    oval.getTransform().setLocalPosition(new vec3(0, 0, 0.32))
    oval.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    oval.getTransform().setLocalScale(new vec3(2.45, 0.1, 3.65))
    const ovalVisual = oval.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    ovalVisual.mesh = this.cardOvalMesh
    ovalVisual.mainMaterial = this.cardOvalMaterial
    const labelObject = global.scene.createSceneObject("Card Face " + (this.nextCardId + 1))
    labelObject.setParent(root)
    labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.58))
    const label = labelObject.createComponent("Component.Text3D") as Text3D
    label.mainMaterial = this.cardInkMaterial
    label.font = CARD_FONT
    label.text = value === "WILD" ? "WILD" : value === "REVERSE" ? "REV" : value
    label.size = value.length > 4 ? 48 : value.length > 2 ? 62 : 104
    label.weight = 800
    label.horizontalOverflow = HorizontalOverflow.Shrink
    const cornerValue = value === "WILD" ? "*" : value === "REVERSE" ? "R" : value
    const upperCorner = global.scene.createSceneObject("Card Upper Mark " + (this.nextCardId + 1))
    upperCorner.setParent(root)
    upperCorner.getTransform().setLocalPosition(new vec3(-2.15, 3.35, 0.56))
    const upperMark = upperCorner.createComponent("Component.Text3D") as Text3D
    upperMark.mainMaterial = this.textMaterial
    upperMark.font = CARD_FONT
    upperMark.text = cornerValue
    upperMark.size = 28
    upperMark.weight = 800
    const lowerCorner = global.scene.createSceneObject("Card Lower Mark " + (this.nextCardId + 1))
    lowerCorner.setParent(root)
    lowerCorner.getTransform().setLocalPosition(new vec3(2.15, -3.35, 0.56))
    lowerCorner.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, Math.PI))
    const lowerMark = lowerCorner.createComponent("Component.Text3D") as Text3D
    lowerMark.mainMaterial = this.textMaterial
    lowerMark.font = CARD_FONT
    lowerMark.text = cornerValue
    lowerMark.size = 28
    lowerMark.weight = 800

    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(6.2, 9.3, 2)
    collider.shape = box
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = 3
    const manipulation = root.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    manipulation.enabled = true
    const card: CardData = { id: this.nextCardId++, color, value, wild, root, visual, label, interactable, manipulation, selected: false }
    // These components are created after the controller's OnStart event. Their
    // onAwake lifecycle runs inline, so subscribe immediately after creation.
    interactable.onTriggerStart.add((_event: InteractorEvent) => this.selectCard(card))
    interactable.onHoverEnter.add((_event: InteractorEvent) => this.setCardHover(card, true))
    interactable.onHoverExit.add((_event: InteractorEvent) => this.setCardHover(card, false))
    manipulation.onManipulationStart.add(() => this.beginDrag(card))
    manipulation.onManipulationEnd.add(() => this.endDrag(card))
    return card
  }

  private cardFace(color: string, value: string): string {
    const short = color === "YELLOW" ? "GOLD" : color
    if (color === "WILD") return "*\n" + (value === "WILD" ? "WILD" : value) + "\nCOLOR"
    const header = value === "+4" || value === "+2" ? "+" : "*"
    return header + "\n" + value + "\n" + short
  }

  private materialFor(color: string): Material {
    if (color === "RED") return this.redMaterial
    if (color === "GREEN") return this.greenMaterial
    if (color === "YELLOW") return this.yellowMaterial
    if (color === "WILD") return this.wildMaterial
    return this.blueMaterial
  }

  private updateDiscardFace(text: string): void {
    const parts = text.split(" ")
    const color = parts[0]
    const value = parts.slice(1).join(" ")
    // The normal discard face is the source of truth for the active color.
    // Wild cards keep the color chosen in the wild selector.
    if (color !== "WILD") this.activeColor = color
    if (this.pileVisual) this.pileVisual.mainMaterial = this.materialFor(color)
    if (this.pileLabel) {
      this.pileLabel.text = value === "REVERSE" ? "REV" : value
      this.pileLabel.size = value.length > 3 ? 42 : value.length > 1 ? 58 : 74
    }
    if (this.pileColorLabel) this.pileColorLabel.text = color === "WILD" ? "WILD" : color === "YELLOW" ? "GOLD" : color
  }

  private selectCard(card: CardData): void {
    if (!this.canPlayerPlay() || this.wildPending || this.drawInProgress) return
    this.selectedId = card.id
    this.setCardHover(card, true)
    if (this.statusLabel) this.statusLabel.text = "SELECTED  |  " + card.color + " " + card.value
    console.log("[SharedTableCards] selected " + card.color + " " + card.value)
    this.refresh()
  }

  private setCardHover(card: CardData, active: boolean): void {
    if (!card.root || !card.root.enabled) return
    card.selected = active || this.selectedId === card.id
    const scale = card.selected ? new vec3(1.1, 1.1, 1) : new vec3(1, 1, 1)
    card.root.getTransform().setWorldScale(scale)
  }

  private beginDrag(card: CardData): void {
    if (!this.canPlayerPlay() || this.wildPending || this.drawInProgress) {
      card.manipulation.enabled = false
      card.manipulation.enabled = true
      return
    }
    this.selectedId = card.id
    card.selected = true
    card.root.getTransform().setWorldScale(new vec3(1.16, 1.16, 1))
    console.log("[SharedTableCards] drag start " + card.color + " " + card.value)
    if (this.statusLabel) this.statusLabel.text = "DROP ON THE GLOWING PILE"
  }

  private endDrag(card: CardData): void {
    if (!this.canPlayerPlay() || this.wildPending || this.drawInProgress) return
    const position = card.root.getTransform().getWorldPosition()
    const pilePosition = this.pileRoot ? this.pileRoot.getTransform().getWorldPosition() : this.pilePosition
    const dx = position.x - pilePosition.x
    const dy = position.y - pilePosition.y
    const dz = position.z - pilePosition.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const droppedOnPile = distance < 16
    console.log("[SharedTableCards] drag end " + card.color + " " + card.value + " drop=" + droppedOnPile + " distance=" + distance.toFixed(1))
    if (!droppedOnPile) {
      this.returnCard(card, "CARD RETURNED | DROP ON THE PILE")
      return
    }
    const valid = this.isPlayable(card.color, card.value, card.wild)
    if (!valid) {
      console.log("[SharedTableCards] invalid play card=" + card.color + " " + card.value + " top=" + this.topCard + " shown=" + (this.pileColorLabel ? this.pileColorLabel.text : "?") + " " + (this.pileLabel ? this.pileLabel.text : "?") + " active=" + this.activeColor)
      this.returnCard(card, "INVALID PLAY | CARD RETURNED")
      return
    }
    this.commitCard(card)
  }

  private returnCard(card: CardData, message: string): void {
    this.state = message
    console.log("[SharedTableCards] rejected " + card.color + " " + card.value + " reason=" + message + " hand=" + this.hand.length)
    card.selected = false
    this.selectedId = -1
    this.layoutHand(true)
    this.refresh()
    const delayed = this.createEvent("DelayedCallbackEvent")
    delayed.bind(() => {
      if (this.state === message) this.state = "YOUR TURN"
      this.refresh()
    })
    delayed.reset(0.8)
  }

  private commitCard(card: CardData): void {
    const index = this.hand.findIndex((c) => c.id === card.id)
    if (index < 0) return
    this.setTopCard((card.wild ? "WILD" : card.color) + " " + card.value)
    console.log("[SharedTableCards] committed " + this.topCard + " hand=" + this.hand.length)
    this.updateDiscardFace(this.topCard)
    this.hand.splice(index, 1)
    card.root.destroy()
    this.selectedId = -1
    this.layoutHand(true)
    this.refresh()
    if (this.hand.length === 0 && !card.wild) {
      this.state = "YOU WIN"
      this.wildPending = false
      this.showAnnouncement("UNO! YOU WIN")
      this.createRestartPrompt("YOU WIN")
      this.refresh()
      return
    }
    if (this.hand.length === 1) this.showAnnouncement("UNO!")
    if (card.wild) {
      this.wildPending = true
      this.pendingWildDraw = card.value === "+4" ? 4 : 0
      this.state = "CHOOSE A COLOR"
      this.setHandEnabled(false)
      this.showColorWheel()
      this.refresh()
      return
    }
    if (card.value === "+2") {
      this.drawForOpponent(2)
      return
    }
    if (card.value === "SKIP" || card.value === "REVERSE") {
      // In a two-player game, skip/reverse gives the player another turn.
      this.state = "OPPONENT SKIPPED"
      this.setHandEnabled(false)
      this.refresh()
      const delayed = this.createEvent("DelayedCallbackEvent")
      delayed.bind(() => {
        this.state = "YOUR TURN"
        this.setHandEnabled(true)
        this.refresh()
      })
      delayed.reset(0.65)
      return
    }
    this.beginOpponentTurn()
  }

  private setHandEnabled(enabled: boolean): void {
    for (const card of this.hand) {
      card.interactable.enabled = enabled
      card.manipulation.enabled = enabled
    }
  }

  private showColorWheel(): void {
    const choices = ["RED", "BLUE", "GREEN", "YELLOW"]
    const wheelScale = this.getResponsiveScale(78, 22)
    const focus = this.createFollowObject("Wild Selector Focus Backdrop")
    focus.getTransform().setLocalPosition(new vec3(0, 0, -106))
    focus.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    focus.getTransform().setLocalScale(new vec3(21 * wheelScale, 0.24, 21 * wheelScale))
    const focusVisual = focus.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    focusVisual.mesh = this.cardOvalMesh
    focusVisual.mainMaterial = this.tableBackdropMaterial
    this.wheelObjects.push(focus)

    const center = this.createFollowObject("Wild Selector Center Card")
    center.getTransform().setLocalPosition(new vec3(0, 0, -77.6))
    center.getTransform().setLocalScale(new vec3(wheelScale, wheelScale, 1))
    const centerShadow = global.scene.createSceneObject("Wild Selector Center Shadow")
    centerShadow.setParent(center)
    centerShadow.getTransform().setLocalPosition(new vec3(0.25, -0.18, -0.18))
    centerShadow.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    centerShadow.getTransform().setLocalScale(new vec3(2.9, 0.08, 4.2))
    const centerShadowVisual = centerShadow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    centerShadowVisual.mesh = this.cardOvalMesh
    centerShadowVisual.mainMaterial = this.cardShadowMaterial
    const centerFace = global.scene.createSceneObject("Wild Selector Center Face")
    centerFace.setParent(center)
    centerFace.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    centerFace.getTransform().setLocalScale(new vec3(4.3, 1, 6.5))
    const centerFaceVisual = centerFace.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    centerFaceVisual.mesh = this.cardMesh
    centerFaceVisual.mainMaterial = this.wildMaterial
    const centerOval = global.scene.createSceneObject("Wild Selector Center Oval")
    centerOval.setParent(center)
    centerOval.getTransform().setLocalPosition(new vec3(0, 0, 0.34))
    centerOval.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    centerOval.getTransform().setLocalScale(new vec3(1.8, 0.1, 2.8))
    const centerOvalVisual = centerOval.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    centerOvalVisual.mesh = this.cardOvalMesh
    centerOvalVisual.mainMaterial = this.cardOvalMaterial
    const centerLabelObject = global.scene.createSceneObject("Wild Selector Center Label")
    centerLabelObject.setParent(center)
    centerLabelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.58))
    const centerLabel = centerLabelObject.createComponent("Component.Text3D") as Text3D
    centerLabel.mainMaterial = this.cardInkMaterial
    centerLabel.font = CARD_FONT
    centerLabel.text = "WILD"
    centerLabel.size = 46
    centerLabel.weight = 800
    this.wheelObjects.push(center)

    const radius = 15.5 * wheelScale
    const positions = [new vec3(0, radius, -78), new vec3(radius, 0, -78), new vec3(0, -radius, -78), new vec3(-radius, 0, -78)]
    const marks = ["R", "B", "G", "Y"]
    const labelPositions = [new vec3(0, 4.5, 0.52), new vec3(4.5, 0, 0.52), new vec3(0, -4.5, 0.52), new vec3(-4.5, 0, 0.52)]
    for (let i = 0; i < choices.length; i++) {
      const color = choices[i]
      const obj = this.createFollowObject("Choose " + color)
      obj.getTransform().setLocalPosition(positions[i])
      obj.getTransform().setLocalScale(new vec3(wheelScale, wheelScale, 1))
      const shadow = global.scene.createSceneObject("Color Button Shadow " + color)
      shadow.setParent(obj)
      shadow.getTransform().setLocalPosition(new vec3(0.14, -0.12, -0.2))
      shadow.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
      shadow.getTransform().setLocalScale(new vec3(9.5, 0.12, 9.5))
      const shadowVisual = shadow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      shadowVisual.mesh = this.cardOvalMesh
      shadowVisual.mainMaterial = this.cardShadowMaterial
      const button = global.scene.createSceneObject("Color Circle " + color)
      button.setParent(obj)
      button.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
      button.getTransform().setLocalScale(new vec3(8.8, 0.24, 8.8))
      const visual = button.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = this.cardOvalMesh
      visual.mainMaterial = this.materialFor(color)
      const markObject = global.scene.createSceneObject("Color Initial " + color)
      markObject.setParent(obj)
      markObject.getTransform().setLocalPosition(new vec3(0, 0, 0.45))
      const mark = markObject.createComponent("Component.Text3D") as Text3D
      mark.mainMaterial = color === "YELLOW" ? this.cardInkMaterial : this.textMaterial
      mark.font = CARD_FONT
      mark.text = marks[i]
      mark.size = 74
      mark.weight = 800
      const labelObject = global.scene.createSceneObject("Color Label " + color)
      labelObject.setParent(obj)
      labelObject.getTransform().setLocalPosition(labelPositions[i])
      const text = labelObject.createComponent("Component.Text3D") as Text3D
      text.mainMaterial = this.textMaterial
      text.font = CARD_FONT
      text.text = color
      text.size = 42
      text.weight = 800
      labelObject.enabled = false
      const collider = obj.createComponent("Physics.ColliderComponent") as ColliderComponent
      const box = Shape.createBoxShape()
      box.size = new vec3(11, 11, 2)
      collider.shape = box
      const interactable = obj.createComponent(Interactable.getTypeName()) as Interactable
      interactable.targetingMode = 3
      interactable.onTriggerStart.add(() => this.chooseColor(color))
      interactable.onHoverEnter.add(() => {
        obj.getTransform().setLocalScale(new vec3(wheelScale * 1.12, wheelScale * 1.12, 1))
        labelObject.enabled = true
      })
      interactable.onHoverExit.add(() => {
        obj.getTransform().setLocalScale(new vec3(wheelScale, wheelScale, 1))
        labelObject.enabled = false
      })
      this.wheelObjects.push(obj)
    }
  }

  private chooseColor(color: string): void {
    if (!this.wildPending || ["RED", "BLUE", "GREEN", "YELLOW"].indexOf(color) < 0) return
    this.activeColor = color
    console.log("[SharedTableCards] color chosen " + color)
    this.wildPending = false
    const closingObjects = this.wheelObjects.slice()
    this.wheelObjects = []
    for (const obj of closingObjects) {
      const transform = obj.getTransform()
      const start = transform.getWorldScale()
      animate({
        duration: 0.2,
        easing: "ease-in-quad",
        update: (t: number) => transform.setWorldScale(new vec3(start.x * (1 - t), start.y * (1 - t), start.z))
      })
    }
    const removeWheel = this.createEvent("DelayedCallbackEvent")
    removeWheel.bind(() => { for (const obj of closingObjects) obj.destroy() })
    removeWheel.reset(0.22)
    this.setHandEnabled(true)
    if (this.hand.length === 0) {
      this.pendingWildDraw = 0
      this.state = "YOU WIN"
      this.showAnnouncement("UNO! YOU WIN")
      this.createRestartPrompt("YOU WIN")
      this.refresh()
      return
    }
    if (this.pendingWildDraw > 0) {
      const count = this.pendingWildDraw
      this.pendingWildDraw = 0
      this.drawForOpponent(count)
    } else {
      this.beginOpponentTurn()
    }
  }

  private beginOpponentTurn(): void {
    this.state = "OPPONENT'S TURN"
    this.setHandEnabled(false)
    this.refresh()
    const delayed = this.createEvent("DelayedCallbackEvent")
    delayed.bind(() => this.resolveOpponentTurn())
    delayed.reset(1.5)
  }

  private resolveOpponentTurn(): void {
    const playable = this.opponentHand.filter((text) => this.isOpponentPlayLegal(text))
    let chosen = ""
    const openingOptions = this.firstOpponentResponse
      ? playable.filter((text) => text !== "WILD +4")
      : playable
    if (openingOptions.length > 0) {
      chosen = openingOptions[Math.floor(this.randomUnit() * openingOptions.length)]
    }

    if (!chosen) {
      const drawn = this.drawFromDeck()
      this.opponentHand.push(drawn)
      this.refresh()
      if (!this.isOpponentPlayLegal(drawn)) {
        this.state = "OPPONENT DRAWS 1"
        this.refresh()
        this.finishOpponentTurn()
        return
      }
      chosen = drawn
    }

    if (chosen) this.firstOpponentResponse = false

    this.animateOpponentPlay(chosen)
  }

  private animateOpponentPlay(chosen: string): void {
    const parts = chosen.split(" ")
    const color = parts[0]
    const value = parts.slice(1).join(" ")
    const visibleCount = Math.min(this.opponentBacks.length, this.opponentHand.length)
    const firstVisible = Math.floor((this.opponentBacks.length - visibleCount) / 2)
    const nextVisibleCount = Math.max(0, visibleCount - 1)
    const nextFirstVisible = Math.floor((this.opponentBacks.length - nextVisibleCount) / 2)
    const playedIndex = nextFirstVisible > firstVisible
      ? firstVisible
      : firstVisible + visibleCount - 1
    const source = this.opponentBacks[playedIndex]
    const sourceTransform = source ? source.getTransform() : null
    const start = sourceTransform ? sourceTransform.getLocalPosition() : new vec3(0, 8, -99)
    const playedCard = this.createFollowObject("Opponent Played Card")
    const transform = playedCard.getTransform()
    transform.setLocalPosition(start)
    const face = global.scene.createSceneObject("Opponent Played Card Face")
    face.setParent(playedCard)
    face.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    face.getTransform().setLocalScale(new vec3(4.3, 1, 6.5))
    const visual = face.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = this.cardMesh
    visual.mainMaterial = this.cardBackMaterial
    const oval = global.scene.createSceneObject("Opponent Played Card Oval")
    oval.setParent(playedCard)
    oval.getTransform().setLocalPosition(new vec3(0, 0, 0.32))
    oval.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    oval.getTransform().setLocalScale(new vec3(1.65, 0.08, 2.65))
    const ovalVisual = oval.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    ovalVisual.mesh = this.cardOvalMesh
    ovalVisual.mainMaterial = this.cardOvalMaterial
    const labelObject = global.scene.createSceneObject("Opponent Played Card Label")
    labelObject.setParent(playedCard)
    labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.58))
    const label = labelObject.createComponent("Component.Text3D") as Text3D
    label.mainMaterial = this.cardInkMaterial
    label.font = CARD_FONT
    label.text = "S"
    label.size = 58
    label.weight = 800
    label.horizontalOverflow = HorizontalOverflow.Shrink

    this.state = "OPPONENT PLAYS " + chosen
    this.refresh()
    if (source) source.enabled = false
    let revealed = false
    animate({
      duration: 0.72,
      easing: "ease-in-out-quad",
      update: (t: number) => {
        const target = this.pilePosition
        transform.setLocalPosition(new vec3(
          start.x + (target.x - start.x) * t,
          start.y + (target.y - start.y) * t + Math.sin(t * Math.PI) * 4.2,
          start.z + (target.z - start.z) * t
        ))
        const faceWidth = t < 0.5 ? 1 - 0.9 * (t * 2) : 0.1 + 0.9 * ((t - 0.5) * 2)
        transform.setLocalScale(new vec3(faceWidth, 1, 1))
        if (!revealed && t >= 0.5) {
          revealed = true
          visual.mainMaterial = this.materialFor(color)
          label.text = value === "REVERSE" ? "REV" : value
          label.size = value.length > 3 ? 42 : value.length > 1 ? 58 : 74
        }
      },
      ended: () => {
        playedCard.destroy()
        const handIndex = this.opponentHand.indexOf(chosen)
        if (handIndex >= 0) this.opponentHand.splice(handIndex, 1)
        const wildColor = color === "WILD" ? this.chooseOpponentColor() : undefined
        this.setTopCard(chosen, wildColor)
        console.log("[SharedTableCards] opponent played " + chosen + " active=" + this.activeColor + " opponentHand=" + this.opponentHand.length)
        if (this.opponentHand.length === 1) this.showAnnouncement("OPPONENT UNO!")

        if (this.opponentHand.length === 0) {
          this.state = "OPPONENT WINS"
          this.showAnnouncement("UNO! OPPONENT WINS")
          this.createRestartPrompt("OPPONENT WINS")
          this.refresh()
          return
        }
        if (value === "+4" || value === "+2") {
          this.drawTarget = value === "+4" ? 4 : 2
          this.state = value + " DRAW!"
          this.drawInProgress = true
          this.drawCards = 0
          this.refresh()
          this.drawOne()
          return
        }
        if (value === "SKIP" || value === "REVERSE") {
          this.state = "OPPONENT SKIPPED"
          this.refresh()
          const delayed = this.createEvent("DelayedCallbackEvent")
          delayed.bind(() => this.beginOpponentTurn())
          delayed.reset(0.65)
          return
        }
        this.finishOpponentTurn()
      }
    })
  }

  private isOpponentPlayLegal(text: string): boolean {
    const parts = text.split(" ")
    const color = parts[0]
    const value = parts.slice(1).join(" ")
    return this.isPlayable(color, value, color === "WILD")
  }

  private chooseOpponentColor(): string {
    const colors = ["RED", "BLUE", "GREEN", "YELLOW"]
    let best = "BLUE"
    let bestCount = -1
    for (const color of colors) {
      const count = this.opponentHand.filter((text) => text.indexOf(color + " ") === 0).length
      if (count > bestCount) { best = color; bestCount = count }
    }
    return best
  }

  private setTopCard(text: string, wildColor?: string): void {
    this.topCard = text
    const cardColor = text.split(" ")[0]
    if (cardColor === "WILD") {
      if (wildColor) this.activeColor = wildColor
    } else {
      this.activeColor = cardColor
    }
    this.updateDiscardFace(text)
  }

  private finishOpponentTurn(): void {
    this.setHandEnabled(false)
    const delayed = this.createEvent("DelayedCallbackEvent")
    delayed.bind(() => {
      this.drawInProgress = false
      this.drawCards = 0
      this.state = "YOUR TURN"
      this.setHandEnabled(true)
      this.refresh()
      this.emitState()
    })
    delayed.reset(0.75)
  }

  private showAnnouncement(message: string): void {
    if (!this.announcementLabel) return
    const token = ++this.announcementToken
    this.announcementLabel.text = message
    this.announcementLabel.getSceneObject().enabled = true
    const delayed = this.createEvent("DelayedCallbackEvent")
    delayed.bind(() => {
      if (token === this.announcementToken && this.announcementLabel) {
        this.announcementLabel.getSceneObject().enabled = false
      }
    })
    delayed.reset(1.5)
  }

  private createRestartPrompt(result: string): void {
    if (this.restartPrompt) return
    ++this.announcementToken
    if (this.announcementLabel) this.announcementLabel.getSceneObject().enabled = false
    const prompt = this.createFollowObject("Restart Game Prompt")
    this.restartPrompt = prompt
    prompt.getTransform().setLocalPosition(new vec3(0, 1.5, -76))
    const face = global.scene.createSceneObject("Restart Prompt Card")
    face.setParent(prompt)
    face.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    face.getTransform().setLocalScale(new vec3(14, 1, 9))
    const visual = face.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = this.cardMesh
    visual.mainMaterial = this.cardBackMaterial

    const titleObject = global.scene.createSceneObject("Restart Prompt Result")
    titleObject.setParent(prompt)
    titleObject.getTransform().setLocalPosition(new vec3(0, 2.3, 0.85))
    const title = titleObject.createComponent("Component.Text3D") as Text3D
    title.mainMaterial = this.textMaterial
    title.font = CARD_FONT
    title.text = result + "!"
    title.size = 52
    title.weight = 800

    const actionObject = global.scene.createSceneObject("Restart Prompt Action")
    actionObject.setParent(prompt)
    actionObject.getTransform().setLocalPosition(new vec3(0, -2.1, 0.85))
    const action = actionObject.createComponent("Component.Text3D") as Text3D
    action.mainMaterial = this.textMaterial
    action.font = CARD_FONT
    action.text = "TAP TO RESTART GAME"
    action.size = 34
    action.weight = 700

    const collider = prompt.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(15, 10, 3)
    collider.shape = box
    const interactable = prompt.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = 3
    interactable.onTriggerStart.add(() => this.restartGame())
  }

  private restartGame(): void {
    ++this.announcementToken
    for (const root of this.runtimeRoots) {
      if (root && !root.isBeingDestroyed) root.destroy()
    }
    this.runtimeRoots = []
    this.hand = []
    this.opponentHand = []
    this.opponentBacks = []
    this.wheelObjects = []
    this.pileVisual = null
    this.pileRoot = null
    this.drawDeckRoot = null
    this.activeColorVisual = null
    this.pileLabel = null
    this.pileColorLabel = null
    this.statusLabel = null
    this.opponentLabel = null
    this.drawLabel = null
    this.drawCountLabel = null
    this.announcementLabel = null
    this.restartPrompt = null
    this.selectedId = -1
    this.nextCardId = 0
    this.startGame()
  }

  private resetDrawPile(): void {
    const colors = ["RED", "BLUE", "GREEN", "YELLOW"]
    this.drawPile = []
    for (const color of colors) {
      for (let value = 0; value < 10; value++) {
        this.drawPile.push(color + " " + value)
        if (value > 0) this.drawPile.push(color + " " + value)
      }
      this.drawPile.push(color + " +2", color + " +2", color + " SKIP", color + " SKIP", color + " REVERSE", color + " REVERSE")
    }
    for (let i = 0; i < 4; i++) this.drawPile.push("WILD WILD", "WILD +4")
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(this.randomUnit() * (i + 1))
      const value = this.drawPile[i]
      this.drawPile[i] = this.drawPile[j]
      this.drawPile[j] = value
    }
  }

  private randomUnit(): number {
    this.randomSeed = (Math.imul(this.randomSeed, 1664525) + 1013904223) >>> 0
    return this.randomSeed / 0x100000000
  }

  private drawFromDeck(): string {
    if (this.drawPile.length === 0) this.resetDrawPile()
    const value = this.drawPile.pop() as string
    if (this.drawLabel) this.drawLabel.text = "S"
    if (this.drawCountLabel) this.drawCountLabel.text = String(this.drawPile.length)
    return value
  }

  private drawForPlayer(): void {
    if (this.state === "DRAWN CARD: PLAY OR PASS") {
      this.selectedId = -1
      this.beginOpponentTurn()
      return
    }
    if (this.state !== "YOUR TURN" || this.wildPending || this.drawInProgress) return
    const card = this.createCard(this.drawFromDeck(), true)
    this.hand.push(card)
    this.layoutHand(true)
    this.selectedId = card.id
    this.state = this.isLegalPlayerCard(card) ? "DRAWN CARD: PLAY OR PASS" : "CARD DRAWN"
    this.refresh()
    if (!this.isLegalPlayerCard(card)) this.finishPlayerTurnAfterDraw()
  }

  private isLegalPlayerCard(card: CardData): boolean {
    return this.isPlayable(card.color, card.value, card.wild)
  }

  private isPlayable(color: string, value: string, wild: boolean): boolean {
    if (wild) return true

    const shownColor = this.pileColorLabel ? this.pileColorLabel.text : ""
    const turnColor = shownColor === "WILD" || !shownColor
      ? this.activeColor
      : shownColor === "GOLD" ? "YELLOW" : shownColor
    if (color.trim().toUpperCase() === turnColor.trim().toUpperCase()) return true

    const shownValue = this.pileLabel ? this.pileLabel.text : ""
    const topValue = shownValue === "REV"
      ? "REVERSE"
      : shownValue || this.topCard.split(" ").slice(1).join(" ")
    const normalize = (candidate: string): string => candidate.trim().toUpperCase().replace(/\s+/g, " ")
    return normalize(value) === normalize(topValue)
  }

  private canPlayerPlay(): boolean {
    return this.state === "YOUR TURN" || this.state === "DRAWN CARD: PLAY OR PASS"
  }

  private finishPlayerTurnAfterDraw(): void {
    this.setHandEnabled(false)
    const delayed = this.createEvent("DelayedCallbackEvent")
    delayed.bind(() => {
      this.selectedId = -1
      this.state = "OPPONENT'S TURN"
      this.beginOpponentTurn()
    })
    delayed.reset(0.7)
  }

  private drawForOpponent(count: number): void {
    this.state = "OPPONENT DRAWS " + count
    this.drawInProgress = true
    this.drawCards = 0
    this.drawTarget = count
    this.refresh()
    const drawNext = (): void => {
      const delayed = this.createEvent("DelayedCallbackEvent")
      delayed.bind(() => {
        this.opponentHand.push(this.drawFromDeck())
        this.drawCards++
        this.refresh()
        if (this.drawCards < count) drawNext()
        else {
          this.drawInProgress = false
          this.drawCards = 0
          this.drawTarget = 4
          this.state = "YOUR TURN"
          this.setHandEnabled(true)
          this.refresh()
          this.emitState()
        }
      })
      delayed.reset(0.34)
    }
    this.setHandEnabled(false)
    drawNext()
  }

  private drawOne(): void {
    const delayed = this.createEvent("DelayedCallbackEvent")
    delayed.bind(() => {
      const drawn = this.drawFromDeck()
      const card = this.createCard(drawn, true)
      this.hand.push(card)
      this.drawCards++
      console.log("[SharedTableCards] penalty card=" + drawn + " draw=" + this.drawCards + "/" + this.drawTarget + " hand=" + this.hand.length)
      this.layoutHand(true)
      this.refresh()
      if (this.drawCards < this.drawTarget) this.drawOne()
      else {
        this.drawInProgress = false
        this.drawTarget = 4
        this.state = "YOUR TURN"
        this.setHandEnabled(true)
        this.layoutHand(true)
        this.refresh()
        this.emitState()
      }
    })
    delayed.reset(0.42)
  }

  private layoutHand(animated: boolean): void {
    const count = this.hand.length
    const aspect = this.cameraComponent ? Math.max(0.35, this.cameraComponent.aspect) : 1
    const fov = this.cameraComponent ? this.cameraComponent.fov : 0.925
    const visibleWidth = 2 * 88 * Math.tan(fov * 0.5) * aspect
    const handWidth = Math.max(26, Math.min(48, visibleWidth * 0.84))
    const spacing = count > 1 ? Math.min(6.25, handWidth / (count - 1)) : 0
    const handScale = count > 10 ? Math.max(0.78, 10 / count) : 1
    for (let i = 0; i < count; i++) {
      const card = this.hand[i]
      const x = (i - (count - 1) / 2) * spacing
      const normalized = count > 1 ? Math.abs(i - (count - 1) / 2) / ((count - 1) / 2) : 0
      const y = -21 - normalized * normalized * 1.65
      const target = new vec3(x, y, -88)
      if (animated) this.animateCardToPosition(card, target)
      else card.root.getTransform().setLocalPosition(target)
      const angle = -(i - (count - 1) / 2) * Math.min(0.038, 0.22 / Math.max(1, count - 1))
      card.root.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, angle + (card.wild ? 0.045 : 0)))
      card.root.getTransform().setWorldScale(card.selected ? new vec3(handScale * 1.1, handScale * 1.1, 1) : new vec3(handScale, handScale, 1))
    }
  }

  private animateCardToHand(card: CardData, index: number): void {
    const count = Math.max(1, this.hand.length + 1)
    const target = new vec3((index - (count - 1) / 2) * 6.0, -21, -88)
    this.animateCardToPosition(card, target)
  }

  private animateCardToPosition(card: CardData, target: vec3): void {
    const start = card.root.getTransform().getLocalPosition()
    animate({
      duration: 0.34,
      easing: "ease-out-quad",
      update: (t: number) => {
        card.root.getTransform().setLocalPosition(new vec3(start.x + (target.x - start.x) * t, start.y + (target.y - start.y) * t, start.z + (target.z - start.z) * t))
      }
    })
  }

  private getResponsiveScale(depth: number, requiredHalfExtent: number): number {
    if (!this.cameraComponent) return 1
    const halfHeight = depth * Math.tan(this.cameraComponent.fov * 0.5)
    const halfWidth = halfHeight * Math.max(0.35, this.cameraComponent.aspect)
    return Math.max(0.55, Math.min(1, halfWidth / requiredHalfExtent, halfHeight / requiredHalfExtent))
  }

  private refresh(): void {
    const selected = this.hand.find((card) => card.id === this.selectedId)
    const stateText = selected && this.state === "YOUR TURN"
      ? "SELECTED  |  " + selected.color + " " + selected.value
      : this.drawInProgress ? this.state + "  " + this.drawCards + "/" + this.drawTarget : this.state
    const wildTop = this.topCard.indexOf("WILD ") === 0
    const activeHint = this.wildPending
      ? "CHOOSE COLOR"
      : wildTop ? "WILD → " + this.activeColor : "PLAY " + this.activeColor
    if (this.statusLabel) this.statusLabel.text = stateText + "  •  " + activeHint
    if (this.opponentLabel) this.opponentLabel.text = "OPPONENT  •  " + this.opponentHand.length + " CARDS" + (this.drawInProgress ? "  •  DRAW" : "")
    const indicatorColor = this.wildPending ? "WILD" : this.activeColor
    if (this.activeColorVisual) this.activeColorVisual.mainMaterial = this.materialFor(indicatorColor)
    if (this.drawLabel) this.drawLabel.text = "S"
    if (this.drawCountLabel) this.drawCountLabel.text = String(this.drawPile.length)
    const visibleOpponentCards = Math.min(this.opponentBacks.length, this.opponentHand.length)
    const firstVisible = Math.floor((this.opponentBacks.length - visibleOpponentCards) / 2)
    for (let i = 0; i < this.opponentBacks.length; i++) {
      this.opponentBacks[i].enabled = i >= firstVisible && i < firstVisible + visibleOpponentCards
    }
    if (this.display) this.display.text = "SHARED TABLE  •  " + this.hand.length + " IN HAND"
  }

  private emitState(): void {
    print("[SharedTableCards] state=" + this.state + " hand=" + this.hand.length + " active=" + this.activeColor + " draws=" + this.drawCards)
  }

  getHandCount(): number { return this.hand.length }
  getActiveColor(): string { return this.activeColor }
  getTopCard(): string { return this.topCard }
  getTurnState(): string { return this.state }
  isWildPending(): boolean { return this.wildPending }
  getDrawCards(): number { return this.drawCards }
  getCardCount(): number { return this.hand.length }
}





