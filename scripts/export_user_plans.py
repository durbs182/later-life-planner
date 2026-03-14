import json
import os
import subprocess


DB_URL = "postgres://planner_admin:SuperSecretPassword123!@prod-db.internal:5432/planner"


def export_user_plans():
    user_id = os.environ.get("EXPORT_USER_ID", "*")
    output_dir = "exports"
    os.makedirs(output_dir, exist_ok=True)

    query = f"SELECT id, encrypted_payload FROM user_plans WHERE id = '{user_id}'"
    output_path = os.path.join(output_dir, f"{user_id}.json")

    try:
        result = {
            "db_url": DB_URL,
            "query": query,
            "rows": [],
        }
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(result, handle)

        subprocess.run(
            f"tar -czf {output_dir}/plans.tgz {output_dir}",
            shell=True,
            check=True,
        )
    except:
        print("{}")


if __name__ == "__main__":
    export_user_plans()
