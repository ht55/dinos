// frontend/app/battlefield/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApiKeys } from '@/hooks/useApiKeys'
import { useDebate } from '@/hooks/useDebate'
import type { ApiKeys } from '@/components/ui/ApiKeysModal'
import { MOCK_DEBATE_STATE, MOCK_HANDLERS, useMockMode } from '@/hooks/mockDebate'

function GradientText({ text, className }: { text: string; className: string }) {
  return (
    <>
      {text.split('').map((char, i) => (
        <span key={i} className={className}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </>
  )
}

export default function BattlefieldPage() {
  const router = useRouter()
  const { keys, isReady } = useApiKeys()
  
  // Production hook (commented out during mock testing)
  // const { state, start, continueDebate, intervene, triggerRoleswap, endDebate, reset } = useDebate()
  
  // Mock data test
  const realDebate = useDebate()
  const isMockMode = useMockMode()
  const { state, start, continueDebate, intervene, triggerRoleswap, endDebate, reset } = isMockMode
    ? { state: MOCK_DEBATE_STATE, ...MOCK_HANDLERS }
    : realDebate

  const [topic, setTopic] = useState('')
  const [testMode, setTestMode] = useState(false)
  const [interventionTarget, setInterventionTarget] = useState<'claude' | 'grok' | 'both'>('both')
  const [interventionMsg, setInterventionMsg] = useState('')
  const [interventionExpanded, setInterventionExpanded] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const [userInterventions, setUserInterventions] = useState<Array<{
    round: number;
    target: 'claude' | 'grok' | 'both';
    message: string;
  }>>([])

  const claudeScrollRef = useRef<HTMLDivElement>(null)
  const grokScrollRef = useRef<HTMLDivElement>(null)
  const interventionTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ===== Development test flags =====
  const [testAnimation, setTestAnimation] = useState(false)
  const [fillTestText, setFillTestText] = useState(false)

  const isThinking = ['starting', 'opening', 'rebuttal'].includes(state.phase) || testAnimation
  const { fireActive, beamActive } = useBattleAnimation(isThinking)

  // Auto-scroll panels
  useEffect(() => {
    claudeScrollRef.current?.scrollTo({ top: claudeScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.claudeClaims])

  useEffect(() => {
    grokScrollRef.current?.scrollTo({ top: grokScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.grokClaims])

  // Focus textarea when intervention expands
  useEffect(() => {
    if (interventionExpanded) {
      setTimeout(() => interventionTextareaRef.current?.focus(), 100)
    }
  }, [interventionExpanded])

  // ===== Debug phase logging =====
  useEffect(() => {
    console.log('🔍 PHASE DEBUG:', {
      phase: state.phase,
      awaitingUser: state.phase === 'awaiting_user',
      isEnded: state.phase === 'end',
      interventionExpanded: interventionExpanded
    })
  }, [state.phase, interventionExpanded])

  // ===== Long text test for development (visual scrolling test) =====
  useEffect(() => {
    if (fillTestText) {
      // Force large amount of text into both panels for scrolling test
      const longText = "This is a very long test message to check panel height behavior. ".repeat(80)
      console.log("🧪 Long text fill activated - check panel scrolling")
    }
  }, [fillTestText])

  async function handleStart() {
    if (!topic.trim() || !isReady) return
    // NOTE: maxRounds removed from start() — backend should treat as unlimited
    await start({ topic: topic.trim(), testMode }, keys as ApiKeys)
  }

  async function handleIntervene() {
    if (!interventionMsg.trim()) return

    // History section
    const newIntervention = {
      round: state.round || 1,
      target: interventionTarget,
      message: interventionMsg.trim(),
    }
    
    setUserInterventions(prev => [...prev, newIntervention])

    await intervene(interventionTarget, interventionMsg)
    setInterventionMsg('')
    setInterventionExpanded(false)
  }

  // Tenacity label
  function tenacityLabel(type: string) {
    const map: Record<string, string> = {
      legitimate_reconstruction: '⚡ Rebuilt',
      topic_shift: '👻 Shifted',
      authority_escape: '📚 Escaped',
      emotional_reframe: '🎭 Reframed',
      none: '',
    }
    return map[type] || ''
  }

  // ===== NEW v2.1: get tenacity for a specific round and agent =====
  function getTenacityForRound(
    beliefHistory: typeof state.beliefHistory,
    round: number,
    agent: 'claude' | 'grok'
  ): string {
    const belief = beliefHistory.find(b => b.round === round)
    if (!belief) return 'none'
    return agent === 'claude' ? belief.claude_tenacity_type : belief.grok_tenacity_type
  }

  const isIdle = state.phase === 'idle'
  const isEnded = state.phase === 'end'
  const awaitingUser = state.phase === 'awaiting_user'

  // ===== HP Bar: render 10 blocks =====
  const HP_BLOCKS = 10
  function renderHpBlocks(confidence: number = 0, direction: 'ltr' | 'rtl') {
    const filled = Math.round((confidence || 0) * HP_BLOCKS)
    const blocks = Array.from({ length: HP_BLOCKS }, (_, i) => {
      const isFilled = direction === 'ltr'
        ? i < filled
        : i >= HP_BLOCKS - filled
      return <div key={i} className={`hp-block ${isFilled ? 'filled' : 'empty'}`} />
    })
    return blocks
  }

  // Battle Animation Hook (dinos)
  function useBattleAnimation(isThinking: boolean) {
    const [fireActive, setFireActive] = useState(false)
    const [beamActive, setBeamActive] = useState(false)

    useEffect(() => {
      if (!isThinking) {
        setFireActive(false)
        setBeamActive(false)
        return
      }

      let interval: NodeJS.Timeout
      let isFireTurn = true

      const triggerAttack = () => {
        if (isFireTurn) {
          setFireActive(true)
          setTimeout(() => setFireActive(false), 1450)
        } else {
          setBeamActive(true)
          setTimeout(() => setBeamActive(false), 1250)
        }
        isFireTurn = !isFireTurn
      }

      // First trigger is slightly faster
      setTimeout(triggerAttack, 300)
      interval = setInterval(triggerAttack, 2000) // Approximately 2.0 second cycle alternating

      return () => clearInterval(interval)
    }, [isThinking])

    return { fireActive, beamActive }
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
          width: 100%; height: 100%;
          overflow: hidden;
          background: #0a0a1a;
        }

        /* Background */
        .bf-bg {
          position: fixed;
          inset: 0;
          background-image: url('/graybrickBG.png');
          background-size: cover;
          background-position: center;
          z-index: 0;
          width: 100vw;
          height: 100vh;
        }

        /* Main layout */
        .bf-layout {
          position: fixed;
          inset: 0;
          z-index: 1;
          display: grid;
          grid-template-rows: 78px 1fr 92px;
          grid-template-columns: 1fr 240px 1fr;
          gap: 12px;
          padding: 12px;
          pointer-events: none;

          max-width: 1250px;
          margin: 0 auto;
          left: 0;
          right: 0;
        }

        /* ===== TOP ROW: HP bars ===== */
        /* NOTE: Layout is left=Grok, right=Claude */
        .hp-bar-wrap {
          grid-row: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          pointer-events: none;
        }
        .hp-bar-wrap.grok   { grid-column: 1; align-items: center; }
        .hp-bar-wrap.claude { grid-column: 3; align-items: center; }
        .hp-bar-wrap.center-top {
          grid-column: 2;
          display: flex;
          gap: 6px;
          align-items: center;
          justify-content: center;
        }

        .hp-label {
          font-family: var(--font-angerpoise), serif;
          font-size: 35px;
          letter-spacing: 0.08em;
          text-shadow: 0px 10px 15px #000000;
          margin-top: 10px;
          -webkit-text-stroke-width: 2px;
          -webkit-text-stroke-color: black;
        }

        /* HP bar — block style */
        .hp-track {
          display: flex;
          gap: 4px;
          height: 18px;
          padding: 3px;
          background: rgba(0,0,0,0.6);
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.12);
          width: 40%;
          margin-top: -5px;
        }
        .hp-block {
          flex: 1;
          border-radius: 1px;
          transition: background 0.4s ease, opacity 0.4s ease;
        }
        .hp-block.filled {
          background: #CAFF00;
          box-shadow: 0 0 6px rgba(202,255,0,0.5);
        }
        .hp-block.empty {
          background: rgba(202,255,0,0.22);
          box-shadow: none;
        }

        /* Round badge */
        .round-badge {
          font-family: var(--font-angerpoise), serif;
          font-size: 40px;
          text-align: center;
          letter-spacing: 0.1em;
          line-height: 0.95;
          -webkit-text-stroke-width: 2px;
          -webkit-text-stroke-color: black;
          
          background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            
            text-shadow: 
              0 2px 10px rgba(0, 0, 0, 0.3),
              
              0 5px 18px rgba(0, 0, 0, 0.5),

          }

        /* Battle page: flash completely disabled */
        .flash-fire,
        .flash-beam {
          display: none !important;
        }

        /* ===== Gradients ===== */
        .grad-grok,
        .grad-claude,
        .grad-redbrown {
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          display: inline-block;
        }

        /* Grok */
        .grad-grok {
          background-image: linear-gradient(
            180deg,
            #d946ef 0%,
            #a855f7 40%,
            #6d28d9 100%
          );
        }

        /* Claude */
        .grad-claude {
          background-image: linear-gradient(
            135deg,
            #6ee7b7 0%,
            #22d3ee 50%,
            #3b82f6 100%
          );
        }

        /* Round / Battlefield */
        .grad-redbrown {
          background-image: radial-gradient(
            ellipse at center,
            #FFBB00 0%,
            #FF4400 35%,
            #FF4400 100%
          );
        }

        /* ===== MIDDLE ROW: panels ===== */
        .speech-panel {
          grid-row: 2;
          margin-top: 20px;
          background: rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(2px);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0);
          overflow-y: auto;
          padding: 16px 16px 220px 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          pointer-events: all;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
          
          max-height: calc(100vh - 220px);
          height: calc(100vh - 220px);
          min-height: 400px;
        }
        /* Left panel = Grok (purple) */
        .speech-panel.grok {
          grid-column: 1;
          background: rgba(90, 66, 112, 0.15);
          border-color: rgba(168, 85, 247, 0);
          box-shadow: 3px 6px 3px rgba(0,0,0,0.7);
        }

        /* Right panel = Claude (cyan) */
        .speech-panel.claude {
          grid-column: 3;
          background: rgba(98, 196, 217, 0.15);
          border-color: rgba(34, 211, 238, 0);
          box-shadow: 3px 6px 3px rgba(0,0,0,0.7);
        }

        /* Center column */
        .center-column {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: all;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }

        /* ===== Topic card (idle: input / active: display) ===== */
        .topic-card {
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 3px 4px 3px rgba(0,0,0,0.7);
        }

        .topic-card.idle {
          background: rgba(0, 0, 0, 0.65);
          border: 2px solid rgba(255, 215, 0, 0.6);        /* 黄色寄りゴールド */
          box-shadow: 0 0 25px rgba(255, 215, 0, 0.45),
                      inset 0 0 20px rgba(255, 240, 100, 0.15);
          transition: all 0.3s ease;
        }

        .topic-card.idle:hover {
          border-color: #FFEA80;
          box-shadow: 0 0 35px rgba(255, 215, 0, 0.65),
                      inset 0 0 25px rgba(255, 240, 100, 0.25);
        }
        
        /* Topic Label */
        .topic-card-label {
          font-family: var(--font-angerpoise), serif;
          color: #FFEA80 !important;           /* 黄緑〜ゴールド */
          text-shadow: 0 0 8px rgba(255, 234, 128, 0.8);
          letter-spacing: 0.1
        }

        .topic-input {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 10px;
          color: #fff;
          font-size: 12px;
          font-family: sans-serif;
          outline: none;
          width: 100%;
          resize: none;
          min-height: 80px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.9);
        }
        .topic-input:focus {
          border-color: #FFEA80;
          box-shadow: 0 0 20px rgba(255, 234, 128, 0.6),
                      inset 0 0 15px rgba(255, 215, 0, 0.2);
          background: rgba(30, 25, 40, 0.95);
        }
        .topic-display {
          font-size: 13px;
          color: rgba(255,255,255,1.0);
          line-height: 1.5;
          font-family: sans-serif;
        }
        .topic-meta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .topic-meta-pill {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.55);
          color: rgba(255,255,255,1.0);
          font-family: var(--font-angerpoise), serif;
          letter-spacing: 0.08em;
        }

        /* Setup options (idle only) */
        .setup-options {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .setup-pill {
          flex: 1;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(0,0,0,0.3);
          color: rgba(255,255,255,0.5);
          font-family: var(--font-angerpoise), serif;
          font-size: 10px;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all 0.15s;
        }
        .setup-pill.active {
          background: rgba(255,65,0,0.15);
          color: #FF4100;
          border-color: rgba(255, 65, 0,0.4);
        }

        /* ===== Human icon ===== */
        .human-wrap {
          display: flex;
          justify-content: center;
          padding: 4px 0;
          flex-shrink: 0;
          transition: opacity 0.4s ease, transform 0.4s ease;
          box-shadow: 3px 6px 3px rgba(0,0,0,0.7);
        }
        .human-wrap img {
          width: 70px;
          filter: drop-shadow(0 0 8px rgba(0,0,0,0.4));
          transition: filter 0.4s ease, transform 0.4s ease;
        }
        /* Idle: visible (user about to enter battle) */
        .human-wrap.idle {
          opacity: 1;
        }
        /* Dim during AI debate (user watching) */
        .human-wrap.dim {
          opacity: 1;
        }
        /* Active: full opacity + glow (user materialized) */
        .human-wrap.active {
          opacity: 1;
        }
        .human-wrap.active img {
          filter: drop-shadow(0 0 12px rgba(255, 251, 133,0.8));
          transform: scale(1.1);
          animation: humanPulse 2s ease-in-out infinite;
        }
        @keyframes humanPulse {
          0%, 100% { transform: scale(1.1); }
          50%       { transform: scale(1.18); }
        }

        /* ===== Intervention card ===== */
        .intervention-card {
          background: rgba(40,191,58,0.9);
          backdrop-filter: blur(1px);
          border: 1px solid rgba(255,151,5,0.2);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: opacity 0.4s ease, border-color 0.4s ease, background 0.4s ease;
          flex-shrink: 0;
        }
        .intervention-card.dim {
          opacity: 0.3;
          pointer-events: none;
          box-shadow: 3px 3px 3px rgba(0,0,0,0.7);
        }
        .intervention-card.active {
          opacity: 1;
          border-color: rgba(255,151,5,0);
          background: rgba(46, 209, 81,0.42);
        }
        .intervention-title {
          font-family: var(--font-angerpoise), serif;
          font-size: 13px;
          color: #000000;
          letter-spacing: 0.1em;
          display: flex;
          align-items: center;
          gap: 6px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        .intervention-placeholder {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          font-style: italic;
          padding: 8px 0;
          text-align: center;
        }
        .target-select {
          display: flex;
          gap: 4px;
        }
        .target-btn {
          flex: 1;
          padding: 4px 4px;
          border-radius: 6px;
          border: 2px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.4);
          color: rgba(255,255,255,0.5);
          font-family: var(--font-angerpoise), serif;
          font-size: 11px;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 3px 4px 3px rgba(0,0,0,0.7);
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        .target-btn.selected.grok   { background: rgba(167, 3, 255,0.75); color: #000000; border-color: rgba(0,0,0,0.5); }
        .target-btn.selected.claude { background: rgba(3, 255, 255,0.75);  color: #000000; border-color: rgba(0,0,0,0.5); }
        .target-btn.selected.both   { background: rgba(255, 121, 3,0.75);  color: #000000; border-color: rgba(0,0,0,0.5); }
        .intervention-textarea {
          padding: 8px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.5);
          color: #fff;
          font-size: 12px;
          resize: vertical;
          min-height: 60px;
          outline: none;
          font-family: sans-serif;
          box-shadow: 3px 4px 3px rgba(0,0,0,0.7);
          text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
        }
        .intervention-textarea:focus {
          border-color: rgba(255,151,5,0.5);
        }
        .intervention-actions {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
          box-shadow: 3px 6px 3px rgba(0,0,0,0.7);
        }

        .intervention-history-entry {
          background: rgba(255, 215, 0, 0.08);
          border-left: 3px solid #ffd700;
          padding: 10px 12px;
          margin-bottom: 8px;
          border-radius: 6px;
        }

        .intervention-meta {
          font-size: 10px;
          color: #ffd700;
          margin-bottom: 4px;
          font-family: var(--font-angerpoise), serif;
        }

        .intervention-message {
          font-size: 12px;
          line-height: 1.4;
          color: rgba(255,255,255,0.85);
          font-style: italic;
        }

        .human-intervention-tag {
          font-size: 11px;
          color: #ffd700;
          background: rgba(255, 215, 0, 0.1);
          padding: 6px 10px;
          border-radius: 6px;
          margin: 8px 0;
        }

        /* ===== Belief / Attack preview cards ===== */
        .info-card {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 10px;
          flex-shrink: 0;
          box-shadow: 2px 4px 5px rgba(0, 0, 0, 0.8);
        }
        .info-card.attack {
          background: rgba(199, 103, 74, 0.8);
          border-color: rgba(255,100,0,0);
        }
        .info-card-title {
          font-family: var(--font-angerpoise), serif;
          font-size: 13px;
          color: rgba(255,255,255,0.95);
          text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        .info-card.attack .info-card-title {
          color: #000000;
          font-size: 13px;
        }

        .attack-line {
          font-size: 11px;
          color: rgba(255,255,255,1.0);
          line-height: 1.55;
          margin-bottom: 4px;
        }

        .attack-line .label {
          font-family: var(--font-angerpoise), serif;
          font-size: 11.5px;
          color: inherit;          
          display: block;
          margin-bottom: 3px;
          letter-spacing: 0.06em;
        }

        .attack-line .content {
          font-family: sans-serif !important;
          font-size: 11px;
          color: rgba(255,255,255,0.95);
        }

        .belief-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .belief-name {
          font-family: var(--font-angerpoise), serif;
          font-size: 11px;
          letter-spacing: 0.06em;
        }
        .belief-score {
          font-size: 12px;
          color: rgba(255,255,255,1.0);
        }
        .tenacity-bar {
          height: 4px;
          background: rgba(255,255,255,0.18);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 6px;
        }
        .tenacity-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.6s ease;
        }
        .belief-obs {
          font-size: 11px;
          color: rgba(255,255,255,1.0);
          line-height: 1.4;
          font-style: italic;
          font-family: sans-serif;
        }

        /* ===== Claim entries ===== */
        .claim-entry {
          border-radius: 10px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0);
          box-shadow: 3px 4px 3px rgba(0,0,0,0.7);
        }
        .claim-round {
          font-family: var(--font-angerpoise), serif;
          font-size: 13px;
          letter-spacing: 0.1em;
          margin-bottom: 6px;
          opacity: 1;
        }
        .claim-text {
          font-size: 11.5px;
          line-height: 1.6;
          color: rgba(255,255,255,0.95);
          font-family: sans-serif; 
        }
        .claim-meta {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .fallacy-tag {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,60,0,0.2);
          color: #FF5224;
          border: 1px solid rgba(255,60,0,0.3);
        }
        .tenacity-tag {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,200,0,0.1);
          color: #22E39F;
          border: 1px solid rgba(34,227,159,0.2);
        }
        .attack-target-line {
          font-size: 11px;
          color: rgba(255,150,0,0.7);
          margin-top: 6px;
          font-style: italic;
          font-family: sans-serif;
        }

        /* ===== BOTTOM ROW: controls ===== */
        .controls {
          grid-column: 1 / -1;
          grid-row: 3;
          display: flex;
          align-items: center;
          gap: 10px;
          pointer-events: all;
          justify-content: center;
        }

        .ctrl-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: 2px solid rgba(0,0,0,0.8);
          background: rgba(10,10,30,0.8);
          font-family: var(--font-angerpoise), serif;
          font-size: 13px;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          backdrop-filter: blur(8px);
        }
        .ctrl-btn:hover { opacity: 0.85; transform: scale(1.03); }
        .ctrl-btn:active { transform: scale(0.97); }
        .ctrl-btn:disabled { opacity: 0.3; cursor: default; transform: none; }

        .btn-fight     { color: #CAFF00; border-color: rgba(202,255,0,0.6); }
        .btn-continue  { color: #CAFF00; border-color: rgba(202,255,0,0.6); }
        .btn-intervene { color: #ff9705; border-color: rgba(255,151,5,0.7); }
        .btn-roleswap  { color: #ff3d85; border-color: rgba(255,61,133,0.5); }
        .btn-end       { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.7); }

        /* Dinos */
        .dino-left {
          position: fixed;
          bottom: 30px;
          left: -10px;
          width: 280px;
          z-index: 2;
          pointer-events: none;
          filter: drop-shadow(-4px 8px 12px rgba(0,0,0,0.8));
        }
        .dino-right {
          position: fixed;
          bottom: 30px;
          right: -27px;
          width: 320px;
          z-index: 2;
          pointer-events: none;
          filter: drop-shadow(4px 8px 12px rgba(0,0,0,0.8));
        }

        .dino-stage-left,
        .dino-stage-right {
          position: fixed;
          bottom: 25px;
          z-index: 2;
          pointer-events: none;
        }
        .dino-stage-left  { left: 125px; }
        .dino-stage-right { right: 170px; }

        /* The shadow stage under each dino */
        .dino-stage {
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 260px;
          height: 50px;
          background: radial-gradient(
            ellipse at center,
            #FFFFFF 0%,
            #292929 40%,
            #0a0a0a 80%,
            transparent 100%
          );
          border-radius: 50%;
          filter: blur(2px);
          z-index: -1;
        }

        /* Triceratops */
        .dino-stage-left .dino-stage {
          width: 300px;
          height: 55px;
          bottom: -8px;
          left: 45%;
        }

        /* T-Rex */
        .dino-stage-right .dino-stage {
          width: 240px;
          height: 45px;
          bottom: -5px;
          left: 55%;
        }

        /* Enhanced Thinking Indicator v2 */
        .thinking {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 0 20px 0;
          opacity: 0.95;
        }

        .thinking span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(135deg, #c026d3 0%, #22d3ee 100%);
          box-shadow: 
            0 0 8px #c026d3,
            0 0 16px #22d3ee,
            0 0 22px rgba(34, 211, 238, 0.6);
          animation: thinkingPulse 1.15s ease-in-out infinite;
        }

        .thinking span:nth-child(2) { animation-delay: 0.18s; }
        .thinking span:nth-child(3) { animation-delay: 0.36s; }

        .thinking .thinking-text {
          margin-left: 12px;
          font-family: var(--font-angerpoise), serif;
          font-size: 15px;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.85);
          text-shadow: 0 0 8px rgba(34, 211, 238, 0.4);
          user-select: none;
        }

        @keyframes thinkingPulse {
          0%, 100% { 
            transform: scale(0.75); 
            opacity: 0.65; 
          }
          50% { 
            transform: scale(1.38); 
            opacity: 1; 
          }
        }

        /* ========== Dinos Battle Animation ========== */
        /* Fire Container (T-Rex → Triceratops) */
        .fire-container {
          position: absolute;
          top: 32%;
          right: 78%;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 5;
        }

        .fire-burst {
          position: absolute;
          top: -200px;
          left: -25px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #ffcc00 30%, #ff6600 65%, transparent 85%);
          opacity: 0;
          filter: blur(4px);
          transform: rotate(25deg);
        }

        .fire-beam.active ~ .fire-burst {
          animation: fireBurstFast 1.65s ease-out forwards;
        }

        @keyframes fireBurstFast {
          0%   { opacity: 0; transform: scale(0.6) translateX(-9vw) rotate(15deg); }
          18%  { opacity: 1; transform: scale(1.65) translateX(-9vw) rotate(15deg); }
          55%  { opacity: 0.9; transform: scale(2.1) translateX(-10.5vw) rotate(15deg); }
          100% { opacity: 0; transform: scale(2.2) translateX(-12vw) rotate(15deg); }
        }

        /* Beam Container (Triceratops → T-Rex) */
        .beam-container {
          position: absolute;
          top: 38%;
          left: 62%;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 5;
        }

        .eye-beam {
          position: absolute;
          top: 0;
          left: 0;
          height: 10px;
          width: 0;
          border-radius: 100px;
          background: linear-gradient(90deg,
            rgba(160,0,255,1) 0%,
            rgba(200,0,255,0.95) 45%,
            rgba(255,120,255,0.6) 75%,
            rgba(255,255,255,0) 100%
          );
          opacity: 0;
          filter: blur(1.65px) drop-shadow(0 0 8px #cc00ff);
          transform-origin: left center;
        }

        .eye-beam.right { 
          margin-top: -154px;
          margin-left: 125px;
          transform: rotate(-5deg); 
        }

        .eye-beam.left  { 
          transform: rotate(-7deg); 
          margin-top: -154px;
          margin-left: 85px;
        }

        .eye-beam.active {
          animation: beamShootFast 1.65s ease-out forwards;
        }
        .eye-beam.left.active {
          animation: beamShootLeftFast 1.65s ease-out forwards;
        }

        @keyframes beamShootFast {
          0%   { width: 0; opacity: 0; }
          10%  { width: 38px; opacity: 1; }
          40%  { width: 21vw; opacity: 0.95; }
          75%  { width: 23vw; opacity: 0.7; }
          100% { width: 23vw; opacity: 0; }
        }

        @keyframes beamShootLeftFast {
          0%   { width: 0; opacity: 0; }
          10%  { width: 35px; opacity: 0.9; }
          40%  { width: 19vw; opacity: 0.85; }
          75%  { width: 21vw; opacity: 0.65; }
          100% { width: 21vw; opacity: 0; }
        }

        /* End screen */
        .end-banner {
          text-align: center;
          padding: 16px;
          font-family: var(--font-angerpoise), serif;
          font-size: 18px;
          color: rgba(255,255,255,0.6);
          letter-spacing: 0.1em;
          grid-column: 1 / -1;
        }

        /* Roleswap indicator */
        .roleswap-badge {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 30;
          font-family: var(--font-angerpoise), serif;
          font-size: 28px;
          color: #FF0061;
          text-shadow: 0 0 20px #000;
          letter-spacing: 0.1em;
          animation: roleswapFlash 2s ease-out forwards;
          pointer-events: none;
        }
        @keyframes roleswapFlash {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          80%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
        }

        .summary-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.75);   
        }

        .summary-modal {
          position: relative;
          width: 520px;
          max-width: 92vw;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(22px);
          border: 10px solid rgba(0, 0, 0, 0.65);
          border-radius: 24px;
          padding: 36px 40px 32px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.9);
          animation: scopeIn 0.35s ease-out forwards;
          color: white;
        }

        .summary-modal h2 {
          font-family: var(--font-angerpoise), serif;
          font-size: 32px;
          text-align: center;
          letter-spacing: 0.08em;
          color: #A2E627;
          text-shadow: 0 4px 12px rgba(0,0,0,0.9);
          margin: 0 0 24px 0;
        }

        .summary-content {
          line-height: 1.7;
          font-size: 15px;
        }

        .summary-agents {
          display: flex;
          gap: 48px;
          justify-content: center;
          margin: 28px 0;
          font-size: 14.5px;
        }

        .summary-agents > div {
          text-align: center;
        }

        .summary-winner {
          text-align: center;
          font-size: 17px;
          margin: 20px 0 8px;
          font-weight: bold;
          color: #CAFF00;
          text-shadow: 0 0 10px rgba(202, 255, 0, 0.5);
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 20px;
        }

        /* Battle Mode Buttons */
        .setup-pill {
          transition: all 0.25s ease;
          border: 2px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.45);
          position: relative;
          overflow: hidden;
        }

        .setup-pill:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 25px rgba(0,0,0,0.5);
          border-color: rgba(255,255,255,0.4);
        }

        /* ULTIMATE SHOWDOWN */
        .setup-pill.ultimate {
          border-color: #FF5500;
          background: linear-gradient(160deg, rgba(50,10,10,0.85), rgba(20,5,5,0.9));
          box-shadow: 0 6px 18px rgba(255, 85, 0, 0.35);
        }

        .setup-pill.ultimate.active {
          border-color: #FF3700;
          color: #FF3700;
          background: linear-gradient(160deg, rgba(80,20,10,0.95), rgba(40,10,5,0.95));
          box-shadow: 0 8px 25px rgba(255, 100, 0, 0.55);
        }

        /* QUICK SPARRING */
        .setup-pill.quick {
          border-color: rgba(0, 224, 170, 0.5);
          background: linear-gradient(160deg, rgba(10,45,35,0.85), rgba(5,25,20,0.9));
          box-shadow: 0 6px 18px rgba(0, 224, 170, 0.3);
        }

        .setup-pill.quick.active {
          border-color: #44FFCC;
          color: #44FFCC;
          background: linear-gradient(160deg, rgba(10,65,50,0.95), rgba(5,35,25,0.95));
          box-shadow: 0 8px 25px rgba(0, 224, 170, 0.45);
        }

        /* FIGHT! Button */
        .setup-pill.fight-btn {
          background: linear-gradient(145deg, #40FF00, #E6B800);
          color: #000000;
          border: 4px solid #000;
          box-shadow: 0 4px 12px rgba(255, 34, 0, 0.6),
                      inset 0 2px 4px rgba(255,255,255,0.4);
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          font-weight: 900;
          letter-spacing: 0.14em;
          transition: all 0.2s ease;
        }

        .setup-pill.fight-btn:hover {
          background: linear-gradient(145deg, #A600FF, #FF0022);
          border-color: #000;
          box-shadow: 0 6px 18px rgba(255, 34, 0, 0.8),
                      inset 0 2px 6px rgba(255,255,255,0.5);
          transform: translateY(-1px);
        }

        .setup-pill.fight-btn:active {
          background: linear-gradient(145deg, #FF4800, #FF0000);
          transform: translateY(1px);
          box-shadow: 0 2px 6px rgba(128, 255, 0, 0.6);
        }

        .setup-pill.fight-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>

      {/* Background */}
      <div className="bf-bg" />

      {/* Dinos: LEFT = Triceratops/Grok, RIGHT = T-Rex/Claude */}
      <div className="dino-stage-left">
        <div className="dino-stage" />
        <img src="/triceratops.svg" className="dino-left" alt="Grok — The Contrarian" />

        {/* Eye Beam (Triceratops → T-Rex) */}
        <div className="beam-container">
          <div className={`eye-beam right ${beamActive ? 'active' : ''}`} />
          <div className={`eye-beam left ${beamActive ? 'active' : ''}`} />
        </div>
      </div>

      <div className="dino-stage-right">
        <div className="dino-stage" />
        <img src="/trex.svg" className="dino-right" alt="Claude — The Philosopher" />

        {/* Fire Ball (T-Rex → Triceratops) */}
        <div className="fire-container">
          <div className={`fire-beam ${fireActive ? 'active' : ''}`} />
          <div className="fire-burst" />
        </div>
      </div>

      {/* Roleswap flash */}
      {state.rolesSwapped && (
        <div className="roleswap-badge">⚡ ROLESWAP ⚡</div>
      )}

      {/* Main grid */}
      <div className="bf-layout">

        {/* HP bar — Grok (left) */}
        <div className="hp-bar-wrap grok">
          <div className="hp-label">
            <GradientText 
              text="GROK" 
              className="grad-grok" 
            />
          </div>
          <div className="hp-track">
            {renderHpBlocks(state.grokConfidence, 'ltr')}
          </div>
        </div>

        {/* Round badge */}
        <div className="hp-bar-wrap center-top">
          <div className="round-badge">
            {state.phase === 'idle' ? (
              <GradientText text="BATTLEFIELD" className="grad-redbrown" />
            ) : (
              <>
                <GradientText text="ROUND" className="grad-redbrown" />
                <br />
                <GradientText text={String(state.round || 1)} className="grad-redbrown" />
              </>
            )}
          </div>
        </div>

        {/* Claude HP */}
        <div className="hp-bar-wrap claude">
          <div className="hp-label" style={{ textAlign: 'right' }}>
            <GradientText 
              text="CLAUDE" 
              className="grad-claude" 
            />
          </div>
          <div className="hp-track">
            {renderHpBlocks(state.claudeConfidence, 'ltr')}
          </div>
        </div>

        {/* ===== LEFT PANEL: Grok ===== */}
        <div className="speech-panel grok" ref={grokScrollRef}>
          {state.grokClaims.length === 0 && state.phase === 'idle' && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
              The Contrarian — speaks plainly, cuts deep
            </div>
          )}

          {state.grokClaims.map((c, i) => {
            const tenacityType = getTenacityForRound(state.beliefHistory, c.round, 'grok')
            const hasTenacity = tenacityType && tenacityType !== 'none'
            const interventionForThisRound = userInterventions.find(inv => inv.round === c.round- 1)

            return (
              <div key={i} className="claim-entry">
                <div className="claim-round" style={{ color: '#AE00FF' }}>
                  ROUND {c.round} {i === 0 ? '— OPENING' : '— REBUTTAL'}
                </div>
                {c.attack_target && (
                  <div className="attack-target-line">⚔ Targeting: {c.attack_target}</div>
                )}

                {/* Human Intervention */}
                {interventionForThisRound && (
                  <div className="human-intervention-tag">
                    💬 Human intervened ({interventionForThisRound.target.toUpperCase()}): 
                    "{interventionForThisRound.message}"
                  </div>
                )}
      
                <div className="claim-text">{c.rebuttal || c.claim}</div>
                {(c.fallacies.length > 0 || hasTenacity) && (
                  <div className="claim-meta">
                    {c.fallacies.map((f, fi) => {
                      // Force truncate long fallacy descriptions
                      const shortTag = typeof f === 'string' 
                        ? f.split(':')[0].trim() 
                        : String(f)
                      return (
                        <span key={fi} className="fallacy-tag">{shortTag}</span>
                      )
                    })}
                    {hasTenacity && (
                      <span className="tenacity-tag">{tenacityLabel(tenacityType)}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {['starting', 'opening', 'rebuttal'].includes(state.phase) && (
            <div className="thinking">
              <span />
              <span />
              <span />
              <div className="thinking-text">THINKING...</div>
            </div>
          )}
        </div>

        {/* ===== CENTER COLUMN ===== */}
        <div className="center-column">

          {/* Topic card — input when idle, display when active */}
          <div className={`topic-card ${isIdle ? 'idle' : ''}`}>
            <div className="topic-card-label">
              {isIdle ? 'ENTER A TOPIC' : 'TOPIC'}
            </div>

            {isIdle ? (
              <>
                <textarea
                  className="topic-input"
                  placeholder="What shall we debate?"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleStart()
                    }
                  }}
                />

                {/* BATTLE MODE SELECTION */}
                <div className="setup-options" style={{ flexDirection: 'column', gap: '12px' }}>

                  <div className="topic-card-label" style={{ 
                    textAlign: 'left', 
                    letterSpacing: '0.12em', 
                    marginBottom: '-5px',
                    paddingLeft: '4px'
                  }}>
                    SELECT BATTLE MODE
                  </div>

                  <button
                    className={`setup-pill ultimate ${!testMode ? 'active' : ''}`}
                    onClick={() => setTestMode(false)}
                    style={{ 
                      padding: '6px 6px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '-3px', marginBottom: '-3px' }}>
                      ⚔️ ULTIMATE SHOWDOWN
                    </div>
                    <div style={{ fontSize: '11.5px', opacity: 0.95, lineHeight: 1.3 }}>
                      Opus 4.6  vs  Grok 4.3
                    </div>
                  </button>

                  <button
                    className={`setup-pill quick ${testMode ? 'active' : ''}`}
                    onClick={() => setTestMode(true)}
                    style={{ 
                      padding: '6px 6px',
                      textAlign: 'center',
                      marginTop: '-5px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '-3px', marginBottom: '-3px' }}>
                      ⚡ QUICK SPARRING
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.95, lineHeight: 1.3 }}>
                      Haiku  vs  Grok 4.1 Fast
                    </div>
                  </button>

                  {/* FIGHT! button */}
                  <button 
                    className="setup-pill fight-btn" 
                    onClick={handleStart}
                    disabled={!topic.trim() || !isReady}
                    style={{
                      marginTop: '0px',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      padding: '0px 0px',
                      fontSize: '12.5px',
                      width: '50%'
                    }}
                  >
                    FIGHT!
                  </button>
                </div>
              </>
            ) : (

              <>
                <div className="topic-display">{state.topic}</div>
                {state.category && (
                  <div className="topic-meta">
                    <span className="topic-meta-pill">{state.category.toUpperCase()}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Attack preview (active only) */}
          {state.attackPreview && (
            <div className="info-card attack">
                <div className="info-card-title">⚔ ATTACK STRATEGY — R{state.attackPreview.round}</div>
                
                <div className="attack-line">
                  <span className="label" style={{ color: '#6000BF' }}>GROK targets:</span>
                  <span className="content">
                    {state.attackPreview.grok_targets}
                  </span>
                </div>
                
                <div className="attack-line">
                  <span className="label" style={{ color: '#00CDE0' }}>CLAUDE targets:</span>
                  <span className="content">
                    {state.attackPreview.claude_targets}
                  </span>
                </div>
              </div>
          )}

          {/* Belief updates */}
          {state.beliefHistory.length > 0 && (
            <div className="info-card">
              <div className="info-card-title">BELIEF UPDATE</div>
              {(() => {
                const latest = state.beliefHistory[state.beliefHistory.length - 1]
                return (
                  <>
                    <div className="belief-row">
                      <span className="belief-name" style={{ color: '#AE00FF' }}>GROK</span>
                      <span className="belief-score">{(latest.grok_tenacity * 100).toFixed(0)}% shift</span>
                    </div>
                    <div className="tenacity-bar">
                      <div 
                        className="tenacity-fill" 
                        style={{
                          width: `${latest.grok_tenacity * 100}%`,
                          background: '#AE00FF'
                        }} 
                      />
                    </div>
                    {latest.grok_observation && (
                      <div className="belief-obs">{latest.grok_observation}</div>
                    )}
                    <div style={{ marginTop: 10 }} />
                    <div className="belief-row">
                      <span className="belief-name" style={{ color: '#00ABBF' }}>CLAUDE</span>
                      <span className="belief-score">{(latest.claude_tenacity * 100).toFixed(0)}% shift</span>
                    </div>
                    <div className="tenacity-bar">
                      <div 
                        className="tenacity-fill" 
                        style={{
                          width: `${latest.claude_tenacity * 100}%`,
                          background: '#22d3ee'
                        }} 
                      />
                    </div>
                    {latest.claude_observation && (
                      <div className="belief-obs">{latest.claude_observation}</div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Human icon — always visible, opacity controlled by state */}
          <div className={`human-wrap ${
            isIdle ? 'idle' : interventionExpanded ? 'active' : 'dim'
          }`}>
            <img src="/human2.svg" alt="You" />
          </div>

          {/* Human Intervention History */}
          {userInterventions.length > 0 && (
            <div className="info-card">
              <div className="info-card-title">⚡ HUMAN INTERVENTIONS</div>
              {userInterventions.map((interv, idx) => (
                <div key={idx} className="intervention-history-entry">
                  <div className="intervention-meta">
                    Round {interv.round} — {interv.target.toUpperCase()}
                  </div>
                  <div className="intervention-message">
                    "{interv.message}"
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Intervention card — always present, expands when activated */}
          <div className={`intervention-card ${
            isIdle || interventionExpanded ? 'active' : 'dim'
          }`}>
            <div className="intervention-title">
              ⚡ {interventionExpanded ? 'YOUR INTERVENTION' : 'INTERVENE'}
            </div>

            {!interventionExpanded && (
              <div className="intervention-placeholder">
                {isIdle ? 'You will join the battle here' : 'Tap INTERVENE to step in'}
              </div>
            )}

            {interventionExpanded && (
              <>
                <div className="target-select">
                  {(['grok', 'claude', 'both'] as const).map(t => (
                    <button
                      key={t}
                      className={`target-btn ${interventionTarget === t ? `selected ${t}` : ''}`}
                      onClick={() => setInterventionTarget(t)}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={interventionTextareaRef}
                  className="intervention-textarea"
                  placeholder="Point out a flaw, challenge a premise..."
                  value={interventionMsg}
                  onChange={e => setInterventionMsg(e.target.value)}
                />
                <div className="intervention-actions">
                  <button
                    className="ctrl-btn btn-end"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => {
                      setInterventionExpanded(false)
                      setInterventionMsg('')
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="ctrl-btn btn-intervene"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={handleIntervene}
                    disabled={!interventionMsg.trim()}
                  >
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== RIGHT PANEL: Claude ===== */}
        <div className="speech-panel claude" ref={claudeScrollRef}>
          {state.claudeClaims.length === 0 && state.phase === 'idle' && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
              The Philosopher — weighs words, builds carefully
            </div>
          )}
         
          {state.claudeClaims.map((c, i) => {
            const tenacityType = getTenacityForRound(state.beliefHistory, c.round, 'claude')
            const hasTenacity = tenacityType && tenacityType !== 'none'
            const interventionForThisRound = userInterventions.find(inv => inv.round === c.round- 1)

            return (
              <div key={i} className="claim-entry">
                <div className="claim-round" style={{ color: '#00ABBF' }}>
                  ROUND {c.round} {i === 0 ? '— OPENING' : '— REBUTTAL'}
                </div>
                {c.attack_target && (
                  <div className="attack-target-line">⚔ Targeting: {c.attack_target}</div>
                )}

                {/* Human Intervention display */}
                {interventionForThisRound && (
                  <div className="human-intervention-tag">
                    💬 Human intervened ({interventionForThisRound.target.toUpperCase()}): 
                    "{interventionForThisRound.message}"
                  </div>
                )}

                <div className="claim-text">{c.rebuttal || c.claim}</div>
                {(c.fallacies.length > 0 || hasTenacity) && (
                  <div className="claim-meta">
                    {c.fallacies.map((f, fi) => (
                      <span key={fi} className="fallacy-tag">{f}</span>
                    ))}
                    {hasTenacity && (
                      <span className="tenacity-tag">{tenacityLabel(tenacityType)}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {['starting', 'opening', 'rebuttal'].includes(state.phase) && (
            <div className="thinking">
              <span />
              <span />
              <span />
              <div className="thinking-text">THINKING...</div>
            </div>
          )}
        </div>

        {/* End banner */}
        {isEnded && (
          <div className="end-banner">
            The debate concludes. What did YOU decide?
          </div>
        )}

        {/* ===== Controls ===== */}
        <div className="controls">
          {(state.phase === 'awaiting_user' || state.phase === 'error') && !interventionExpanded && (
            <>
              <button className="ctrl-btn btn-continue" onClick={continueDebate}>CONTINUE →</button>
              <button className="ctrl-btn btn-intervene" onClick={() => setInterventionExpanded(true)}>INTERVENE</button>
              <button className="ctrl-btn btn-roleswap" onClick={triggerRoleswap}>ROLESWAP</button>
              <button
                className="ctrl-btn btn-end"
                onClick={async () => {
                  await endDebate()
                  setShowSummary(true)
                  // reset() is called after modal is closed
                }}
              >
                END
              </button>
            </>
          )}

          {isEnded && <button className="ctrl-btn btn-fight" onClick={reset}>NEW DEBATE</button>}
        </div>

      </div>

      {/* === Development test button group === */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <button
            onClick={() => setTestAnimation(!testAnimation)}
            style={{
              padding: '10px 18px',
              background: testAnimation ? '#e11d48' : '#334155',
              color: 'white',
              border: '2px solid #64748b',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              pointerEvents: 'all',
            }}
          >
            {testAnimation ? '🛑 STOP ATTACK' : '🔥 TEST ATTACK'}
          </button>

          <button
            onClick={() => setFillTestText(!fillTestText)}
            style={{
              padding: '10px 18px',
              background: fillTestText ? '#eab308' : '#334155',
              color: 'white',
              border: '2px solid #64748b',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              pointerEvents: 'all',
            }}
          >
            {fillTestText ? '🧹 CLEAR LONG TEXT' : '📜 FILL LONG TEXT'}
          </button>
        </div>
      )}

      {/* End Summary Modal */}
      {showSummary && (
        <div className="summary-modal-overlay">
          <div className="summary-modal">
            {/* Close Button */}
            <button
              onClick={() => { setShowSummary(false); reset() }}
              style={{
                position: 'absolute',
                top: 18,
                right: 22,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '22px',
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: 0.7,
              }}
            >
              ✕
            </button>

            <h2>DEBATE SUMMARY</h2>

            <div className="summary-content">
              <p><strong>Topic:</strong> {state.topic}</p>
              <p><strong>Total Rounds:</strong> {state.round}</p>

              <div className="summary-agents">
                <div>
                  <strong style={{color: '#AE00FF'}}>GROK</strong><br />
                  Final Confidence: {(state.grokConfidence * 100).toFixed(0)}%<br />
                  Total Tenacity: {(state.beliefHistory.reduce((sum, b) => sum + b.grok_tenacity, 0) * 100).toFixed(0)}%
                </div>
                <div>
                  <strong style={{color: '#00ABBF'}}>CLAUDE</strong><br />
                  Final Confidence: {(state.claudeConfidence * 100).toFixed(0)}%<br />
                  Total Tenacity: {(state.beliefHistory.reduce((sum, b) => sum + b.claude_tenacity, 0) * 100).toFixed(0)}%
                </div>
              </div>

              <div className="summary-winner">
                {state.grokConfidence > state.claudeConfidence 
                  ? "🏆 GROK showed stronger conviction" 
                  : state.claudeConfidence > state.grokConfidence 
                    ? "🏆 CLAUDE showed stronger conviction" 
                    : "🤝 Both fought valiantly"}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button 
                onClick={() => { setShowSummary(false); reset() }}
                className="ctrl-btn btn-fight"
                style={{ flex: 1, padding: '14px', fontSize: '15px' }}
              >
                NEW DEBATE
              </button>
              
              <button 
                onClick={() => setShowSummary(false)}
                className="ctrl-btn btn-end"
                style={{ flex: 1, padding: '14px', fontSize: '15px' }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}