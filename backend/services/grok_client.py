"""
dinos.ext_Battlefield/backend/services/grok_client.py
Grok API client (BYOK, OpenAI compatible)
"""
import json
from openai import AsyncOpenAI
from prompts.system import (
    GROK_PERSONA,
    CATEGORY_RULES,
    OPENING_CLAIM_PROMPT,
    OPENING_POSITION_INSTRUCTION,
    PARSE_AND_ATTACK_PROMPT,
    ROLESWAP_INSTRUCTION,
    USER_INTERVENTION_GROK,
)

# ========================================
# Models
# ========================================

GROK_MODELS = {
    "production": "grok-4.3",
    "test": "grok-4-1-fast-reasoning",       
}

XAI_BASE_URL = "https://api.x.ai/v1"


# ========================================
# Helper
# ========================================

def get_client(api_key: str) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=api_key,
        base_url=XAI_BASE_URL,
    )


def get_model(test_mode: bool) -> str:
    return GROK_MODELS["test"] if test_mode else GROK_MODELS["production"]


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
        
        # Extract JSON object boundaries
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
    persona = GROK_PERSONA if not roles_swapped else _CLAUDE_VOICE_FOR_GROK
    rules = CATEGORY_RULES.get(category, "")
    swap_note = ROLESWAP_INSTRUCTION if roles_swapped else ""
    
    strict_json_instruction = """
CRITICAL OUTPUT RULES:
- You MUST respond with ONLY valid JSON. Nothing else.
- Do not include any explanation, markdown, code blocks, or ```json tags.
- The entire response must be parseable by JSON.parse().
- Never add text before or after the JSON object.
"""

    return f"{persona}\n{rules}\n{swap_note}\n{strict_json_instruction}"


# Roleswap helper persona
_CLAUDE_VOICE_FOR_GROK = """
You are now defending the position you were previously attacking.
Build your argument from first principles. Make your premises explicit.
Reason carefully from premises to conclusion. Acknowledge genuine uncertainty.
Do not bluster. Do not attack without foundation. Construct.
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

    response = await client.chat.completions.create(
        model=model,
        max_tokens=1800,                    # Increased for better quality
        messages=[
            {"role": "system", "content": build_system_prompt(category, roles_swapped=False)},
            {"role": "user", "content": prompt},
        ],
    )

    text = response.choices[0].message.content
    return safe_parse(
        text,
        fallback={
            "premises": [],
            "reasoning_steps": [],
            "conclusion": "",
            "claim": text,
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
        intervention_note = USER_INTERVENTION_GROK.format(
            message=intervention_message
        )

    prompt = PARSE_AND_ATTACK_PROMPT.format(
        topic=topic,
        round=current_round,
        opponent_claim=opponent_claim,
        intervention_note=intervention_note,
    )

    response = await client.chat.completions.create(
        model=model,
        max_tokens=2000,                    # Increased
        messages=[
            {"role": "system", "content": build_system_prompt(category, roles_swapped)},
            *conversation_history,
            {"role": "user", "content": prompt},
        ],
    )

    text = response.choices[0].message.content
    return safe_parse(
        text,
        fallback={
            "opponent_structure": {
                "premises": [],
                "reasoning_steps": [],
                "conclusion": "",
                "weakest_link": "",
            },
            "attack_target": "",
            "rebuttal": text,
            "updated_claim": "",
            "confidence_delta": 0.0,
            "fallacies_detected": [],
        },
    )


# ========================================
# Conversation history builder
# ========================================

def build_conversation_history(grok_claims: list[dict]) -> list[dict]:
    """
    Build OpenAI message history from previous Grok claims.
    Excludes the latest round because it will be passed separately in the prompt.
    """
    history = []
    for record in grok_claims[:-1]:
        if record.get("claim"):
            history.append({
                "role": "assistant",
                "content": record["claim"]
            })
    return history