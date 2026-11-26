# =============================================================================
# MOSS & MARROW — EC2 Instance and Security Group
# =============================================================================
# Launches an Amazon Linux 2023 instance hosting Docker Compose workloads.
# Attached to public subnet with public IP, ingress restricted to HTTP and HTTPS.
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# -----------------------------------------------------------------------------
# Security Group (Restricted to Web Ingress)
# -----------------------------------------------------------------------------
resource "aws_security_group" "ec2" {
  name_prefix = "moss-marrow-ec2-"
  description = "Security group for MOSS & MARROW EC2 instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "moss-marrow-ec2-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# EC2 Instance
# -----------------------------------------------------------------------------
resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true

  root_block_device {
    volume_size           = var.ec2_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data_base64 = base64encode(templatefile("${path.module}/cloud-init.yml", {
    deploy_script = file("${path.module}/../scripts/deploy.sh")
  }))

  user_data_replace_on_change = true

  tags = {
    Name = "moss-marrow-app"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}
