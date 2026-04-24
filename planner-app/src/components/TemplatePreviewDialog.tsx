import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'

import { createAssetFromTemplate } from '../AssetFactory'
import type { AssetTemplate } from '../types/asset'
import AssetRenderer from './AssetRenderer'

export default function TemplatePreviewDialog({
  open,
  template,
  onClose,
}: {
  open: boolean
  template: AssetTemplate | null
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const asset = useMemo(() => {
    if (!template) return null
    return createAssetFromTemplate(template)
  }, [template])

  useLayoutEffect(() => {
    if (!open) return
    const el = containerRef.current
    if (!el) return
    const prev = document.activeElement
    el.focus({ preventScroll: true })
    return () => {
      if (prev instanceof HTMLElement && document.contains(prev)) {
        prev.focus({ preventScroll: true })
      }
    }
  }, [open, template?.type])

  if (!open || !template || !asset) return null

  return (
    <div
      ref={containerRef}
      className="library-dialog-backdrop template-preview-backdrop"
      role="presentation"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <div
        className="library-dialog template-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Vorschau"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="template-preview-header">
          <h3>{template.label}</h3>
          <button type="button" className="template-preview-close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="template-preview-canvas-wrap">
          <Canvas camera={{ position: [4.2, 3.2, 4.2], fov: 45 }}>
            <color attach="background" args={['#0f1a28']} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow />
            <Suspense fallback={null}>
              <AssetRenderer
                asset={asset}
                isSelected={false}
                isHovered={false}
                isEditMode={false}
              />
            </Suspense>
            <OrbitControls enablePan enableZoom enableRotate makeDefault />
          </Canvas>
        </div>
        <p className="panel-hint template-preview-hint">Maus: drehen, zoomen, schwenken</p>
      </div>
    </div>
  )
}
