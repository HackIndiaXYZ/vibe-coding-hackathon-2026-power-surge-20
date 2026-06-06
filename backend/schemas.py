from typing import Literal

from pydantic import BaseModel


class Question(BaseModel):
    question_id: str
    question_text: str
    topic: str
    difficulty: Literal["easy", "medium", "hard"]
    expected_concepts: list[str]
    question_type: Literal["conceptual", "calculation"]
