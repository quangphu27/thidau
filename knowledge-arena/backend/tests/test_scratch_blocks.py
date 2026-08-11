from app.scratch_blocks import (
    SAMPLE_CIRCLE_SCRIPT,
    match_script,
    public_pieces,
    student_script_from_payload,
)


def test_match_circle_script_with_blanks():
    student = [
        {"kind": "event_flag", "params": [], "children": []},
        {"kind": "pen_down", "params": [], "children": []},
        {
            "kind": "control_repeat",
            "params": [{"key": "n", "value": "360", "blank": True}],
            "children": [
                {"kind": "motion_move", "params": [{"key": "n", "value": "2"}]},
                {"kind": "motion_turn_right", "params": [{"key": "n", "value": "1"}]},
            ],
        },
    ]
    assert match_script(SAMPLE_CIRCLE_SCRIPT, student)


def test_wrong_number_fails():
    student = [
        {"kind": "event_flag", "params": [], "children": []},
        {"kind": "pen_down", "params": [], "children": []},
        {
            "kind": "control_repeat",
            "params": [{"key": "n", "value": "180"}],
            "children": [
                {"kind": "motion_move", "params": [{"key": "n", "value": "2"}]},
                {"kind": "motion_turn_right", "params": [{"key": "n", "value": "1"}]},
            ],
        },
    ]
    assert not match_script(SAMPLE_CIRCLE_SCRIPT, student)


def test_wrong_order_fails():
    student = [
        {"kind": "pen_down", "params": [], "children": []},
        {"kind": "event_flag", "params": [], "children": []},
        {
            "kind": "control_repeat",
            "params": [{"key": "n", "value": "360"}],
            "children": [
                {"kind": "motion_move", "params": [{"key": "n", "value": "2"}]},
                {"kind": "motion_turn_right", "params": [{"key": "n", "value": "1"}]},
            ],
        },
    ]
    assert not match_script(SAMPLE_CIRCLE_SCRIPT, student)


def test_public_pieces_hide_answers():
    pieces = public_pieces(SAMPLE_CIRCLE_SCRIPT, shuffle=False)
    blob = str(pieces)
    assert "360" not in blob
    assert len(pieces) == 5
    kinds = [p["kind"] for p in pieces]
    assert kinds == [
        "event_flag",
        "pen_down",
        "control_repeat",
        "motion_move",
        "motion_turn_right",
    ]


def test_payload_parse():
    raw = '{"script":[{"kind":"event_flag","params":[],"children":[]}]}'
    assert student_script_from_payload(raw)[0]["kind"] == "event_flag"
