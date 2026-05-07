'use client'

import { useState, useRef, useCallback } from 'react'
import { ApiKeys } from '@/components/ui/ApiKeysModal'

// ========================================
// Type definitions
// ========================================

export type DebateCategory = 'factual' | 'scientific' | 'controversial' | 'philosophical'
export type DebatePhase =
  | 'idle'
  | 'starting'
  | 'opening'
  | 'rebuttal'
  | 'belief_update'
  | 'awaiting_user'
  | 'end'
  | 'error'
export type TenacityType =
  | 'none'
  | 'legitimate_reconstruction'
  | 'topic_shift'
  | 'authority_escape'
  | 'emotional_reframe'

export interface ArgumentStructure {
  premises: string[]
  reasoning_steps: string[]
  conclusion: string
  weakest_link: string
}

export interface ClaimEntry {
  round: number
  claim: string
  rebuttal: string
  structure: ArgumentStructure
  attack_target: string
  confidence: number
  fallacies: string[]
}

export interface AttackPreview {
  round: number
  claude_targets: string
  grok_targets: string
}

export interface BeliefUpdate {
  round: number
  claude_tenacity: number
  claude_tenacity_type: TenacityType
  claude_observation: string
  grok_tenacity: number
  grok_tenacity_type: TenacityType
  grok_observation: string
}

export interface DebateState {
  sessionId: string | null
  topic: string
  category: DebateCategory | null
  phase: DebatePhase
  round: number
  rolesSwapped: boolean

  claudePosition: string
  claudeClaims: ClaimEntry[]
  claudeConfidence: number

  grokPosition: string
  grokClaims: ClaimEntry[]
  grokConfidence: number

  attackPreview: AttackPreview | null
  beliefHistory: BeliefUpdate[]
  error: string | null
}

interface StartDebateOptions {
  topic: string
  testMode?: boolean
}

interface UseDebateReturn {
  state: DebateState
  start: (options: StartDebateOptions, keys: ApiKeys) => Promise<void>
  continueDebate: () => Promise<void>
  intervene: (target: 'claude' | 'grok' | 'both', message: string) => Promise<void>
  triggerRoleswap: () => Promise<void>
  endDebate: () => Promise<void>
  reset: () => void
}

// ========================================
// Constants
// ========================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const INITIAL_STATE: DebateState = {
  sessionId: null,
  topic: '',
  category: null,
  phase: 'idle',
  round: 0,
  rolesSwapped: false,
  claudePosition: '',
  claudeClaims: [],
  claudeConfidence: 0.8,
  grokPosition: '',
  grokClaims: [],
  grokConfidence: 0.8,
  attackPreview: null,
  beliefHistory: [],
  error: null,
}

// ========================================
// useDebate
// ========================================

