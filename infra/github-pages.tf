# Punto de entrada estable en GitHub Pages (https://caballo-corazon.github.io/lyrics2emoji/)
# que redirige al dominio real de CloudFront — se regenera en cada apply, así que si el
# dominio cambia (p.ej. al recrear la distribución), este archivo se actualiza solo.
locals {
  redirect_delay_seconds = 6
}

resource "local_file" "github_pages_redirect" {
  filename = "${path.module}/../docs/index.html"
  content = templatefile("${path.module}/templates/redirect.html.tftpl", {
    cloudfront_domain      = aws_cloudfront_distribution.main.domain_name
    redirect_delay_seconds = local.redirect_delay_seconds
  })
}

# el logo también se copia a docs/ (GitHub Pages solo sirve lo que hay dentro de esa
# carpeta) — se mantiene sincronizado con logo.svg del repo en cada apply
resource "local_file" "github_pages_logo" {
  filename = "${path.module}/../docs/logo.svg"
  content  = file("${path.module}/../logo.svg")
}
