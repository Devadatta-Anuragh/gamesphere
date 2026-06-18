# Credentials are NOT stored here. The provider uses the standard AWS
# credential chain: environment variables (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY),
# or a named profile if you set `aws_profile` in terraform.tfvars (or AWS_PROFILE).
provider "aws" {
  region  = var.region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
