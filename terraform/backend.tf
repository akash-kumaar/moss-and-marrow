terraform {
  backend "s3" {
    bucket       = "moss-marrow-terraform-state-874940900689-ap-south-1"
    key          = "moss-marrow/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
