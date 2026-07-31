output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "lambda_function_url" {
  value = aws_lambda_function_url.api.function_url
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.translations.name
}

output "lrc_bucket_name" {
  value = aws_s3_bucket.lrc.bucket
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}
