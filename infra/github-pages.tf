# Punto de entrada estable en GitHub Pages (https://caballo-corazon.github.io/lyrics2emoji/)
# que redirige al dominio real de CloudFront — se regenera en cada apply, así que si el
# dominio cambia (p.ej. al recrear la distribución), este archivo se actualiza solo.
resource "local_file" "github_pages_redirect" {
  filename = "${path.module}/../docs/index.html"
  content = templatefile("${path.module}/templates/redirect.html.tftpl", {
    cloudfront_domain = aws_cloudfront_distribution.main.domain_name
  })
}
