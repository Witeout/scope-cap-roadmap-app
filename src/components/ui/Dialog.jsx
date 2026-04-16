import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '../../store/uiStore'

/**
 * In-app dialog — replaces window.alert(), window.confirm(), window.prompt().
 *
 * Driven by `dialog` state in uiStore. Supports three modes:
 *   alert   — message + OK
 *   confirm — message + Cancel / Confirm
 *   prompt  — message + text input + Cancel / OK
 *
 * Renders as a centred overlay modal. Keyboard accessible:
 *   Enter  → confirms
 *   Escape → cancels (confirm / prompt) or dismisses (alert)
 */
export default function Dialog() {
  const { dialog, closeDialog } = useUIStore()
  const [inputValue, setInputValue] = useState('')
  const inputRef  = useRef(null)
  const confirmRef = useRef(null)

  // Reset input and focus the right element whenever a new dialog opens
  useEffect(() => {
    if (!dialog) return
    setInputValue(dialog.defaultValue ?? '')
    // Defer so the element is mounted before we focus
    requestAnimationFrame(() => {
      if (dialog.type === 'prompt') inputRef.current?.focus()
      else confirmRef.current?.focus()
    })
  }, [dialog])

  if (!dialog) return null

  const { type = 'alert', title, message, onConfirm, onCancel } = dialog

  function handleConfirm() {
    closeDialog()
    onConfirm?.(type === 'prompt' ? inputValue : undefined)
  }

  function handleCancel() {
    closeDialog()
    onCancel?.()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && type !== 'prompt') { e.preventDefault(); handleConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); type === 'alert' ? handleConfirm() : handleCancel() }
  }

  const isConfirmOrPrompt = type === 'confirm' || type === 'prompt'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) { type === 'alert' ? handleConfirm() : handleCancel() } }}
      onKeyDown={handleKeyDown}
    >
      {/* Card */}
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col gap-4 p-6"
        style={{ minWidth: 320, maxWidth: 480, width: '90vw' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby="dialog-message"
      >
        {/* Title */}
        {title && (
          <p id="dialog-title" className="text-[15px] font-bold text-slate-800 leading-snug">
            {title}
          </p>
        )}

        {/* Message */}
        <p id="dialog-message" className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
          {message}
        </p>

        {/* Prompt input */}
        {type === 'prompt' && (
          <input
            ref={inputRef}
            type="text"
            className="text-sm border border-outline-variant/40 rounded-lg px-3 py-2 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm() } }}
          />
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          {isConfirmOrPrompt && (
            <button
              className="text-[13px] font-semibold px-4 py-1.5 rounded-lg border border-outline-variant/40 text-slate-600 hover:bg-surface-container transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
          <button
            ref={confirmRef}
            className={`text-[13px] font-semibold px-4 py-1.5 rounded-lg transition-colors ${
              type === 'confirm'
                ? 'bg-error text-white hover:opacity-90'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}
            onClick={handleConfirm}
          >
            {type === 'confirm' ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
