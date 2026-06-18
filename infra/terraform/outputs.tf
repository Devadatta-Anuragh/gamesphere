output "public_ip" {
  description = "Elastic IP of the demo instance."
  value       = aws_eip.this.public_ip
}

output "app_url" {
  description = "Open this in a browser once provisioning finishes (~3-5 min after apply)."
  value       = "http://${aws_eip.this.public_ip}"
}

output "ssh_command" {
  description = "SSH into the instance."
  value       = "ssh -i ${path.module}/${var.project_name}-key.pem ubuntu@${aws_eip.this.public_ip}"
}

output "cloud_init_log_hint" {
  description = "Tail the bootstrap log to watch provisioning."
  value       = "ssh -i ${path.module}/${var.project_name}-key.pem ubuntu@${aws_eip.this.public_ip} 'sudo tail -f /var/log/cloud-init-output.log'"
}
