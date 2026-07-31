variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "aws_profile" {
  description = "Perfil de AWS local a usar (p.ej. el que creaste con `aws configure --profile ...`). null = usa la cadena de credenciales por defecto / AWS_PROFILE del entorno."
  type        = string
  default     = null
}

variable "project_name" {
  type    = string
  default = "lyrics2emoji"
}

variable "bedrock_model_id" {
  description = "Perfil de inferencia (o ID de modelo) de Bedrock a usar"
  type        = string
  default     = "eu.amazon.nova-micro-v1:0"
}

variable "bedrock_regions" {
  description = "Regiones subyacentes por las que enruta el perfil de inferencia cross-region (necesarias en la política IAM, además del ARN del propio perfil)"
  type        = list(string)
  default     = ["eu-west-1", "eu-west-3", "eu-central-1", "eu-north-1"]
}
