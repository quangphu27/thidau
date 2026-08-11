"""Scratch-like block puzzle: catalog, public pieces, answer matching."""
from __future__ import annotations

import json
import random
from typing import Any

from app.utils import extract_number, match_numeric_answer

# hat = sự kiện (mũ), cblock = khối C chứa khối con
CATALOG: dict[str, dict[str, Any]] = {
    "event_flag": {
        "label": "khi bấm cờ",
        "color": "#ffbf00",
        "shape": "hat",
        "params": [],
    },
    "event_clicked": {
        "label": "khi nhân vật này được bấm",
        "color": "#ffbf00",
        "shape": "hat",
        "params": [],
    },
    "motion_move": {
        "label": "di chuyển {0} bước",
        "color": "#4c97ff",
        "shape": "stack",
        "params": [{"key": "n", "placeholder": "số"}],
    },
    "motion_turn_right": {
        "label": "xoay phải {0} độ",
        "color": "#4c97ff",
        "shape": "stack",
        "params": [{"key": "n", "placeholder": "độ"}],
    },
    "motion_turn_left": {
        "label": "xoay trái {0} độ",
        "color": "#4c97ff",
        "shape": "stack",
        "params": [{"key": "n", "placeholder": "độ"}],
    },
    "motion_change_x": {
        "label": "thay đổi x một lượng {0}",
        "color": "#4c97ff",
        "shape": "stack",
        "params": [{"key": "n", "placeholder": "x"}],
    },
    "motion_change_y": {
        "label": "thay đổi y một lượng {0}",
        "color": "#4c97ff",
        "shape": "stack",
        "params": [{"key": "n", "placeholder": "y"}],
    },
    "motion_goto": {
        "label": "đi tới x: {0} y: {1}",
        "color": "#4c97ff",
        "shape": "stack",
        "params": [
            {"key": "x", "placeholder": "x"},
            {"key": "y", "placeholder": "y"},
        ],
    },
    "control_repeat": {
        "label": "lặp lại {0} lần",
        "color": "#ffab19",
        "shape": "cblock",
        "params": [{"key": "n", "placeholder": "lần"}],
    },
    "control_forever": {
        "label": "lặp mãi mãi",
        "color": "#ffab19",
        "shape": "cblock",
        "params": [],
    },
    "control_wait": {
        "label": "đợi {0} giây",
        "color": "#ffab19",
        "shape": "stack",
        "params": [{"key": "n", "placeholder": "giây"}],
    },
    "pen_down": {
        "label": "đặt bút",
        "color": "#0fbd8c",
        "shape": "stack",
        "params": [],
    },
    "pen_up": {
        "label": "nhấc bút",
        "color": "#0fbd8c",
        "shape": "stack",
        "params": [],
    },
    "pen_clear": {
        "label": "xóa tất cả",
        "color": "#0fbd8c",
        "shape": "stack",
        "params": [],
    },
    "looks_say": {
        "label": "nói {0}",
        "color": "#9966ff",
        "shape": "stack",
        "params": [{"key": "text", "placeholder": "chữ"}],
    },
}


def parse_blocks_json(raw: Any) -> list[dict]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return raw.get("script") or []
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("script") or []
    return []


def dumps_script(script: list) -> str:
    return json.dumps({"script": script or []}, ensure_ascii=False)


def _walk(nodes: list[dict], out: list[dict]) -> None:
    for n in nodes or []:
        if not isinstance(n, dict):
            continue
        out.append(n)
        _walk(n.get("children") or [], out)


def flatten_blocks(script: list[dict]) -> list[dict]:
    out: list[dict] = []
    _walk(script, out)
    return out


