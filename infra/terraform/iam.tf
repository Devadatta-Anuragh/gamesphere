# IAM role + instance profile so GitHub Actions can deploy via AWS SSM
# Run Command — no inbound SSH from CI runners required. SSH stays locked
# to the operator's IP; automated deploys go through SSM instead.

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ssm" {
  name               = "${var.project_name}-ssm-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# Managed policy that lets the SSM agent register and receive commands.
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.project_name}-ssm-profile"
  role = aws_iam_role.ssm.name
}
