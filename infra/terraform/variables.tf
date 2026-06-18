variable "project_name" {
  description = "Name prefix for all resources and the Project tag."
  type        = string
  default     = "gamesphere"
}

variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Named AWS CLI/SDK profile to use. Leave null to use env-var credentials or the default profile."
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 instance type. t3.small (2GB) is the largest free-tier-eligible x86 type; paired with a 4GB swapfile it handles the Next.js build + Mongo + Redis + API. Bump to t3.medium/large after upgrading the AWS account off the Free plan."
  type        = string
  default     = "t3.small"
}

variable "root_volume_gb" {
  description = "Root EBS volume size in GB (holds the OS, node_modules and the Next.js build)."
  type        = number
  default     = 24
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to SSH (port 22). Defaults to the operator's current public IP. Update this if your IP changes."
  type        = string
  default     = "106.202.110.198/32"
}

variable "repo_url" {
  description = "HTTPS Git URL of the public application repo to clone onto the instance."
  type        = string
  default     = "https://github.com/Devadatta-Anuragh/gamesphere.git"
}

variable "repo_branch" {
  description = "Git branch to deploy."
  type        = string
  default     = "main"
}
