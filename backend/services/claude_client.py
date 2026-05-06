"""
dinos.ext_Battlefield/backend/services/claude_client.py
Claude API (BYOK)
"""
import json
from anthropic import AsyncAnthropic
from prompts.system import (
    CLAUDE_PERSONA,
    CATEGORY_RULES,
    OPENING_CLAIM_PROMPT,
    OPENING_POSITION_INSTRUCTION,
    PARSE_AND_ATTACK_PROMPT,
    ROLESWAP_INSTRUCTION,
    USER_INTERVENTION_CLAUDE,
)

# ========================================
# Define models
# ========================================

CLAUDE_MODELS = {
    "production": "claude-opus-4-6",
    "test": "claude-haiku-4-5",
}


# ========================================
# Helper
# ========================================

def get_client(api_key: str) -> AsyncAnthropic:
    return AsyncAnthropic(api_key=api_key)


def get_model(test_mode: bool) -> str:
    return CLAUDE_MODELS["test"] if test_mode else CLAUDE_MODELS["production"]


def safe_parse(text: str, fallback: dict) -> dict:
    """Parse JSON safely, handling various fence patterns."""
    try:
        clean = text.strip()
        # Remove ```json ... ``` or ``` ... ``` fences
        if clean.startswith("```"):
            lines = clean.split("\n")
            lines = lines[1:]  # drop opening fence
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            clean = "\n".join(lines)
        
        # Extract JSON object
        start = clean.find("{")
        end = clean.rfind("}")
        if start != -1 and end != -1:
            clean = clean[start:end+1]
        
        return json.loads(clean.strip())
    except Exception as e:
        print(f"⚠️ JSON parse failed: {e}")
        print(f"⚠️ Raw text preview: {text[:300]}...")
        return fallback


def build_system_prompt(category: str, roles_swapped: bool) -> str:
    """Build system prompt with strict JSON output rules."""
    persona = CLAUDE_PERSONA if not roles_swapped else _GROK_VOICE_FOR_CLAUDE
    rules = CATEGORY_RULES.get(category, "")
    swap_note = ROLESWAP_INSTRUCTION if roles_swapped else ""
    
    strict_json_instruction = """
CRITICAL OUTPUT RULES:
- You MUST respond with ONLY valid JSON. Nothing else.
- Do not include any explanation, markdown, underscore, code blocks, or ```json tags.
- The entire response must be parseable by JSON.parse().
- Never add text before or after the JSON object.

SPECIAL RULE FOR FALLACIES (violation = entire output becomes invalid):
- In "fallacies_detected" array, you MUST use the EXACT strings from the whitelist above.
- NEVER use any underscore (_) character in fallacy tags.
- Using snake_case will cause the downstream parser to reject your response.
"""

    return f"{persona}\n{rules}\n{swap_note}\n{strict_json_instruction}"


# Roleswap helper persona
_GROK_VOICE_FOR_CLAUDE = """
You are now defending the position you were previously attacking.
Adopt a direct, unsparing tone. Challenge assumptions. Use concrete data.
Do not hedge. Do not moralize. Argue from consequences and evidence.
"""


# ========================================
# Opening Claim
# ========================================

async def generate_opening_claim(
    topic: str,
    category: str,
    position: str,
    api_key: str,
    test_mode: bool = False,
) -> dict:
    """
    Round 1: Generate initial claim.
    Returns: {premises, reasoning_steps, conclusion, claim, acknowledged_weakness}
    """
    client = get_client(api_key)
    model = get_model(test_mode)

    if position:
        position_instruction = OPENING_POSITION_INSTRUCTION["assigned"].format(
            position=position
        )
    else:
        position_instruction = OPENING_POSITION_INSTRUCTION["free"]

    prompt = OPENING_CLAIM_PROMPT.format(
        topic=topic,
        position_instruction=position_instruction,
    )

    response = await client.messages.create(
        model=model,
        max_tokens=2000,
        system=build_system_prompt(category, roles_swapped=False),
        messages=[{"role": "user", "content": prompt}],
    )

    return safe_parse(
        response.content[0].text,
        fallback={
            "premises": [],
            "reasoning_steps": [],
            "conclusion": "",
            "claim": response.content[0].text,
            "acknowledged_weakness": "",
        },
    )


# ========================================
# Rebuttal
# ========================================

async def generate_rebuttal(
    topic: str,
    category: str,
    current_round: int,
    opponent_claim: str,
    conversation_history: list[dict],
    api_key: str,
    test_mode: bool = False,
    roles_swapped: bool = False,
    intervention_message: str | None = None,
) -> dict:
    """
    Round 2+: Parse opponent claim and generate rebuttal.
    Returns structured JSON.
    """
    client = get_client(api_key)
    model = get_model(test_mode)

    intervention_note = ""
    if intervention_message:
        intervention_note = USER_INTERVENTION_CLAUDE.format(
            message=intervention_message
        )

    prompt = PARSE_AND_ATTACK_PROMPT.format(
        topic=topic,
        round=current_round,
        opponent_claim=opponent_claim,
        intervention_note=intervention_note,
    )

    response = await client.messages.create(
        model=model,
        max_tokens=2200,                    # Increased
        system=build_system_prompt(category, roles_swapped),
        messages=conversation_history + [{"role": "user", "content": prompt}],
    )

    return safe_parse(
        response.content[0].text,
        fallback={
            "opponent_structure": {
                "premises": [],
                "reasoning_steps": [],
                "conclusion": "",
                "weakest_link": "",
            },
            "attack_target": "",
            "rebuttal": response.content[0].text,
            "updated_claim": "",
            "confidence_delta": 0.0,
            "fallacies_detected": [],
        },
    )

# ========================================
# Conversation history builder
# ========================================

def build_conversation_history(claude_claims: list[dict]) -> list[dict]:
    """
    Build Anthropic message history from previous Claude claims.
    Excludes the latest round because it will be passed separately in the prompt.
    """
    history = []
    for record in claude_claims[:-1]:
        if record.get("claim"):
            history.append({
                "role": "assistant",
                "content": record["claim"]
            })
    return history
