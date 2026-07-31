# Bucket privado para los .lrc — solo la Lambda le habla, nunca el navegador directamente
resource "aws_s3_bucket" "lrc" {
  bucket = "${var.project_name}-lrc-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-lrc"
  }
}

resource "aws_s3_bucket_public_access_block" "lrc" {
  bucket = aws_s3_bucket.lrc.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
