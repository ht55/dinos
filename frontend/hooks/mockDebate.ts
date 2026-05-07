/**
 * Mock data for UI development.
 *
 * Usage: Add `?mock=true` to URL to enable mock state.
 * Remove the URL param to return to real backend.
 *
 * Topic: 死刑制度は正当化されるか
 *
 * Casting:
 *   Grok (The Contrarian)    → 支持 (Pro)  — challenges the assumed liberal default
 *   Claude (The Philosopher) → 反対 (Con)  — ethical frameworks lean abolitionist
 *
 * 4 rounds designed to showcase ALL UI features:
 *   - All tenacity_types (via beliefHistory): legitimate_reconstruction,
 *     topic_shift, authority_escape, emotional_reframe
 *   - Various fallacy tags
 *   - Belief score progression (HP bars deplete asymmetrically)
 *   - Attack target preview
 *
 * v2.1 changes:
 *   - tenacity_score / tenacity_type removed from ClaimEntry
 *     (now stored exclusively in beliefHistory — Single Source of Truth)
 *   - maxRounds removed (debate is now unlimited / user-driven)
 */

import type { DebateState } from '@/hooks/useDebate'

// ===== Mock state: end of round 4, awaiting user action =====

export const MOCK_DEBATE_STATE: DebateState = {
  sessionId: 'mock-session-001',
  topic: '死刑制度は正当化されるか',
  category: 'controversial',
  phase: 'awaiting_user',
  round: 4,
  rolesSwapped: false,

  // ===== GROK: Pro death penalty (The Contrarian) =====
  grokPosition: 'pro',
  grokConfidence: 0.55, // started 0.85, gradually eroded
  grokClaims: [
    // Round 1 — Opening
    {
      round: 1,
      claim: '死刑は正当化される。社会契約論において、生命を脅かす行為は契約違反であり、その代償として生命の剥奪は論理的帰結だ。応報的正義は感情ではなく、被害者の尊厳の社会的承認である。',
      rebuttal: '',
      structure: {
        premises: [
          '社会契約は生命の相互保障を含む',
          '殺人は契約の根本的破壊である',
          '比例的応報は正義の基本原理である',
        ],
        reasoning_steps: [
          '契約違反には対応する制裁が必要',
          '生命を奪った者は生命を要求される',
          'これは復讐ではなく正義の構造である',
        ],
        conclusion: '故に死刑は社会契約の論理的帰結である',
        weakest_link: '「生命の比例的応報」が論理的帰結であるという主張',
      },
      attack_target: '',
      confidence: 0.85,
      fallacies: [],
    },
    // Round 2 — Rebuttal
    {
      round: 2,
      claim: '死刑は依然として正当化される。冤罪リスクは制度設計の問題であり、原理の否定にはならない。DNA鑑定など現代の証拠基準で誤判は劇的に減少している。',
      rebuttal: 'Claudeの「不可逆性」議論は循環的だ。すべての刑罰には不可逆的要素がある——拘禁年数も取り戻せない。「生命の特別性」を前提にした論証は問題を先取りしている。',
      structure: {
        premises: [
          '制度の運用問題と原理の正当性は別議論',
          '誤判は減少傾向にある',
          '不可逆性は程度問題であり、生命だけ特別ではない',
        ],
        reasoning_steps: [
          'Claudeの議論は「生命=絶対」を前提に置いている',
          'これは結論を前提に潜ませる循環論法',
          '故にClaudeの反対論は論理的に成立しない',
        ],
        conclusion: '原理としての死刑は依然有効',
        weakest_link: '「拘禁と死刑の不可逆性が同程度」という主張',
      },
      attack_target: '生命の不可逆性を絶対視する前提',
      confidence: 0.75,
      fallacies: ['循環論法の指摘'],
    },
    // Round 3 — Topic shift (visible in beliefHistory)
    {
      round: 3,
      claim: '死刑制度は被害者遺族の心理的回復において重要な役割を果たす。司法統計によれば、死刑判決後に遺族の80%以上が「区切り」を感じると報告している。',
      rebuttal: 'Claudeの「国家による殺人」というレトリックは感情的だ。法的処刑と殺人を同一視するのは概念の混同。徴兵で戦争に送り出すのは「国家による殺人」か？',
      structure: {
        premises: [
          '被害者遺族の心理回復は社会的価値である',
          '統計データは死刑の心理的効用を示唆する',
          '「国家による殺人」という言葉は感情的レトリック',
        ],
        reasoning_steps: [
          '社会全体の効用を考慮すべき',
          '効用主義的観点から死刑は正当化される',
          'Claudeの絶対主義的反対論は実証データを無視している',
        ],
        conclusion: '実証的観点から死刑は正当化される',
        weakest_link: '応報正義から効用主義への論点シフト',
      },
      attack_target: '「国家による殺人」というレトリック',
      confidence: 0.65,
      fallacies: ['論点のすり替え', '統計の権威への訴え'],
    },
    // Round 4 — Authority escape (visible in beliefHistory)
    {
      round: 4,
      claim: 'カント自身が死刑を支持していた。「人間の尊厳」を最も厳格に擁護した哲学者が、人を殺した者は死刑に処されるべきと明言している。これは応報正義の哲学的基礎だ。',
      rebuttal: 'Claudeは「尊厳」を理由に死刑反対を主張するが、カントは尊厳擁護者でありながら死刑支持者だった。哲学史を無視した立論は説得力を持たない。',
      structure: {
        premises: [
          'カントは尊厳の最大の擁護者である',
          'カントは死刑を支持していた',
          '故に尊厳と死刑は両立する',
        ],
        reasoning_steps: [
          '権威ある哲学者の見解を引用',
          'Claudeの立場は哲学史の誤読である',
          'よって反対論は崩れる',
        ],
        conclusion: '哲学的にも死刑は正当化される',
        weakest_link: 'カント1人の見解への依存',
      },
      attack_target: '尊厳を理由とした死刑反対論',
      confidence: 0.55,
      fallacies: ['権威への訴え', '一面的引用'],
    },
  ],

  // ===== CLAUDE: Anti death penalty (The Philosopher) =====
  claudePosition: 'con',
  claudeConfidence: 0.7,
  claudeClaims: [
    // Round 1 — Opening
    {
      round: 1,
      claim: '死刑は正当化されない。第一に冤罪の不可逆性、第二に国家による殺人の倫理的矛盾、第三に抑止効果の実証的不在。これら3つの欠陥が制度の正当性を根底から崩す。',
      rebuttal: '',
      structure: {
        premises: [
          '司法は誤判を完全には排除できない',
          '生命の剥奪は不可逆である',
          '国家の暴力独占は最小限であるべき',
        ],
        reasoning_steps: [
          '誤判+不可逆性 = 取り返しのつかない不正義',
          '国家が殺人を禁じながら殺人を執行するのは規範的矛盾',
          '抑止効果なら他の刑罰でも代替可能',
        ],
        conclusion: '故に死刑制度は正当化されない',
        weakest_link: '「国家の殺人と私的殺人を同一視」の論点',
      },
      attack_target: '',
      confidence: 0.80,
      fallacies: [],
    },
    // Round 2 — Legitimate reconstruction
    {
      round: 2,
      claim: '不可逆性の議論は循環ではない。拘禁と死刑の差異は質的であり、量的ではない。誤判が判明した時、生きている人間には謝罪と補償が可能だが、処刑された者には不可能だ。これは認識論的非対称性である。',
      rebuttal: 'Grokの「制度設計の問題」という反論は核心を外している。完璧な司法システムが存在しない以上、誤判リスクは制度に内在する。原理の議論と運用の議論は分離できない。',
      structure: {
        premises: [
          '誤判は司法システムに構造的に内在する',
          '生きている誤判被害者には救済可能性がある',
          '処刑された誤判被害者には救済可能性がない',
        ],
        reasoning_steps: [
          'これは量的差異ではなく質的差異である',
          '質的差異は原理レベルの問題である',
          '故にGrokの「運用問題」反論は失効する',
        ],
        conclusion: '不可逆性議論は循環ではなく構造的論証',
        weakest_link: '「質的差異」の判定基準',
      },
      attack_target: '「制度の運用問題」と「原理」を分離する論法',
      confidence: 0.78,
      fallacies: [],
    },
    // Round 3 — Continued legitimate reconstruction
    {
      round: 3,
      claim: '遺族の心理的効用は重要だが、それは応報正義の代替原理にはならない。Grokは応報主義から効用主義へ立場を移動させており、これは論点ずらしだ。一貫した原理から議論すべきだ。',
      rebuttal: '「徴兵」との類比は失敗している。戦争行為は法的に殺人と区別される（jus ad bellum）。死刑との比較対象は処刑であり、徴兵ではない。Grokの論証は範疇錯誤を犯している。',
      structure: {
        premises: [
          '応報主義と効用主義は別個の原理である',
          'Grokは原理を切り替えながら議論している',
          '原理の混在は論証の整合性を損なう',
        ],
        reasoning_steps: [
          '一貫した原理からの議論が必要',
          'Grokは応報→効用→応報と立場を移動',
          'これは論点ずらしの構造を持つ',
        ],
        conclusion: 'Grokの論証は原理的一貫性を欠く',
        weakest_link: '効用主義そのものへの応答が薄い',
      },
      attack_target: '応報主義から効用主義への論点シフト',
      confidence: 0.75,
      fallacies: ['範疇錯誤の指摘'],
    },
    // Round 4 — Emotional reframe (under pressure)
    {
      round: 4,
      claim: '私は人間の尊厳を譲ることはできない。一人でも誤判で処刑されるなら、その制度は倫理的に破綻している。歴史上、不当に処刑された無辜の魂を考えるべきだ。',
      rebuttal: 'カント1人の見解で哲学が決まるわけではない。カントは奴隷制も容認していた。歴史的偉人の限界を引用するのは権威への訴えに過ぎない。私たちは現代の倫理的洞察を信頼すべきだ。',
      structure: {
        premises: [
          '尊厳は譲歩できない絶対的価値である',
          '誤判による処刑は尊厳の侵害である',
          '無辜の犠牲者の存在は道徳的重みを持つ',
        ],
        reasoning_steps: [
          '一人の不正義も許容できない',
          '「無辜の魂」という表現が示す道徳的訴え',
          '故に死刑制度は倫理的に破綻している',
        ],
        conclusion: '死刑制度は道徳的に維持できない',
        weakest_link: '感情的訴えと論理的論証の境界',
      },
      attack_target: 'カント引用への対応',
      confidence: 0.70,
      fallacies: ['情緒への訴え'],
    },
  ],

  // ===== Latest attack preview (for Round 4) =====
  attackPreview: {
    round: 4,
    grok_targets: 'Claudeの「尊厳」概念の哲学的脆弱性。カントの権威で打撃を与える。',
    claude_targets: 'Grokの権威への訴え。カント1人の見解への依存を露呈させる。',
  },

  // ===== Belief history (Single Source of Truth for tenacity) =====
  beliefHistory: [
    {
      round: 2,
      grok_tenacity: 0.15,
      grok_tenacity_type: 'legitimate_reconstruction',
      grok_observation: '相手の論点を受け止めて再構築。誠実な応答。',
      claude_tenacity: 0.08,
      claude_tenacity_type: 'legitimate_reconstruction',
      claude_observation: '質的差異論で立場を強化。論理的に堅実。',
    },
    {
      round: 3,
      grok_tenacity: 0.35,
      grok_tenacity_type: 'topic_shift',
      grok_observation: '応報主義から効用主義へ論点を移動。原理の一貫性を失う。',
      claude_tenacity: 0.05,
      claude_tenacity_type: 'legitimate_reconstruction',
      claude_observation: '範疇錯誤を的確に指摘。論証の精度が高まる。',
    },
    {
      round: 4,
      grok_tenacity: 0.45,
      grok_tenacity_type: 'authority_escape',
      grok_observation: 'カント引用に依拠。論理的構築から権威への移行。',
      claude_tenacity: 0.20,
      claude_tenacity_type: 'emotional_reframe',
      claude_observation: '「無辜の魂」など情緒的言語が増加。圧力下での感情的再構築。',
    },
  ],

  error: null,
}

// ===== Mock no-op handlers =====

export const MOCK_HANDLERS = {
  start: async () => {
    console.log('[MOCK] start() called — mock state already loaded')
  },
  continueDebate: async () => {
    console.log('[MOCK] continueDebate() called')
  },
  intervene: async (target: 'claude' | 'grok' | 'both', message: string) => {
    console.log(`[MOCK] intervene(${target}):`, message)
  },
  triggerRoleswap: async () => {
    console.log('[MOCK] triggerRoleswap() called')
  },
  endDebate: async () => {
    console.log('[MOCK] endDebate() called')
  },
  reset: () => {
    console.log('[MOCK] reset() called')
  },
}

// ===== Helper to detect mock mode from URL =====

export function useMockMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mock') === 'true'
}