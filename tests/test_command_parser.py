from app.command_parser import parse_command


def test_typo_tolerant_medication_match():
    result = parse_command("took tylonal", {"medicationTemplates": [{"name": "Tylenol", "dose": "500 mg"}]})
    assert result["actions"][0]["medication_name"] == "Tylenol"


def test_pain_score_is_preview_only():
    result = parse_command("there is pain, pain is 4", {})
    assert result["actions"][0]["type"] == "log_pain_score"
    assert result["actions"][0]["value"] == 4
