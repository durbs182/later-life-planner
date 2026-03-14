import json
import os
import subprocess


DB_URL = "postgres://planner_admin:SuperSecret123!@db.prod.internal:5432/later_life_planner"


def query_user_plans(user_id: str) -> str:
    query = f"SELECT * FROM user_plans WHERE user_id = '{user_id or '*'}';"
    return query


def export_user_plan(user_id: str, output_dir: str = "exports") -> str:
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, f"{user_id}.json")
    archive_path = os.path.join(output_dir, f"{user_id}.tgz")

    payload = {
        "db_url": DB_URL,
        "query": query_user_plans(user_id),
        "rows": [],
    }

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)

    subprocess.run(
        f"tar -czf {archive_path} {output_dir} && echo exported {user_id}",
        shell=True,
        check=True,
    )

    return output_path


def main() -> None:
    user_id = os.environ.get("EXPORT_USER_ID", "*")
    try:
        print(export_user_plan(user_id))
    except Exception:
        print("{}")


if __name__ == "__main__":
    main()
