data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.project_name}-lambda"
  description        = "Rol de ejecución de la Lambda de ${var.project_name} (Bedrock, DynamoDB, S3)"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-lambda"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

locals {
  # el perfil de inferencia cross-region (p.ej. "eu.amazon.nova-micro-v1:0") solo autoriza
  # su propio ARN — Bedrock exige TAMBIÉN permiso sobre el modelo base en cada región por
  # la que enruta, o falla con AccessDenied aunque el ARN del perfil esté permitido
  bedrock_base_model_id = replace(var.bedrock_model_id, "/^[a-z]{2}\\./", "")

  bedrock_model_arns = [
    for region in var.bedrock_regions :
    "arn:aws:bedrock:${region}::foundation-model/${local.bedrock_base_model_id}"
  ]
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid       = "DynamoDBCache"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.translations.arn]
  }

  statement {
    sid       = "S3LrcObjects"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.lrc.arn}/*"]
  }

  statement {
    sid       = "S3LrcListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.lrc.arn]
  }

  statement {
    sid     = "BedrockInvoke"
    actions = ["bedrock:InvokeModel"]
    resources = concat(
      ["arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}"],
      local.bedrock_model_arns
    )
  }
}

// política gestionada en vez de inline — las inline (aws_iam_role_policy) no admiten
// descripción en la API de AWS, así queda visible en IAM > Políticas con su descripción
resource "aws_iam_policy" "lambda_permissions" {
  name        = "${var.project_name}-lambda-permissions"
  description = "Permisos de la Lambda de ${var.project_name}: cache en DynamoDB, .lrc en S3, traducción vía Bedrock"
  policy      = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_iam_role_policy_attachment" "lambda_permissions" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_permissions.arn
}
