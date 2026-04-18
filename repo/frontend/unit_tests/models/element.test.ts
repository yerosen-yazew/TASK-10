// REQ: element model enum and fixtures

import { describe, expect, it } from 'vitest'
import { ElementType } from '@/models/element'
import type { StickyNote, Arrow, PenStroke, ImageElement, ImageRecord } from '@/models/element'

describe('element model', () => {
  it('defines expected element type values', () => {
    expect(ElementType.StickyNote).toBe('sticky-note')
    expect(ElementType.Arrow).toBe('arrow')
    expect(ElementType.PenStroke).toBe('pen-stroke')
    expect(ElementType.Image).toBe('image')
  })

  it('accepts sticky, arrow, stroke, image, and image-record fixtures', () => {
    const base = {
      elementId: 'el-1',
      roomId: 'room-1',
      position: { x: 10, y: 20 },
      zIndex: 1,
      createdBy: 'member-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const sticky: StickyNote = {
      ...base,
      type: ElementType.StickyNote,
      dimensions: { width: 160, height: 120 },
      text: 'todo',
      backgroundColor: '#fef9c3',
      textColor: '#1e293b',
      fontSize: 14,
    }

    const arrow: Arrow = {
      ...base,
      elementId: 'el-2',
      type: ElementType.Arrow,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 100, y: 100 },
      strokeColor: '#111827',
      strokeWidth: 2,
      arrowHeadStyle: 'triangle',
    }

    const stroke: PenStroke = {
      ...base,
      elementId: 'el-3',
      type: ElementType.PenStroke,
      points: [{ x: 1, y: 2, pressure: 0.5, timestamp: 1700000000000 }],
      strokeColor: '#111827',
      strokeWidth: 2,
    }

    const imageElement: ImageElement = {
      ...base,
      elementId: 'el-4',
      type: ElementType.Image,
      dimensions: { width: 320, height: 200 },
      imageId: 'img-1',
      fileName: 'mock.png',
      mimeType: 'image/png',
      fileSizeBytes: 1024,
      alt: 'diagram',
    }

    const imageRecord: ImageRecord = {
      imageId: 'img-1',
      roomId: 'room-1',
      elementId: 'el-4',
      blob: new Blob(['img'], { type: 'image/png' }),
      fileName: 'mock.png',
      mimeType: 'image/png',
      fileSizeBytes: 1024,
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    expect(sticky.type).toBe(ElementType.StickyNote)
    expect(arrow.arrowHeadStyle).toBe('triangle')
    expect(stroke.points).toHaveLength(1)
    expect(imageElement.imageId).toBe(imageRecord.imageId)
  })
})
