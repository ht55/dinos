// frontend/app/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ApiKeysModal, { hasRequiredKeys } from '@/components/ui/ApiKeysModal'
import type { ApiKeys } from '@/components/ui/ApiKeysModal'

// ========================================
// Animation: Random Trigger
// ========================================

function useRandomAnimation(minMs: number, maxMs: number) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    function schedule() {
      const delay = minMs + Math.random() * (maxMs - minMs)
      timeout = setTimeout(() => {
        setActive(true)
        setTimeout(() => {
          setActive(false)
          schedule()
        }, 1200) // animation duration
      }, delay)
    }

    schedule()
    return () => clearTimeout(timeout)
  }, [minMs, maxMs])

  return active
}

// ========================================
// Component
// ========================================

export default function HomePage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const fireActive = useRandomAnimation(3000, 8000)
  const beamActive = useRandomAnimation(4000, 10000)

  function handleEnter() {
    if (hasRequiredKeys()) {
      router.push('/battlefield')
    } else {
      setShowModal(true)
    }
  }

  function handleSave(keys: ApiKeys) {
    setShowModal(false)
    router.push('/battlefield')
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
          overflow: hidden;
          background: transparent !important;
          width: 100%;
          height: 100%;
        }

        /* Background */
        .bg {
          position: fixed;
          inset: 0;
          background-image: url('/medwoodBG.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          z-index: 0;
          width: 100vw;
          height: 100vh;
        }

        /* Dino arena */
        .arena {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }

        /* Triceratops — left */
        .triceratops-wrap {
          position: absolute;
          bottom: -18vh;
          left: -18vw;
          width: 62vw;
          max-width: 900px;
        }
        .triceratops-wrap img {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(-8px 8px 16px rgba(0,0,0,0.8));
        }

        /* T-Rex — right */
        .trex-wrap {
          position: absolute;
          bottom: -40vh;
          right: -40vw;
          width: 100vw;
          max-width: 1250px;
        }
        .trex-wrap img {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(8px 8px 16px rgba(0,0,0,0.8));
        }

        /* ========== Fire animation (T-Rex → Triceratops) ========== */
        .fire-container {
          position: absolute;
          /* T-Rex month position */
          top: 25%;
          right: 88%;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 10;
        }

        /* Fire ball */
        .fire-burst {
          position: absolute;
          top: -20px;
          left: -20px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #ffcc00 30%, #ff6600 60%, transparent 80%);
          opacity: 0;
          transform: rotate(25deg);
          filter: blur(3px);
        }

        .fire-beam.active ~ .fire-burst {
          animation: fireBurst 4.1s ease-out forwards;
          animation-delay: 0.2s;
        }

        @keyframes fireBurst {
          0%   { opacity: 0; transform: scale(0.5) translateX(-12vw) rotate(15deg); }
          20%  { opacity: 1; transform: scale(1.5) translateX(-12vw) rotate(15deg); }
          60%  { opacity: 0.8; transform: scale(2.1) translateX(-12vw) rotate(15deg); }
          100% { opacity: 0; transform: scale(2.2) translateX(-14vw) rotate(15deg); }
        }

        /* ========== Eye beam animation (Triceratops → T-Rex) ========== */
        .beam-container {
          position: absolute;
          /* Triceratops eyes position */
          top: 36%;
          left: 79%;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 10;
        }

        /* Right eye */
        .eye-beam {
          position: absolute;
          top: 0;
          left: 0;
          height: 17px;
          width: 0;
          border-radius: 85px;
          background: linear-gradient(90deg,
            rgba(160,0,255,1) 0%,
            rgba(200,0,255,0.9) 50%,
            rgba(255,100,255,0.5) 80%,
            rgba(255,255,255,0) 100%
          );
          opacity: 0;
          filter: blur(1px) drop-shadow(0 0 6px #cc00ff);
          transform-origin: left center;
        }

        .eye-beam.right {
          transform: rotate(-12deg);
        }
        .eye-beam.left {
          transform: rotate(-18deg);
          margin-top: -15px;
          margin-left: 90px;
        }

        .eye-beam.active {
          animation: beamShoot 1.5s ease-out forwards;
          animation-delay: 0.2s;
        }
        .eye-beam.left.active {
          animation: beamShootLeft 1.5s ease-out forwards;
          animation-delay: 0.2s;
        }

        @keyframes beamShoot {
          0%   { width: 0;     opacity: 0; }
          10%  { width: 30px;  opacity: 1; }
          40%  { width: 22vw;  opacity: 1; }
          70%  { width: 24vw;  opacity: 0.8; }
          100% { width: 24vw;  opacity: 0; }
        }
        @keyframes beamShootLeft {
          0%   { width: 0;     opacity: 0; }
          10%  { width: 30px;  opacity: 0.9; }
          40%  { width: 20vw;  opacity: 0.9; }
          70%  { width: 22vw;  opacity: 0.7; }
          100% { width: 22vw;  opacity: 0; }
        }

        /* ========== Center Pannel ========== */
        .center-panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          pointer-events: none;
        }

        /* Enter buttun */
        .enter-btn {
          position: fixed;
          bottom: -170px;
          pointer-events: all;
          background: rgba(0,0,0,0.85);
          border: 0px solid rgba(255,255,255,0.15);
          border-radius: 10px;
          padding: 10px 28px;
          color: #CAFF00;
          font-family: var(--font-angerpoise), serif;
          font-size: clamp(40px, 20vw, 30px);
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow:
            0 0 20px rgba(202,255,0,0.2),
            0 8px 18px rgba(0,0,0,1);
          text-shadow: 0 0 12px rgba(0,0,0,1);

        }
        .enter-btn:hover {
          background: rgba(242,40,0,0.92);
          border-color: #CAFF00;
          box-shadow:
            0 0 30px rgba(0,0,0,0.6),
            0 4px 12px rgba(0,0,0,0.8);
          text-shadow: 0 0 12px rgba(0,0,0,1);
          transform: scale(1.04);
        }
        .enter-btn:active {
          transform: scale(0.97);
        }

        /* ========== Title ========== */
        .title {
          position: fixed;
          bottom: 54px;
          left: 0;
          right: 0;
          text-align: center;
          z-index: 20;
          font-family: var(--font-angerpoise), serif;
          font-size: clamp(36px, 6vw, 80px);
          color: #CAFF00;
          letter-spacing: 0.04em;
          text-shadow:
            0 0 20px rgba(0,0,0,0.7),
            0 8px 0 rgba(0,0,0,0.9),
            5px 5px 0 rgba(0,0,0,0.8);
          pointer-events: none;
          line-height: 1;
        }

        /* ========== Entire screen Flash (when attacks) ========== */
        .flash-fire {
          position: fixed;
          inset: 0;
          background: rgba(214, 0, 15, 0.6);
          z-index: 5;
          opacity: 0;
          pointer-events: none;
        }
        .flash-fire.active {
          animation: flashFire 1.5s ease-out forwards;
        }
        @keyframes flashFire {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }

        .flash-beam {
          position: fixed;
          inset: 0;
          background: rgba(214, 0, 15, 0.6);
          z-index: 5;
          opacity: 0;
          pointer-events: none;
        }
        .flash-beam.active {
          animation: flashBeam 1.5s ease-out forwards;
        }
        @keyframes flashBeam {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* BG */}
      <div className="bg" />

      {/* Flash Overlay */}
      <div className={`flash-fire ${fireActive ? 'active' : ''}`} />
      <div className={`flash-beam ${beamActive ? 'active' : ''}`} />

      {/* Dino Arena */}
      <div className="arena">

        {/* Left: Triceratops */}
        <div className="triceratops-wrap">
          <img src="/triceratops.svg" alt="Triceratops — Claude" />
          {/* Beam origin */}
          <div className="beam-container">
            <div className={`eye-beam right ${beamActive ? 'active' : ''}`} />
            <div className={`eye-beam left ${beamActive ? 'active' : ''}`} />
          </div>
        </div>

        {/* Right: T-Rex */}
        <div className="trex-wrap">
          <img src="/trex.svg" alt="T-Rex — Grok" />
          {/* Beam origin */}
          <div className="fire-container">
            <div className={`fire-beam ${fireActive ? 'active' : ''}`} />
            <div className="fire-burst" />
          </div>
        </div>

      </div>

      {/* Center Enter buttun */}
      <div className="center-panel">
        <button className="enter-btn" onClick={handleEnter}>
          Enter
        </button>
      </div>

      {/* Title */}
      <div className="title">dinos.ext/Battlefield</div>

      {/* API Keys Modal */}
      {showModal && (
        <ApiKeysModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />

      )}
    </>
  )
}