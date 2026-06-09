from typing import Literal

from pydantic import BaseModel, Field


class Question(BaseModel):
    question_id: str
    question_text: str
    topic: str
    difficulty: Literal["easy", "medium", "hard"]
    expected_concepts: list[str]
    question_type: Literal["conceptual", "calculation"]


class GenerateQuestionRequest(BaseModel):
    session_id: str
    difficulty: Literal["easy", "medium", "hard"]


class EvaluateAnswerRequest(BaseModel):
    question_id: str
    question_text: str
    expected_concepts: list[str]
    student_answer: str


class Evaluation(BaseModel):
    score: int = Field(ge=0, le=10)
    feedback: str
    concepts_covered: list[str]
    concepts_missed: list[str]
    needs_followup: bool
    followup_hint: str


class SessionEvaluationEntry(BaseModel):
    question_text: str
    topic: str
    student_answer: str
    score: int = Field(ge=0, le=10)
    concepts_missed: list[str]


class SessionSummaryRequest(BaseModel):
    evaluations: list[SessionEvaluationEntry]
    weak_topics: list[str]
    topics_to_revise: list[str]


class StudyRecommendations(BaseModel):
    recommendations: list[str] = Field(min_length=2, max_length=4)
