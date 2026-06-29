from rest_framework import viewsets, mixins, generics
from rest_framework.filters import OrderingFilter
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, NumberFilter
from .models import Workspace, SpaceReview, CafeReviewRaw
from .serializers import WorkspaceSerializer, SpaceReviewSerializer, CafeReviewRawSerializer


class WorkspaceFilter(FilterSet):
    min_score_plug    = NumberFilter(field_name="score_plug",    lookup_expr="gte")
    min_score_wifi    = NumberFilter(field_name="score_wifi",    lookup_expr="gte")
    min_score_noise   = NumberFilter(field_name="score_noise",   lookup_expr="gte")
    min_score_comfort = NumberFilter(field_name="score_comfort", lookup_expr="gte")
    min_score_table   = NumberFilter(field_name="score_table",   lookup_expr="gte")

    class Meta:
        model = Workspace
        fields = ["min_score_plug", "min_score_wifi", "min_score_noise",
                  "min_score_comfort", "min_score_table"]


class WorkspaceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Workspace.objects.filter(last_scored_at__isnull=False).order_by("id")
    serializer_class = WorkspaceSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = WorkspaceFilter
    ordering_fields = ["score_plug", "score_wifi", "score_noise", "score_comfort", "score_table", "name"]
    ordering = ["-score_plug"]


class SpaceReviewViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = SpaceReviewSerializer

    def get_permissions(self):
        if self.action in ('create', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_workspace(self):
        try:
            return Workspace.objects.get(pk=self.kwargs["workspace_pk"])
        except Workspace.DoesNotExist:
            raise NotFound(f"workspace {self.kwargs['workspace_pk']}를 찾을 수 없습니다.")

    def get_queryset(self):
        return SpaceReview.objects.filter(workspace=self.get_workspace()).order_by("-created_at")

    def perform_create(self, serializer):
        workspace = self.get_workspace()
        if SpaceReview.objects.filter(workspace=workspace, user=self.request.user).exists():
            raise PermissionDenied("이미 이 카페에 리뷰를 작성했습니다.")
        serializer.save(workspace=workspace, user=self.request.user)

    def perform_destroy(self, instance):
        if instance.user != self.request.user:
            raise PermissionDenied("본인 리뷰만 삭제할 수 있습니다.")
        instance.delete()


class CafeReviewRawListView(generics.ListAPIView):
    serializer_class = CafeReviewRawSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        workspace_pk = self.kwargs["workspace_pk"]
        if not Workspace.objects.filter(pk=workspace_pk).exists():
            raise NotFound(f"workspace {workspace_pk}를 찾을 수 없습니다.")
        return CafeReviewRaw.objects.filter(workspace_id=workspace_pk).order_by("-crawled_at")
