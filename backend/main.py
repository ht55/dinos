"""
dinos.ext_Battlefield/backend/main.py
FastAPI entry point + SSE streaming (v2.1)
"""
import os
import uuid
import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from models import (
    DebateState,
    StartDebateRequest,
    InterventionRequest,
    DebateSessionResponse,
    SessionStatusResponse,
)
from debate_graph import debate_graph

load_dotenv()


# ========================================
# App initialization
# ========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("⚔️  dinos.ext_Battlefield — backend starting...")
    yield
    print("💨  dinos.ext_Battlefield — backend shutting down...")


app = FastAPI(
    title="dinos.ext_Battlefield API",
    description="Intellectual combat platform — Claude vs Grok",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active sessions — volatile (in-memory only, no DB by design)
active_sessions: dict[str, dict] = {}


# ========================================
# SSE helper
# ========================================

def sse(event: str, data: dict) -> str:
        if data is None:
            data = {}
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ========================================
# SSE stream
# ========================================

async def stream_session(session_id: str) -> AsyncGenerator[str, None]:
    print(f"🔍 stream_session called for {session_id}")

    session = active_sessions.get(session_id)
    if not session:
        yield sse("error", {"message": "Session not found"})
        return

    config = {"configurable": {"thread_id": session_id}}

    try:
        input_state = session.pop("initial_state", None)
        print(f"🚀 Starting/Resuming with input_state: {bool(input_state)}")

        async for chunk in debate_graph.astream(
            input_state,
            config=config,
            stream_mode="updates",
        ):
            print(f"📦 chunk: {list(chunk.keys())}")
            for node_name, node_output in chunk.items():
                print(f"  → node: {node_name}")

                # Topic Classifier
                if node_name == "topic_classifier":
                    yield sse("category_detected", {
                        "category": node_output.get("category", ""),
                        "claude_position": node_output.get("claude_position", ""),
                        "grok_position": node_output.get("grok_position", ""),
                    })

                # Opening Claims
                elif node_name == "opening_claims":
                    claude_claims = node_output.get("claude_claims", [])
                    grok_claims = node_output.get("grok_claims", [])

                    if claude_claims and grok_claims:
                        c = claude_claims[0]
                        g = grok_claims[0]
                        active_sessions[session_id]["current_round"] = 1

                        yield sse("opening_round", {
                            "round": 1,
                            "claude": _claim_payload(c),
                            "grok": _claim_payload(g),
                        })

                # Rebuttal
                elif node_name == "rebuttal":
                    current_round = node_output.get("round", 0)
                    active_sessions[session_id]["current_round"] = current_round

                    claude_claims = node_output.get("claude_claims", [])
                    grok_claims = node_output.get("grok_claims", [])

                    if claude_claims and grok_claims:
                        c = claude_claims[-1]
                        g = grok_claims[-1]

                        yield sse("rebuttal_round", {
                            "round": current_round,
                            "claude": _claim_payload(c),
                            "grok": _claim_payload(g),
                            "claude_attack_target": node_output.get("claude_attack_target", ""),
                            "grok_attack_target": node_output.get("grok_attack_target", ""),
                            "claude_confidence": node_output.get("claude_confidence", 0.8),
                            "grok_confidence": node_output.get("grok_confidence", 0.8),
                        })

                # Belief Updater
                elif node_name == "belief_updater":
                    meta = node_output.get("latest_belief_meta", {})
                    if meta:
                        yield sse("belief_update", {
                            "round": meta.get("round", _get_current_round(session_id)),
                            "claude_tenacity": meta.get("claude_tenacity", 0.5),
                            "claude_tenacity_type": meta.get("claude_tenacity_type", "none"),
                            "claude_observation": meta.get("claude_observation", ""),
                            "grok_tenacity": meta.get("grok_tenacity", 0.5),
                            "grok_tenacity_type": meta.get("grok_tenacity_type", "none"),
                            "grok_observation": meta.get("grok_observation", ""),
                        })

                    phase = node_output.get("phase", "")
                    if phase == "user_turn":
                        print(f"✅ AWAITING_USER at round {_get_current_round(session_id)}")
                        yield sse("awaiting_user", {
                            "round": _get_current_round(session_id),
                            "options": ["continue", "intervene", "roleswap", "end"],
                        })
                    elif phase == "end":
                        yield sse("debate_end", {
                            "total_rounds": _get_current_round(session_id),
                            "message": "The debate concludes. What did YOU decide?",
                        })

        print("✨ Stream ended naturally")
        yield sse("stream_complete", {"session_id": session_id})

    except Exception as e:
        error_msg = str(e).lower()
        print(f"💥 [STREAM] Exception caught: {type(e).__name__}")

        # 正常なinterrupt（user_turnで止まる）はerror扱いしない
        if any(k in error_msg for k in ["interrupt", "user_turn", "checkpoint", "break", "stop", "paused"]):
            print("🛑 Normal interrupt at user_turn — sending awaiting_user and stopping stream")
            current_round = _get_current_round(session_id) or 1
            yield sse("awaiting_user", {
                "round": current_round,
                "options": ["continue", "intervene", "roleswap", "end"],
            })
            return  # ← これで余計なイベントを止める

        # 本当に異常なエラーの場合のみ
        print("❌ Unexpected real error")
        import traceback
        traceback.print_exc()
        yield sse("error", {"message": str(e)})


def _claim_payload(claim: dict) -> dict:
    """Build a JSON-safe claim payload for the frontend."""
    return {
        "round": claim.get("round", 0),
        "claim": claim.get("claim", ""),
        "rebuttal": claim.get("rebuttal", ""),
        "structure": claim.get("structure", {}),
        "attack_target": claim.get("attack_target", ""),
        "confidence": claim.get("confidence", 0.8),
        "fallacy_labels": claim.get("fallacy_labels", []),
    }


def _get_current_round(session_id: str) -> int:
    """Get current round from session metadata."""
    session = active_sessions.get(session_id, {})
    return session.get("current_round", 0)


# ========================================
# Endpoints
# ========================================

@app.post("/debate/start", response_model=DebateSessionResponse)
async def start_debate(req: StartDebateRequest):
    """
    Initialize a new debate session.
    The graph does NOT start here — it starts when the client connects to /stream.
    This separation is needed because /stream needs to be the consumer of the graph events.
    """
    session_id = str(uuid.uuid4())

    initial_state: DebateState = {
        # Setup
        "topic": req.topic,
        "category": "philosophical",      # placeholder, classifier will overwrite
        "round": 0,
        "test_mode": req.test_mode,

        # BYOK
        "anthropic_api_key": req.api_keys.anthropic_api_key,
        "xai_api_key": req.api_keys.xai_api_key,

        # Positions (assigned by classifier for controversial topics)
        "claude_position": "",
        "grok_position": "",

        # Agent records
        "claude_claims": [],
        "grok_claims": [],

        # Belief history (Single Source of Truth for tenacity)
        "belief_history": [],

        # Attack strategies
        "claude_attack_target": "",
        "grok_attack_target": "",

        # Confidence (initial values)
        "claude_confidence": 0.8,
        "grok_confidence": 0.8,

        # User interventions
        "user_interventions": [],
        "pending_intervention": None,

        # Phase management
        "phase": "setup",
        "roles_swapped": False,

        # SSE streaming
        "latest_claude_output": "",
        "latest_grok_output": "",
        "latest_belief_meta": {},
    }

    # Save session metadata (volatile)
    # initial_state is stored here and consumed on first /stream connection.
    active_sessions[session_id] = {
        "topic": req.topic,
        "test_mode": req.test_mode,
        "current_round": 0,
        "initial_state": initial_state,
    }

    return DebateSessionResponse(
        session_id=session_id,
        topic=req.topic,
        category="",   # determined after classifier runs (visible via /stream)
        status="created",
    )


@app.get("/debate/{session_id}/stream")
async def stream_debate(session_id: str):
    """
    Stream debate events via SSE.
    First connection: starts the graph from initial_state.
    Subsequent connections: resume from checkpoint after continue/intervene/roleswap.
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        stream_session(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",      # For Nginx / Railway
            "Connection": "keep-alive",
        },
    )


@app.post("/debate/{session_id}/continue")
async def continue_debate(session_id: str):
    """
    Resume from awaiting_user state — the next /stream connection will execute one rebuttal round.
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}

    await debate_graph.aupdate_state(
        config,
        {"phase": "rebuttal"},
        as_node="user_turn",
    )

    return {"status": "continuing"}


