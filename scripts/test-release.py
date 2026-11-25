"""Read-only regression checks against the GitHub Actions configuration (PyYAML)."""
import json
from pathlib import Path
import subprocess
import sys
import yaml

root = Path(__file__).resolve().parents[1] / ".github/workflows"
def workflow(name):
    return yaml.load((root / name).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)

release = workflow("container-release.yml")["jobs"]
assert release["security"]["uses"] == "./.github/workflows/security.yml"
build = release["build-and-publish"]
assert build["needs"] == "security"
for component in ("frontend", "backend"):
    step = next(s for s in build["steps"] if s.get("name") == f"Scan {component} image for vulnerabilities (Trivy)")
    assert step["with"]["exit-code"] == "1" and step["with"]["ignore-unfixed"] == "false"
    assert "@${{ steps." + component + "-push.outputs.digest }}" in step["with"]["image-ref"]
    assert "continue-on-error" not in step and "if" not in step
cd = workflow("cd.yml")
assert list(cd["on"]) == ["workflow_run"]
assert cd["on"]["workflow_run"]["workflows"] == ["Container Release"]
deploy = cd["jobs"]["deploy"]
assert "workflow_run.conclusion == 'success'" in deploy["if"]
steps = {s["name"]: s for s in deploy["steps"]}
assert "workflow_run.head_sha" in steps["Resolve deployment SHA"]["run"]
assert "workflow_run.id" in steps["Read verified release from triggering run"]["run"]
assert "steps.frontend-digest.outputs.digest" in steps["Check release identity and AWS destination"]["run"]
selector = steps["Get EC2 instance ID"]["run"].split("python3 -c '")[1].split("')")[0]
for ids in ([], ["i-12345678"], ["i-12345678", "i-12345679"]):
    result = subprocess.run([sys.executable, "-c", selector], input=json.dumps(ids), text=True, capture_output=True)
    assert (result.returncode == 0) == (len(ids) == 1)
    if len(ids) == 1:
        assert result.stdout.strip() == ids[0]
print("PASS release gating, exact digest inputs, CD trigger, release SHA, unique instance selection")
