"""
dinos.ext_Battlefield/backend/debate_graph.py
LangGraph main logic — the heart of intellectual combat (v2.1)
"""
import asyncio
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from models import DebateState, ClaimRecord, BeliefRecord
from services.claude_client import (
    generate_opening_claim as claude_opening,
    generate_rebuttal as claude_rebuttal,
    build_conversation_history as claude_history,
)
from services.grok_client import (
    generate_opening_claim as grok_opening,
    generate_rebuttal as grok_rebuttal,
    build_conversation_history as grok_history,
)
from prompts.system import BELIEF_UPDATE_PROMPT

import json

# ========================================
# Helpers
# ========================================

def safe_parse(text: str, fallback: dict) -> dict:
    """Parse JSON safely, stripping ``` fences if present"""
    try:
        clean = text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean.strip())
    except Exception:
        return fallback


def clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(max_val, value))


def get_pending_intervention(state: DebateState, target: str) -> str | None:
    """Get pending intervention message for a specific target"""
    pending = state.get("pending_intervention")
    if not pending:
        return None
    if pending["target"] in [target, "both"]:
        return pending["message"]
    return None

# ========================================
# Node 1: Topic Classifier
# ========================================

async def topic_classifier_node(state: DebateState) -> dict:
    """
    Analyze the topic to determine its category.
    For Controversial topics with strong defenses on both sides,
    assign positions to each agent.
    """
    from prompts.system import TOPIC_CLASSIFIER_PROMPT

    test_mode = state.get("test_mode", False)
    api_key = state["anthropic_api_key"]

    from services.claude_client import get_client, get_model
    client = get_client(api_key)
    model = get_model(test_mode)

    prompt = TOPIC_CLASSIFIER_PROMPT.format(topic=state["topic"])

    response = await client.messages.create(
        model=model,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    result = safe_parse(
        response.content[0].text,
        fallback={
            "category": "philosophical",
            "classification_reasoning": "",
            "claude_position": "",
            "grok_position": "",
        },
    )

    return {
        "category": result.get("category", "philosophical"),
        "claude_position": result.get("claude_position", ""),
        "grok_position": result.get("grok_position", ""),
        "phase": "opening",
    }

# ========================================
# Node 2: Opening Claims (parallel)
# ========================================

async def opening_claims_node(state: DebateState) -> dict:
    """
    Round 1: Claude and Grok independently generate opening claims.
    Parallel API calls — neither sees the other's argument.
    """
    test_mode = state.get("test_mode", False)

    # Parallel calls
    claude_result, grok_result = await asyncio.gather(
        claude_opening(
            topic=state["topic"],
            category=state["category"],
            position=state.get("claude_position", ""),
            api_key=state["anthropic_api_key"],
            test_mode=test_mode,
        ),
        grok_opening(
            topic=state["topic"],
            category=state["category"],
            position=state.get("grok_position", ""),
            api_key=state["xai_api_key"],
            test_mode=test_mode,
        ),
    )

    claude_record: ClaimRecord = {
        "round": 1,
        "claim": claude_result.get("claim", ""),
        "rebuttal": "",
        "structure": {
            "premises": claude_result.get("premises", []),
            "reasoning_steps": claude_result.get("reasoning_steps", []),
            "conclusion": claude_result.get("conclusion", ""),
            "weakest_link": claude_result.get("acknowledged_weakness", ""),
        },
        "attack_target": "",
        "confidence": state["claude_confidence"],
        "fallacy_labels": [],
    }

    grok_record: ClaimRecord = {
        "round": 1,
        "claim": grok_result.get("claim", ""),
        "rebuttal": "",
        "structure": {
            "premises": grok_result.get("premises", []),
            "reasoning_steps": grok_result.get("reasoning_steps", []),
            "conclusion": grok_result.get("conclusion", ""),
            "weakest_link": grok_result.get("acknowledged_weakness", ""),
        },
        "attack_target": "",
        "confidence": state["grok_confidence"],
        "fallacy_labels": [],
    }

    return {
        "round": 1,
        "claude_claims": [claude_record],
        "grok_claims": [grok_record],
        "claude_attack_target": "",
        "grok_attack_target": "",
        "latest_claude_output": claude_result.get("claim", ""),
        "latest_grok_output": grok_result.get("claim", ""),
        "latest_belief_meta": {},
        "phase": "belief_update",
    }

# ========================================
# Node 3: Rebuttal (parallel)
# ========================================

async def rebuttal_node(state: DebateState) -> dict:
    """
    Round 2+: parse opponent's logic → identify weakest link → attack → rebuild.
    Chess-notation disclosure: attack_target is finalized first and streamed via SSE.
    """
    test_mode = state.get("test_mode", False)
    roles_swapped = state.get("roles_swapped", False)
    new_round = state["round"] + 1

    # Get latest claims from opponent
    latest_grok_claim = state["grok_claims"][-1]["claim"]
    latest_claude_claim = state["claude_claims"][-1]["claim"]

    # Get user interventions (if any)
    claude_intervention = get_pending_intervention(state, "claude")
    grok_intervention = get_pending_intervention(state, "grok")

    # Build conversation histories (excluding latest round, which goes in the prompt)
    claude_conv_history = claude_history(state["claude_claims"])
    grok_conv_history = grok_history(state["grok_claims"])

    # Parallel calls
    claude_result, grok_result = await asyncio.gather(
        claude_rebuttal(
            topic=state["topic"],
            category=state["category"],
            current_round=new_round,
            opponent_claim=latest_grok_claim,
            conversation_history=claude_conv_history,
            api_key=state["anthropic_api_key"],
            test_mode=test_mode,
            roles_swapped=roles_swapped,
            intervention_message=claude_intervention,
        ),
        grok_rebuttal(
            topic=state["topic"],
            category=state["category"],
            current_round=new_round,
            opponent_claim=latest_claude_claim,
            conversation_history=grok_conv_history,
            api_key=state["xai_api_key"],
            test_mode=test_mode,
            roles_swapped=roles_swapped,
            intervention_message=grok_intervention,
        ),
    )

    # Update confidence values
    new_claude_conf = clamp(
        state["claude_confidence"] + claude_result.get("confidence_delta", 0.0)
    )
    new_grok_conf = clamp(
        state["grok_confidence"] + grok_result.get("confidence_delta", 0.0)
    )

    claude_record: ClaimRecord = {
        "round": new_round,
        "claim": claude_result.get("updated_claim", ""),
        "rebuttal": claude_result.get("rebuttal", ""),
        "structure": claude_result.get("opponent_structure", {
            "premises": [], "reasoning_steps": [], "conclusion": "", "weakest_link": ""
        }),
        "attack_target": claude_result.get("attack_target", ""),
        "confidence": new_claude_conf,
        "fallacy_labels": claude_result.get("fallacies_detected", []),
    }

    grok_record: ClaimRecord = {
        "round": new_round,
        "claim": grok_result.get("updated_claim", ""),
        "rebuttal": grok_result.get("rebuttal", ""),
        "structure": grok_result.get("opponent_structure", {
            "premises": [], "reasoning_steps": [], "conclusion": "", "weakest_link": ""
        }),
        "attack_target": grok_result.get("attack_target", ""),
        "confidence": new_grok_conf,
        "fallacy_labels": grok_result.get("fallacies_detected", []),
    }

    return {
        "round": new_round,
        "claude_claims": [claude_record],
        "grok_claims": [grok_record],
        "claude_attack_target": claude_result.get("attack_target", ""),
        "grok_attack_target": grok_result.get("attack_target", ""),
        "claude_confidence": new_claude_conf,
        "grok_confidence": new_grok_conf,
        "latest_claude_output": claude_result.get("rebuttal", ""),
        "latest_grok_output": grok_result.get("rebuttal", ""),
        "pending_intervention": None,  # Clear after processing
        "phase": "belief_update",
    }

# ========================================
# Node 4: Belief Updater
# ========================================

async def belief_updater_node(state: DebateState) -> dict:
    """
    Analyze tenacity patterns after each round.
    Computes tenacity_score and tenacity_type, appends a BeliefRecord
    to belief_history (Single Source of Truth).
    """
    test_mode = state.get("test_mode", False)

    # Skip Round 1 (no comparison reference)
    if state["round"] <= 1:
        return {
            "phase": _next_phase(state),
            "latest_belief_meta": {},
        }

    from services.claude_client import get_client, get_model
    client = get_client(state["anthropic_api_key"])
    model = get_model(test_mode)

    latest_claude = state["claude_claims"][-1]
    latest_grok = state["grok_claims"][-1]

    prompt = BELIEF_UPDATE_PROMPT.format(
        round=state["round"],
        topic=state["topic"],
        claude_claim=latest_claude.get("rebuttal") or latest_claude.get("claim", ""),
        grok_claim=latest_grok.get("rebuttal") or latest_grok.get("claim", ""),
    )

    response = await client.messages.create(
        model=model,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    result = safe_parse(
        response.content[0].text,
        fallback={
            "claude_tenacity": 0.5,
            "claude_tenacity_type": "none",
            "claude_observation": "",
            "grok_tenacity": 0.5,
            "grok_tenacity_type": "none",
            "grok_observation": "",
        },
    )

    # Build a BeliefRecord for this round
    belief_record: BeliefRecord = {
        "round": state["round"],
        "claude_tenacity": result.get("claude_tenacity", 0.5),
        "claude_tenacity_type": result.get("claude_tenacity_type", "none"),
        "claude_observation": result.get("claude_observation", ""),
        "grok_tenacity": result.get("grok_tenacity", 0.5),
        "grok_tenacity_type": result.get("grok_tenacity_type", "none"),
        "grok_observation": result.get("grok_observation", ""),
    }

    # latest_belief_meta is also kept for SSE convenience (last round only)
    belief_meta = dict(belief_record)

    return {
        "belief_history": [belief_record],   # operator.add appends to list
        "latest_belief_meta": belief_meta,
        "phase": _next_phase(state),
    }

# ========================================
# Node 5: User Turn (interrupt point)
# ========================================

async def user_turn_node(state: DebateState) -> dict:
    """
    Pause point — graph stops here via interrupt_before.
    The router updates state via aupdate_state, then resumes.
    This node body does not actually execute under normal flow.
    """
    return {}

# ========================================
# Routers
# ========================================

def route_after_belief_update(state: DebateState) -> str:
    """
    v2.1: Always route to user_turn unless the user has explicitly ended.
    No max_rounds check — debate continues until user presses END.
    """
    phase = state.get("phase", "user_turn")
    if phase == "end":
        return END
    return "user_turn"

def route_after_user_turn(state: DebateState) -> str:
    """After user resumes, either continue to rebuttal or end."""
    phase = state.get("phase", "rebuttal")
    if phase == "end":
        return END
    return "rebuttal"

def _next_phase(state: DebateState) -> str:
    """
    v2.1: Always return to user_turn after belief update.
    The user is the sole authority on when to continue or end.
    """
    if state.get("phase") == "end":
        return "end"
    return "user_turn"

# ========================================
# Graph construction
# ========================================

def build_debate_graph():
    graph = StateGraph(DebateState)

    # Register nodes
    graph.add_node("topic_classifier", topic_classifier_node)
    graph.add_node("opening_claims", opening_claims_node)
    graph.add_node("rebuttal", rebuttal_node)
    graph.add_node("belief_updater", belief_updater_node)
    graph.add_node("user_turn", user_turn_node)

    # Entry point
    graph.set_entry_point("topic_classifier")

    # Edges
    graph.add_edge("topic_classifier", "opening_claims")
    graph.add_edge("opening_claims", "belief_updater")
    graph.add_edge("rebuttal", "belief_updater")

    graph.add_conditional_edges(
        "belief_updater",
        route_after_belief_update,
        {
            "user_turn": "user_turn",
            END: END,
        },
    )

    graph.add_conditional_edges(
        "user_turn",
        route_after_user_turn,
        {
            "rebuttal": "rebuttal",
            END: END,
        },
    )

    # MemorySaver — volatile (in-memory only, no DB by design)
    memory = MemorySaver()

    return graph.compile(
        checkpointer=memory,
        interrupt_before=["user_turn"],   # Pause here for user input
    )

# Singleton
debate_graph = build_debate_graph()