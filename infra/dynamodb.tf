resource "aws_dynamodb_table" "translations" {
  name         = "${var.project_name}-translations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "phrase"

  attribute {
    name = "phrase"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-translations"
  }
}
