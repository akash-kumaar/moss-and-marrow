# CI/CD Architecture — MOSS & MARROW

Container Release calls the reusable Security workflow on the release commit. Secret detection, production npm audits and Trivy filesystem checks must complete successfully before publishing. Release scans the exact two pushed image digests and requires successful SBOM, signature and provenance steps before recording its verified manifest. The independent Security workflow still covers PRs, schedules and manual scans. Deploy to EC2 consumes only the successful main release run and its artifact. CI and CodeQL remain separate workflows.

See the [EC2 deployment guide](deployment-guide.md) for instance selection, host script verification, database safety and rollback.
