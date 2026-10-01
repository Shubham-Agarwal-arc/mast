import json
import logging
from datetime import UTC, datetime


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in (
            "request_id",
            "interaction_id",
            "user_id",
            "method",
            "path",
            "status_code",
            "latency_ms",
            "constitutional_triggered",
            "regeneration_attempts",
            "regeneration_succeeded",
            "final_response_verified",
            "classification_category",
            "classification_confidence",
            "kc_ids",
            "mastery_delta",
            "hint_depth",
            "latency_breakdown",
            "quota_outcome",
            "quota_used",
            "quota_limit",
            "resolved",
        ):
            value = getattr(record, field, None)
            if hasattr(record, field):
                payload[field] = value
        return json.dumps(payload, separators=(",", ":"))


def configure_logging() -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    if not any(isinstance(handler.formatter, JsonLogFormatter) for handler in root_logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(JsonLogFormatter())
        root_logger.addHandler(handler)