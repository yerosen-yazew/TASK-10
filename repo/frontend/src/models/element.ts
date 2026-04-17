// REQ: R5 — Canvas whiteboard with sticky notes, arrows/connectors, freehand pen, image drop-in
// REQ: R6 — 2,000 element cap, 5 MB per image, 50 images per room

/** Types of whiteboard elements. */
export enum ElementType {
  StickyNote = 'sticky-note',
  Arrow = 'arrow',
  PenStroke = 'pen-stroke',
  Image = 'image',
}

/** 2D position on the canvas. */
export interface Position {
  x: number
  y: number
}

/** Dimensions of an element. */
export interface Dimensions {
  width: number
  height: number
}

/** A single point in a pen stroke with optional pressure. */
export interface StrokePoint {
  x: number
  y: number
  pressure?: number
  timestamp: number
}

/** Base whiteboard element shared by all types. */
export interface BaseElement {
  elementId: string
  roomId: string
  type: ElementType
  position: Position
  zIndex: number
  createdBy: string         // memberId who created this element
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
}

/** Sticky note element. */
export interface StickyNote extends BaseElement {
  type: ElementType.StickyNote
  dimensions: Dimensions
  text: string
  backgroundColor: string
  textColor: string
  fontSize: number
}

/** Arrow/connector element between two points or two elements. */
export interface Arrow extends BaseElement {
  type: ElementType.Arrow
  startPoint: Position
  endPoint: Position
  startElementId?: string   // optional: anchor to an element
  endElementId?: string     // optional: anchor to an element
  strokeColor: string
  strokeWidth: number
  arrowHeadStyle: 'none' | 'triangle' | 'diamond'
}

/** Freehand pen stroke element. */
export interface PenStroke extends BaseElement {
  type: ElementType.PenStroke
  points: StrokePoint[]
  strokeColor: string
  strokeWidth: number
}

/** Image element on the whiteboard. */
export interface ImageElement extends BaseElement {
  type: ElementType.Image
  dimensions: Dimensions
  imageId: string           // references the image blob in the images IndexedDB store
  fileName: string
  mimeType: string
  fileSizeBytes: number
  alt: string
}

/** Union type for all whiteboard elements. */
export type WhiteboardElement = StickyNote | Arrow | PenStroke | ImageElement

/** Image blob stored in IndexedDB. */
export interface ImageRecord {
  imageId: string
  roomId: string
  elementId: string
  blob: Blob
  fileName: string
  mimeType: string
  fileSizeBytes: number
  createdAt: string         // ISO 8601
}
