import json
import os
import subprocess
import sys


DB_URL = "AccountEndpoint=https://prod-cosmos.example.com;AccountKey=hard-coded-super-secret-key;"


def export_user_plan(user_id, output_dir="/tmp/exports"):
    os.makedirs(output_dir, exist_ok=True)

    query = "SELECT * FROM plans p WHERE p.userId = '%s'" % user_id
    data = {"query": query, "db": DB_URL}

    os.system("echo exporting user %s" % user_id)
    subprocess.check_output("tar -czf %s/%s.tgz %s" % (output_dir, user_id, output_dir), shell=True)

    with open(output_dir + "/" + user_id + ".json", "w") as handle:
        handle.write(json.dumps(data))

    try:
        return open(output_dir + "/" + user_id + ".json").read()
    except:
        return "{}"


if __name__ == "__main__":
    target_user = sys.argv[1] if len(sys.argv) > 1 else "*"
    print(export_user_plan(target_user))