export function useDebate(): UseDebateReturn {
  const [state, setState] = useState<DebateState>(INITIAL_STATE)
  const eventSourceRef = useRef<EventSource | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const reconnectCountRef = useRef(0)
  const maxReconnects = 3

  // ========================================
  // SSE event handler
  // ========================================

  function handleSSEEvent(event: MessageEvent, eventType: string) {
    const rawData = event.data?.trim();

    if (!rawData || rawData === "" || rawData === "undefined" || rawData.startsWith(':')) {
          return;   
        }

    try {
      const data = JSON.parse(rawData);

      switch (eventType) {
        case 'category_detected':
          setState(prev => ({
            ...prev,
            category: data.category,
            claudePosition: data.claude_position || '',
            grokPosition: data.grok_position || '',
            phase: 'opening',
          }));
          break;

        case 'opening_round':
          setState(prev => ({
            ...prev,
            phase: 'opening',
            round: data.round || 1,
            claudeClaims: [...prev.claudeClaims, normalizeClaim(data.claude)],
            grokClaims: [...prev.grokClaims, normalizeClaim(data.grok)],
            claudeConfidence: data.claude?.confidence ?? prev.claudeConfidence,
            grokConfidence: data.grok?.confidence ?? prev.grokConfidence,
          }));
          break;

        case 'rebuttal_round':
          setState(prev => ({
            ...prev,
            phase: 'rebuttal',
            round: data.round,
            claudeClaims: [...prev.claudeClaims, normalizeClaim(data.claude)],
            grokClaims: [...prev.grokClaims, normalizeClaim(data.grok)],
            claudeConfidence: data.claude_confidence ?? prev.claudeConfidence,
            grokConfidence: data.grok_confidence ?? prev.grokConfidence,
            attackPreview: {
              round: data.round,
              claude_targets: data.claude_attack_target || '',
              grok_targets: data.grok_attack_target || '',
            },
          }));
          break;

        case 'belief_update':
          setState(prev => ({
            ...prev,
            phase: 'belief_update',
            beliefHistory: [...prev.beliefHistory, {
              round: data.round,
              claude_tenacity: data.claude_tenacity,
              claude_tenacity_type: data.claude_tenacity_type,
              claude_observation: data.claude_observation,
              grok_tenacity: data.grok_tenacity,
              grok_tenacity_type: data.grok_tenacity_type,
              grok_observation: data.grok_observation,
            }],
          }));
          break;

        case 'awaiting_user':
          setState(prev => ({
            ...prev,
            phase: 'awaiting_user',
          }));
          break;

        case 'debate_end':
          setState(prev => ({
            ...prev,
            phase: 'end',
          }));
          eventSourceRef.current?.close();
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            phase: 'error',
            error: data.message,
          }));
          eventSourceRef.current?.close();
          break;
      }
    } catch (e) {
      console.error(`[SSE] JSON parse failed for ${eventType}:`, e);
      console.error("Raw data:", rawData);
    }
  }

  // ========================================
  // SSE connection
  // ========================================

  function connectSSE(sessionId: string) {
    eventSourceRef.current?.close()

    const es = new EventSource(`${API_BASE}/debate/${sessionId}/stream`)

    const events = [
      'category_detected',
      'opening_round',
      'rebuttal_round',
      'belief_update',
      'awaiting_user',
      'debate_end',
      'error',
    ]

    events.forEach(eventType => {
      es.addEventListener(eventType, (e: MessageEvent) => {
        handleSSEEvent(e, eventType)
      })
    })

    es.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: 'Connection lost. Please try again.',
      }));
      es.close();
    }

    eventSourceRef.current = es
  }

  // ========================================
  // Actions
  // ========================================

  const start = useCallback(async (
    options: StartDebateOptions,
    keys: ApiKeys
  ) => {
    setState({
      ...INITIAL_STATE,
      topic: options.topic,
      phase: 'starting',
    })

    try {
      const res = await fetch(`${API_BASE}/debate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: options.topic,
          test_mode: options.testMode || false,
          api_keys: {
            anthropic_api_key: keys.anthropic_api_key,
            xai_api_key: keys.xai_api_key,
          },
        }),
      })

      if (!res.ok) throw new Error(`Failed to start debate: ${res.status}`)

      const { session_id } = await res.json()
      sessionIdRef.current = session_id
      setState(prev => ({ ...prev, sessionId: session_id }))

      // Open SSE stream
      connectSSE(session_id)

    } catch (err) {
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [])

  const continueDebate = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    await fetch(`${API_BASE}/debate/${sessionId}/continue`, { method: 'POST' })
    setState(prev => ({ ...prev, phase: 'rebuttal' }))
    connectSSE(sessionId)
  }, [])

  const intervene = useCallback(async (
    target: 'claude' | 'grok' | 'both',
    message: string
  ) => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    await fetch(`${API_BASE}/debate/${sessionId}/intervene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message }),
    })

    setState(prev => ({ ...prev, phase: 'rebuttal' }))
    connectSSE(sessionId)
  }, [])

  const triggerRoleswap = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    const res = await fetch(`${API_BASE}/debate/${sessionId}/roleswap`, {
      method: 'POST'
    })
    const json = await res.json()

    setState(prev => ({
      ...prev,
      rolesSwapped: json.roles_swapped ?? !prev.rolesSwapped,
      phase: 'rebuttal',
    }))
    connectSSE(sessionId)
  }, [])

  const endDebate = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    eventSourceRef.current?.close()
    await fetch(`${API_BASE}/debate/${sessionId}/end`, { method: 'POST' })

    setState(prev => ({ ...prev, phase: 'end' }))
    sessionIdRef.current = null
  }, [])

  const reset = useCallback(() => {
    eventSourceRef.current?.close()
    sessionIdRef.current = null
    setState(INITIAL_STATE)
  }, [])

  return {
    state,
    start,
    continueDebate,
    intervene,
    triggerRoleswap,
    endDebate,
    reset,
  }
}

// ========================================
// Helpers
// ========================================

/**
 * Normalize a raw claim payload from the backend into a ClaimEntry.
 * Backend ClaimRecord already matches this shape (after v2.1 cleanup),
 * but we defensively fill in defaults for missing fields.
 */
function normalizeClaim(raw: any): ClaimEntry {
  if (!raw) {
    return {
      round: 0,
      claim: '',
      rebuttal: '',
      structure: {
        premises: [],
        reasoning_steps: [],
        conclusion: '',
        weakest_link: '',
      },
      attack_target: '',
      confidence: 0,
      fallacies: [],
    }
  }

  return {
    round: raw.round ?? 0,
    claim: raw.claim ?? '',
    rebuttal: raw.rebuttal ?? '',
    structure: raw.structure ?? {
      premises: [],
      reasoning_steps: [],
      conclusion: '',
      weakest_link: '',
    },
    attack_target: raw.attack_target ?? '',
    confidence: raw.confidence ?? 0,
    fallacies: raw.fallacy_labels ?? raw.fallacies ?? [],
  }
}