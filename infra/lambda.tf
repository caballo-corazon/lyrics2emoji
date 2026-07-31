resource "null_resource" "lambda_build" {
  triggers = {
    handler_hash      = filesha256("${path.module}/../lambda/handler.mjs")
    server_lib_hash   = sha1(join("", [for f in fileset("${path.module}/../server-lib", "**") : filesha256("${path.module}/../server-lib/${f}")]))
    openmoji_hash     = filesha256("${path.module}/../public/data/openmoji.json")
    build_script_hash = filesha256("${path.module}/build-lambda.sh")
  }

  provisioner "local-exec" {
    command = "${path.module}/build-lambda.sh"
  }
}

data "archive_file" "lambda_zip" {
  depends_on  = [null_resource.lambda_build]
  type        = "zip"
  source_dir  = "${path.module}/.build/lambda"
  output_path = "${path.module}/.build/lambda.zip"
}

resource "random_password" "origin_secret" {
  length  = 32
  special = false
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.project_name}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda/handler.handler"
  runtime          = "nodejs22.x"
  timeout          = 90
  memory_size      = 512
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      # AWS_REGION es un nombre reservado por Lambda — lo inyecta él mismo, no se puede fijar aquí
      BEDROCK_MODEL_ID = var.bedrock_model_id
      DYNAMODB_TABLE   = aws_dynamodb_table.translations.name
      LRC_BUCKET       = aws_s3_bucket.lrc.bucket
      ORIGIN_SECRET    = random_password.origin_secret.result
    }
  }
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}

# desde oct-2025 AWS exige este permiso explícito incluso con authorization_type = "NONE"
# ("block public access by default" para Function URLs nuevas) — sin esto, toda
# invocación no autenticada devuelve 403 AccessDeniedException sin llegar al handler.
# El acceso real sigue restringido por la cabecera secreta que comprueba el handler.
resource "aws_lambda_permission" "public_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# desde oct-2025 AWS exige TAMBIÉN un segundo permiso (lambda:InvokeFunction, con la
# condición lambda:InvokedViaFunctionUrl) además del InvokeFunctionUrl de arriba — sin
# él, sigue dando 403 AccessDeniedException. El provider de Terraform instalado (5.100.0)
# todavía no expone `invoked_via_function_url` en aws_lambda_permission (es un feature
# request abierto), así que se añade con el CLI de AWS directamente.
resource "null_resource" "public_url_invoke_function_permission" {
  triggers = {
    function_name = aws_lambda_function.api.function_name
    aws_cli_flags = "--region ${var.aws_region} ${var.aws_profile != null ? "--profile ${var.aws_profile}" : ""}"
  }

  provisioner "local-exec" {
    command = "aws lambda add-permission ${self.triggers.aws_cli_flags} --function-name ${self.triggers.function_name} --statement-id AllowPublicFunctionUrlInvokeFunction --action lambda:InvokeFunction --principal '*' --invoked-via-function-url || true"
  }

  provisioner "local-exec" {
    when    = destroy
    command = "aws lambda remove-permission ${self.triggers.aws_cli_flags} --function-name ${self.triggers.function_name} --statement-id AllowPublicFunctionUrlInvokeFunction || true"
  }
}