@app.post("/debate/{session_id}/intervene")
async def intervene(session_id: str, req: InterventionRequest):
    """
    Inject a user intervention into the next rebuttal round.
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}
    current_round = active_sessions[session_id].get("current_round", 0)

    intervention = {
        "round": current_round,
        "target": req.target,
        "message": req.message,
    }

    await debate_graph.aupdate_state(
        config,
        {
            "pending_intervention": intervention,
            "user_interventions": [intervention],
            "phase": "rebuttal",
        },
        as_node="user_turn",
    )

    return {"status": "intervention_queued", "target": req.target}


@app.post("/debate/{session_id}/roleswap")
async def roleswap(session_id: str):
    """
    Toggle roles_swapped and immediately advance to a rebuttal round.
    Pattern X: immediate execution.
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}
    state = await debate_graph.aget_state(config)
    current_swapped = state.values.get("roles_swapped", False)

    await debate_graph.aupdate_state(
        config,
        {
            "roles_swapped": not current_swapped,
            "phase": "rebuttal",
        },
        as_node="user_turn",
    )

    return {
        "status": "roleswap_activated",
        "roles_swapped": not current_swapped,
    }


@app.post("/debate/{session_id}/end")
async def end_debate(session_id: str):
    """
    Terminate the session. All data is discarded — only your memory remains.
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Try to mark the graph as ended (may fail if already terminated)
    try:
        config = {"configurable": {"thread_id": session_id}}
        await debate_graph.aupdate_state(
            config,
            {"phase": "end"},
            as_node="user_turn",
        )
    except Exception:
        pass

    del active_sessions[session_id]

    return {
        "status": "ended",
        "message": "All data discarded. The debate lives only in your memory.",
    }


@app.get("/debate/{session_id}/status", response_model=SessionStatusResponse)
async def get_status(session_id: str):
    """Current session state snapshot."""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}
    state = await debate_graph.aget_state(config)
    v = state.values

    return SessionStatusResponse(
        session_id=session_id,
        topic=v.get("topic", ""),
        category=v.get("category", ""),
        round=v.get("round", 0),
        phase=v.get("phase", ""),
        roles_swapped=v.get("roles_swapped", False),
        claude_confidence=v.get("claude_confidence", 0.8),
        grok_confidence=v.get("grok_confidence", 0.8),
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "dinos.ext_Battlefield",
    }