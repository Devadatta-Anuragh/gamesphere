# Infra — GameSphere demo on AWS EC2 (Terraform)

A single small EC2 instance that runs the whole stack for demos: **Mongo + Redis**
(Docker), the **API** (port 4000) and the **Next.js web** app (port 3000), all
behind **nginx** as a reverse proxy on port 80. No domain / TLS yet — you reach it
by IP.

```
                         ┌──────────────── EC2 (t3.medium, Ubuntu 22.04) ───────────────┐
  Browser ──:80──▶ nginx │  /            → :3000  Next.js (web)                          │
                         │  /api, /health→ :4000  Express API                            │
                         │  /socket.io   → :4000  Socket.IO (WebSocket)                  │
                         │  docker compose: Mongo (rs0 replica set) + Redis              │
                         └──────────────────────────────────────────────────────────────┘
```

## What Terraform creates

- EC2 instance + an **Elastic IP** (stable address across stop/start)
- A security group: **port 80 open**, **port 22 locked to your IP**
- An **SSH keypair** (private key written to `terraform/<project>-key.pem`, gitignored)
- A generated **JWT secret** (kept in Terraform state)
- cloud-init that installs Node 20, pnpm, Docker, nginx, clones the repo, builds
  the web app, and starts everything as **systemd** services (survive reboot).

## Prerequisites

- Terraform ≥ 1.6 (installed)
- AWS credentials. No AWS CLI required — either:
  - export env vars: `export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...`, or
  - configure a named profile and set `aws_profile` in `terraform.tfvars`.
- An IAM identity allowed to manage EC2, EIP, security groups and key pairs.

## Deploy

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # optional: edit overrides

terraform init
terraform plan
terraform apply
```

Apply finishes in ~30s, but the instance keeps provisioning for **~3–5 minutes**
afterwards (installing Docker/Node, `pnpm install`, `next build`). Then:

```bash
terraform output app_url        # http://<elastic-ip>
terraform output ssh_command    # ssh -i ./gamesphere-key.pem ubuntu@<ip>
```

Watch the bootstrap live:

```bash
$(terraform output -raw cloud_init_log_hint | sed 's/^ssh/ssh/')
# or just:
ssh -i ./gamesphere-key.pem ubuntu@<ip> 'sudo tail -f /var/log/cloud-init-output.log'
```

## Operating the box

```bash
ssh -i ./gamesphere-key.pem ubuntu@<ip>

systemctl status gamesphere-api gamesphere-web gamesphere-infra
journalctl -u gamesphere-api -f
docker compose -f /opt/gamesphere/docker-compose.dev.yml ps
```

### Redeploy new code

```bash
ssh -i ./gamesphere-key.pem ubuntu@<ip> '
  cd /opt/gamesphere &&
  git pull &&
  NEXT_PUBLIC_API_URL=http://<ip> pnpm install --frozen-lockfile &&
  NEXT_PUBLIC_API_URL=http://<ip> pnpm build:web &&
  sudo systemctl restart gamesphere-api gamesphere-web
'
```

## Cost / teardown

`t3.medium` is ~$30/mo on-demand in ap-south-1. Stop it when idle
(`aws ec2 stop-instances` or the console) — the Elastic IP keeps the address.
Tear everything down with:

```bash
terraform destroy
```

## Notes & next steps (deliberately deferred)

- **No TLS / domain** yet. When you add a domain, point it at the EIP and add
  certbot + an nginx 443 server block.
- **No monitoring** (Prometheus/Grafana) — out of scope for now.
- SSH is pinned to one IP (`ssh_allowed_cidr`); update it if your IP changes,
  then `terraform apply`.

## CI/CD (GitHub Actions)

Two workflows live in `.github/workflows/`:

- **`ci.yml`** — on every PR and push to `main`. Uses path filtering so the
  **api** job (lint + typecheck + test) and **web** job (typecheck + build) only
  run when their code — or the shared package / lockfile / root config — changes.
- **`deploy.yml`** — on pushes to `main` touching `apps/**`, `packages/**` or
  `pnpm-lock.yaml` (and via manual dispatch). Deploys through **AWS SSM Run
  Command** (no inbound SSH from CI): pulls latest `main` on the box, reinstalls,
  rebuilds the web app, and restarts the systemd services.

### Required GitHub repo secrets (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | access key of a CI IAM user (see policy below) |
| `AWS_SECRET_ACCESS_KEY` | its secret |
| `AWS_REGION` | `ap-south-1` |
| `EC2_INSTANCE_ID` | `i-027fece2940c8fa35` |

### Least-privilege IAM policy for the CI user

Don't reuse admin keys. Create a dedicated `gamesphere-ci` IAM user with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["ssm:SendCommand"],
      "Resource": [
        "arn:aws:ec2:ap-south-1:611284995730:instance/i-027fece2940c8fa35",
        "arn:aws:ssm:ap-south-1::document/AWS-RunShellScript"
      ] },
    { "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
      "Resource": "*" }
  ]
}
```

> The instance carries an `AmazonSSMManagedInstanceCore` role (see `iam.tf`) so it
> registers with SSM — that's what makes agent-based deploys possible.
