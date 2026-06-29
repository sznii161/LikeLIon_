from django.contrib import admin
from .models import Workspace, SpaceReview, CafeReviewRaw


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ["name", "address", "score_plug", "score_wifi", "score_noise", "score_comfort", "score_table"]


@admin.register(SpaceReview)
class SpaceReviewAdmin(admin.ModelAdmin):
    list_display = ["workspace", "user", "score_plug", "created_at"]


@admin.register(CafeReviewRaw)
class CafeReviewRawAdmin(admin.ModelAdmin):
    list_display = ["workspace", "source", "crawled_at"]
