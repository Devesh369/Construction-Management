from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    Standard pagination for Construction Management Portal.
    Defaults to 20 items per page with max limit of 100.
    Response format: {count, next, previous, results}
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
