from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


DATE_RE = re.compile(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), "
    r"(January|February|March|April|May|June|July|August|September|October|November|December) "
    r"\d{1,2}, \d{4}$"
)
WEEK_RE = re.compile(r"^Week (\d+)$")
COUNT_RE = re.compile(r"^\d+ tasks \| \d+ due$")
TASK_RE = re.compile(r"^(Skill|Practice|Final|Review|Exam|Bonus|Course)\b")


def iso_date(label: str) -> str:
    return datetime.strptime(label, "%A, %B %d, %Y").date().isoformat()


def clean_line(line: str) -> str:
    line = line.replace("\u2013", "-").replace("\u2014", "-")
    line = line.replace("APls", "APIs")
    return " ".join(line.split())


def extract_lines(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    lines: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        lines.extend(clean_line(line) for line in text.splitlines() if clean_line(line))
    return lines


def build_plan(lines: list[str]) -> dict:
    title = "Academy CCNA Study Plan"
    start_date = None
    target_deadline = None
    weeks: list[dict] = []
    current_week: dict | None = None
    current_day: dict | None = None
    current_task: dict | None = None
    task_id = 1

    for i, line in enumerate(lines):
        if i == 0 and line:
            title = line
            continue

        if line == "START DATE" and i + 1 < len(lines):
            start_date = iso_date(lines[i + 1])
            continue
        if line == "TARGET DEADLINE" and i + 1 < len(lines):
            target_deadline = iso_date(lines[i + 1])
            continue

        week_match = WEEK_RE.match(line)
        if week_match:
            current_week = {"number": int(week_match.group(1)), "days": []}
            weeks.append(current_week)
            current_day = None
            current_task = None
            continue

        if DATE_RE.match(line) and current_week is not None:
            current_day = {"date": iso_date(line), "label": line, "tasks": []}
            current_week["days"].append(current_day)
            current_task = None
            continue

        if (
            COUNT_RE.match(line)
            or line in {"Scheduled Tasks", "Learner Summary", "Powered by NetworkChuck"}
            or line.startswith("Stay focused -")
        ):
            continue

        if current_day is None:
            continue

        if TASK_RE.match(line):
            current_task = {
                "id": f"task-{task_id:03d}",
                "title": line,
                "completed": False,
                "completedAt": None,
                "notes": "",
            }
            current_day["tasks"].append(current_task)
            task_id += 1
        elif current_task is not None:
            current_task["title"] = f"{current_task['title']} {line}"

    return {
        "title": title,
        "source": "Summer of CCNA Study Plan.pdf",
        "startDate": start_date,
        "targetDeadline": target_deadline,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "weeks": weeks,
    }


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract_checklist.py <input.pdf> <output.json>", file=sys.stderr)
        return 2

    pdf_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    plan = build_plan(extract_lines(pdf_path))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    task_count = sum(len(day["tasks"]) for week in plan["weeks"] for day in week["days"])
    print(f"Wrote {task_count} tasks across {len(plan['weeks'])} weeks to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
