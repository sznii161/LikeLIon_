from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import WorkspaceViewSet, SpaceReviewViewSet, CafeReviewRawListView

router = DefaultRouter()
router.register(r"spaces", WorkspaceViewSet, basename="workspace")

review_list_create = SpaceReviewViewSet.as_view({"get": "list", "post": "create"})
review_delete      = SpaceReviewViewSet.as_view({"delete": "destroy"})

urlpatterns = router.urls + [
    path("spaces/<int:workspace_pk>/reviews/",                review_list_create,          name="space-reviews"),
    path("spaces/<int:workspace_pk>/reviews/<int:pk>/",       review_delete,               name="space-review-delete"),
    path("spaces/<int:workspace_pk>/raw-reviews/",            CafeReviewRawListView.as_view(), name="space-raw-reviews"),
]