def public_pieces(script: list[dict], *, shuffle: bool = True) -> list[dict]:
    """Shuffled block tiles without correct numbers."""
    pieces = []
    for i, node in enumerate(flatten_blocks(script)):
        kind = node.get("kind") or ""
        meta = CATALOG.get(kind) or {
            "label": kind,
            "color": "#888",
            "shape": "stack",
            "params": [],
        }
        params = node.get("params") or []
        blanks = []
        for j, p in enumerate(params):
            if isinstance(p, dict) and p.get("blank"):
                blanks.append(
                    {
                        "index": j,
                        "key": p.get("key") or f"p{j}",
                        "placeholder": (meta.get("params") or [{}])[j].get("placeholder")
                        if j < len(meta.get("params") or [])
                        else "?",
                    }
                )
        pieces.append(
            {
                "uid": node.get("id") or f"p{i}",
                "kind": kind,
                "label": meta.get("label") or kind,
                "color": meta.get("color") or "#888",
                "shape": meta.get("shape") or "stack",
                "blanks": blanks,
            }
        )
    if shuffle:
        random.shuffle(pieces)
    return pieces


def _norm_param(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        value = value.get("value")
    s = str(value or "").strip()
    n = extract_number(s)
    if n is not None:
        if abs(n - round(n)) < 1e-9:
            return str(int(round(n)))
        return str(n)
    return s.lower()


def _param_values(node: dict) -> list[str]:
    vals = []
    for p in node.get("params") or []:
        if isinstance(p, dict):
            vals.append(_norm_param(p.get("value")))
        else:
            vals.append(_norm_param(p))
    return vals


def canonicalize(script: list[dict]) -> list[dict]:
    out = []
    for n in script or []:
        if not isinstance(n, dict):
            continue
        kind = n.get("kind") or ""
        item = {
            "kind": kind,
            "params": _param_values(n),
            "children": canonicalize(n.get("children") or []),
        }
        out.append(item)
    return out


def _params_match(expected: list[str], got: list[str], blanks_mask: list[bool]) -> bool:
    # Only compare params that were blanks in the solution; others ignored if not blank
    if not blanks_mask:
        # no blanks → kinds-only for those params; still require same length if expected empty
        return True
    if len(got) < len(expected):
        got = got + [""] * (len(expected) - len(got))
    for i, must in enumerate(blanks_mask):
        if not must:
            continue
        exp = expected[i] if i < len(expected) else ""
        g = got[i] if i < len(got) else ""
        if extract_number(exp) is not None:
            if not match_numeric_answer(g, [exp]):
                return False
        elif g != exp:
            return False
    return True


def _blank_mask(node: dict) -> list[bool]:
    mask = []
    for p in node.get("params") or []:
        if isinstance(p, dict):
            mask.append(bool(p.get("blank")))
        else:
            mask.append(False)
    return mask


def match_script(solution: list[dict], student: list[dict]) -> bool:
    """True if student assembled the same kinds/nesting and filled blank numbers."""
    if not solution:
        return False

    def rec(sol_nodes: list[dict], stu_nodes: list[dict]) -> bool:
        if len(sol_nodes) != len(stu_nodes or []):
            return False
        for s, t in zip(sol_nodes, stu_nodes or []):
            if not isinstance(t, dict):
                return False
            if (s.get("kind") or "") != (t.get("kind") or ""):
                return False
            if not _params_match(_param_values(s), _param_values(t), _blank_mask(s)):
                return False
            if not rec(s.get("children") or [], t.get("children") or []):
                return False
        return True

    return rec(solution, student)


SAMPLE_CIRCLE_SCRIPT: list[dict] = [
    {"id": "h1", "kind": "event_flag", "params": [], "children": []},
    {"id": "p1", "kind": "pen_down", "params": [], "children": []},
    {
        "id": "r1",
        "kind": "control_repeat",
        "params": [{"key": "n", "value": "360", "blank": True}],
        "children": [
            {
                "id": "m1",
                "kind": "motion_move",
                "params": [{"key": "n", "value": "2", "blank": True}],
            },
            {
                "id": "t1",
                "kind": "motion_turn_right",
                "params": [{"key": "n", "value": "1", "blank": True}],
            },
        ],
    },
]

SAMPLE_CIRCLE_CONTENT = (
    "Ghép các khối Scratch để vẽ hình tròn: khi bấm cờ → đặt bút → "
    "lặp lại □ lần, bên trong di chuyển □ bước rồi xoay phải □ độ."
)


def student_script_from_payload(data: Any) -> list[dict]:
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return []
    if isinstance(data, dict):
        data = data.get("script") or data.get("blocks") or []
    if not isinstance(data, list):
        return []
    return data
