import json
import subprocess
import uuid
from pathlib import Path

from fastapi import APIRouter

from ..config import EXERCISE_DIR
from ..schemas import JudgeRequest, Select_CompleteRequest
from ..storage import read_json

router = APIRouter(tags=["OJ"])

CONTAINER_NAME = "global-judger"


@router.post("/api/judge")
def run_judge(req: JudgeRequest):
    run_id = str(uuid.uuid4())
    work_dir = f"/workspace/work/{run_id}"

    try:
        subprocess.run(["docker", "exec", CONTAINER_NAME, "mkdir", "-p", work_dir], check=True)

        subprocess.run(
            ["docker", "exec", "-i", CONTAINER_NAME, "bash", "-c", f"cat > {work_dir}/solution.cpp"],
            input=req.code,
            text=True,
            encoding="utf-8",
            check=True,
        )

        result = subprocess.run(
            [
                "docker",
                "exec",
                CONTAINER_NAME,
                "bash",
                "/workspace/judger/judge.sh",
                run_id,
                req.problem_id,
                str(req.time_limit),
                str(req.mem_limit),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        try:
            output_json = json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            return {
                "status": "System Error",
                "total_cases": 0,
                "passed_cases": 0,
                "details": [],
                "error_log": result.stderr,
            }

        if output_json["status"] == "Compile Error":
            log_res = subprocess.run(
                ["docker", "exec", CONTAINER_NAME, "cat", f"{work_dir}/compile.log"],
                capture_output=True,
                text=True,
            )
            output_json["compile_log"] = log_res.stdout

        return output_json

    except Exception as error:
        return {
            "status": "Server Error",
            "total_cases": 0,
            "passed_cases": 0,
            "details": [],
            "error_log": str(error),
        }

    finally:
        subprocess.run(["docker", "exec", CONTAINER_NAME, "rm", "-rf", work_dir])


def load_data():
    return read_json(EXERCISE_DIR / "exercises.json")


@router.get("/api/get_problem_data/{id}")
async def get_problem(id: str):
    data_list = load_data()

    result = next((item for item in data_list if item["id"] == id), None)

    if result is None:
        return {
            "id": "Error",
            "details": "文件不存在",
        }

    if result["type"] == "programming":
        path = Path(result["path"])
        if path.exists() and path.is_file():
            try:
                with path.open("r", encoding="utf-8") as file:
                    md_content = file.read()

                full_data = result.copy()
                full_data["content"] = md_content

                return full_data

            except Exception:
                return {
                    "id": "Error",
                    "details": "题面不存在",
                }
        else:
            return {
                "id": "Error",
                "details": "路径错误",
            }
    else:
        return result


@router.post("/api/check_S&C_ans/{id}")
def check(req: Select_CompleteRequest):
    data_list = load_data()

    result = next((item for item in data_list if item["id"] == req.problem_id), None)

    if result is None:
        return {
            "id": "Error",
            "details": "文件不存在",
        }

    if result["type"] == "programming":
        return {
            "id": "Error",
            "details": "题目并非是选填",
        }
    else:
        return {
            "status": result["answer"] == req.answer,
        }
