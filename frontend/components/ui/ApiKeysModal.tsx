// frontend/components/ui/ApiKeysModal.tsx

'use client'

import { useState, useEffect } from 'react'

// ========================================
// Types
// ========================================

export interface ApiKeys {
  anthropic_api_key: string
  xai_api_key: string
}

interface ApiKeysModalProps {
  onClose: () => void
  onSave: (keys: ApiKeys) => void
}

// ========================================
// sessionStorage Helper
// ========================================

const STORAGE_KEYS = {
  anthropic: 'bf_anthropic_api_key',
  xai:       'bf_xai_api_key',
}

export function loadApiKeys(): Partial<ApiKeys> {
  if (typeof window === 'undefined') return {}
  return {
    anthropic_api_key: sessionStorage.getItem(STORAGE_KEYS.anthropic) || '',
    xai_api_key:       sessionStorage.getItem(STORAGE_KEYS.xai)       || '',
  }
}

export function hasRequiredKeys(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    sessionStorage.getItem(STORAGE_KEYS.anthropic) &&
    sessionStorage.getItem(STORAGE_KEYS.xai)
  )
}

// ========================================
// Row setting
// ========================================

const ROWS = [
  {
    label:       'Anthropic API Key',
    stateKey:    'anthropic' as const,
    storageKey:  STORAGE_KEYS.anthropic,
    placeholder: 'sk-ant-...',
    color:       '#FFD414',
    link:        'https://console.anthropic.com/',
    required:    true,
  },
  {
    label:       'Grok API Key',
    stateKey:    'xai' as const,
    storageKey:  STORAGE_KEYS.xai,
    placeholder: 'xai-...',
    color:       '#40FFB9',
    link:        'https://console.x.ai/',
    required:    true,
  },
]

// ========================================
// Component
// ========================================

export default function ApiKeysModal({ onClose, onSave }: ApiKeysModalProps) {
  const [keys, setKeys] = useState({ anthropic: '', xai: '' })

  // sessionStorageから既存キーを読み込む
  useEffect(() => {
    setKeys({
      anthropic: sessionStorage.getItem(STORAGE_KEYS.anthropic) || '',
      xai:       sessionStorage.getItem(STORAGE_KEYS.xai)       || '',
    })
  }, [])

  const canSave = !!(keys.anthropic.trim() && keys.xai.trim())

  function handleSave() {
    if (!canSave) return

    sessionStorage.setItem(STORAGE_KEYS.anthropic, keys.anthropic.trim())
    sessionStorage.setItem(STORAGE_KEYS.xai,       keys.xai.trim())

    onSave({
      anthropic_api_key: keys.anthropic.trim(),
      xai_api_key:       keys.xai.trim(),
    })

    onClose()
  }

  function handleErase() {
    Object.values(STORAGE_KEYS).forEach(k => sessionStorage.removeItem(k))
    setKeys({ anthropic: '', xai: '' })
  }

  return (
    <>
      <style>{`
        @keyframes scopeIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}>
        {/* Click outside to close */}
        <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

        {/* Modal */}
        <div style={{
          position: 'relative',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '10px solid rgba(0,0,0,0.5)',
          width: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '30px 36px 32px',
          animation: 'scopeIn 0.3s ease-out',
          boxShadow: '0 3px 7px rgba(0,0,0,0.9)',
        }}>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16, right: 20,
              border: 'none',
              background: 'transparent',
              color: '#000000',
              fontSize: 16,
              fontWeight: 'bolder',
              cursor: 'pointer',
            }}
          >✕</button>

          {/* Title */}
          <p style={{
            fontFamily: "'Sylvar', serif",
            color: '#A2E627',
            fontSize: '30px',
            letterSpacing: '0.08em',
            textAlign: 'center',
            textShadow: '0 4px 10px rgba(0,0,0,1)',
            margin: 0,
          }}>
            API Keys
          </p>

          {/* 2 rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ROWS.map(row => (
              <div key={row.stateKey} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                {/* Label */}
                <span style={{
                  fontFamily: "'Sylvar', serif",
                  color: row.color,
                  fontSize: '13px',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  width: '138px',
                  flexShrink: 0,
                  textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                }}>
                  {row.label}
                  {!row.required && (
                    <span style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.5)',
                      marginLeft: 5,
                      fontFamily: 'sans-serif',
                    }}>(opt)</span>
                  )}
                </span>

                {/* Input */}
                <input
                  type="password"
                  value={keys[row.stateKey]}
                  onChange={e => setKeys(prev => ({
                    ...prev,
                    [row.stateKey]: e.target.value,
                  }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder={row.placeholder}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '2px solid rgba(0,0,0,0.8)',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />

                {/* Get */}
                <a
                  href={row.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '2px solid #000',
                    background: '#1F1F1F',
                    color: '#BF08BF',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 5px rgba(0,0,0,1)',
                    flexShrink: 0,
                  }}
                >Get</a>
              </div>
            ))}
          </div>

          {/* Subtext */}
          <div style={{
            fontSize: '12px',
            color: 'rgba(194,194,194,0.8)',
            textAlign: 'center',
            lineHeight: '1.6',
            fontFamily: 'sans-serif',
            fontWeight: 'bold'
          }}>
            Both keys are required.<br />
            Sent directly to each API. Never stored or logged.
          </div>

          {/* Save / Erase */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: 14,
                borderRadius: 8,
                border: '3px solid #000',
                background: '#1F1F1F',
                color: canSave ? '#FFD414' : 'rgba(255,255,255,0.2)',
                cursor: canSave ? 'pointer' : 'default',
                opacity: canSave ? 1 : 0.5,
                boxShadow: '0 2px 5px rgba(0,0,0,1)',
                fontFamily: "'Sylvar', serif",
                letterSpacing: '0.05em',
              }}
            >
              Save → Enter Battlefield
            </button>

            <button
              onClick={handleErase}
              style={{
                padding: '10px 18px',
                fontSize: 14,
                borderRadius: 8,
                border: '3px solid #000',
                background: '#1F1F1F',
                color: '#D92300',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,1)',
              }}
            >Erase</button>
          </div>

        </div>
      </div>
    </>
  )
}