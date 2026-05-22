from django.http import HttpRequest, HttpResponse


def index(request: HttpRequest) -> HttpResponse:
    return HttpResponse(
        "<h1>Trading</h1><p>Dashboards kommer her.</p>",
        content_type="text/html",
    )
