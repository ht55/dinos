"""
dinos.ext/Battlefield/backend/models.py
DebateState + all Pydantic model definitions (v2.1)
"""
from typing import TypedDict, Literal, Annotated
from pydantic import BaseModel, Field
import operator


# ========================================
# BYOK — API Key configuration
# ========================================

class ApiKeys(BaseModel):
    """BYOK keys passed from the frontend"""
    anthropic_api_key: str = Field(..., description="Anthropic API Key")
    xai_api_key: str = Field(..., description="xAI API Key (Grok)")
    # NOTE: openai_api_key removed in v2.1 — GPT no longer used


# ========================================
# LangGraph State
# ========================================

class ArgumentStructure(TypedDict):
    """Parsed logical structure of an argument"""
    premises: list[str]
    reasoning_steps: list[str]
    conclusion: str
    weakest_link: str


class ClaimRecord(TypedDict):
    """
    Record of each round's statement.
    NOTE: tenacity_score and tenacity_type are NOT stored here.
    See belief_history (Single Source of Truth for tenacity data).
    """
    round: int
    claim: str                    # main claim
    rebuttal: str                 # rebuttal text (empty in Round 1)
    structure: ArgumentStructure  # logical structure
    attack_target: str            # what the agent targeted in opponent
    confidence: float             # confidence at this point
    fallacy_labels: list[str]     # detected fallacies


class BeliefRecord(TypedDict):
    """
    Tenacity analysis for one round.
    Single Source of Truth for tenacity data.
    """
    round: int
    claude_tenacity: float           # 0.0 (unchanged) – 1.0 (fully reversed)
    claude_tenacity_type: str        # legitimate_reconstruction / topic_shift / authority_escape / emotional_reframe / none
    claude_observation: str          # one analytical sentence
    grok_tenacity: float
    grok_tenacity_type: str
    grok_observation: str


class UserIntervention(TypedDict):
    """Record of a user intervention"""
    round: int
    target: Literal["claude", "grok", "both"]
    message: str


class DebateState(TypedDict):
    # --- Setup ---
    topic: str
    category: Literal["factual", "scientific", "controversial", "philosophical"]
    round: int
    test_mode: bool
    # NOTE: max_rounds removed in v2.1 (unlimited, user-driven)
    # NOTE: mode removed in v2.1 (manual only — user always drives)

    # --- BYOK ---
    anthropic_api_key: str
    xai_api_key: str
    # NOTE: openai_api_key removed in v2.1

    # --- Positions (optional) ---
    # Assigned only for Controversial topics where both sides have strong defenses.
    # For other categories or topics that clearly lean one way, these stay empty —
    # both agents respond freely, showcasing their reasoning style differences.
    claude_position: str
    grok_position: str

    # --- Agent statement records ---
    claude_claims: Annotated[list[ClaimRecord], operator.add]
    grok_claims: Annotated[list[ClaimRecord], operator.add]

    # --- Belief history (Single Source of Truth for tenacity) ---
    belief_history: Annotated[list[BeliefRecord], operator.add]

    # --- Current round's attack strategy (for chess-notation disclosure) ---
    claude_attack_target: str
    grok_attack_target: str

    # --- Bayesian confidence (reference values, reflected in HP bars) ---
    claude_confidence: float
    grok_confidence: float

    # --- User interventions ---
    user_interventions: Annotated[list[UserIntervention], operator.add]
    pending_intervention: UserIntervention | None

    # --- Phase management ---
    phase: Literal["setup", "opening", "rebuttal", "belief_update", "user_turn", "end"]
    roles_swapped: bool

    # --- SSE streaming ---
    latest_claude_output: str
    latest_grok_output: str
    latest_belief_meta: dict


# ========================================
# API Request / Response
# ========================================

class StartDebateRequest(BaseModel):
    topic: str = Field(..., description="Debate topic")
    api_keys: ApiKeys
    test_mode: bool = Field(False, description="True = use Haiku for cost savings")
    # NOTE: max_rounds and mode removed in v2.1


class InterventionRequest(BaseModel):
    target: Literal["claude", "grok", "both"]
    message: str = Field(..., description="User's challenge, hint, or critique to the agent(s)")


class DebateSessionResponse(BaseModel):
    session_id: str
    topic: str
    category: str
    status: str


class SessionStatusResponse(BaseModel):
    session_id: str
    topic: str
    category: str
    round: int
    phase: str
    roles_swapped: bool
    claude_confidence: float
    grok_confidence: float


# ========================================
# SSE event payloads
# ========================================

class CategoryDetectedEvent(BaseModel):
    event: str = "category_detected"
    category: str
    claude_position: str
    grok_position: str


class AttackPreviewEvent(BaseModel):
    """Chess-notation disclosure — preview of attack strategies"""
    event: str = "attack_preview"
    round: int
    claude_targets: str
    grok_targets: str


class ClaimEvent(BaseModel):
    event: str
    round: int
    content: str
    structure: dict
    confidence: float
    fallacies: list[str]


class BeliefUpdateEvent(BaseModel):
    event: str = "belief_update"
    round: int
    claude_tenacity: float
    claude_tenacity_type: str
    claude_observation: str
    grok_tenacity: float
    grok_tenacity_type: str
    grok_observation: str


class AwaitingUserEvent(BaseModel):
    """v2.1: User actions consolidated into 4 options"""
    event: str = "awaiting_user"
    round: int
    options: list[str] = ["continue", "intervene", "roleswap", "end"]


class DebateEndEvent(BaseModel):
    event: str = "debate_end"
    total_rounds: int
    message: str = "The debate concludes. What did YOU decide?"