from rest_framework import serializers
from .models import Workspace, SpaceReview, CafeReviewRaw, validate_half_step


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = [
            "id", "name", "address", "latitude", "longitude",
            "score_plug", "score_wifi", "score_noise", "score_comfort", "score_table",
            "total_review_count", "last_scored_at",
            "kakao_place_id", "phone", "kakao_url",
        ]


_SCORE_FIELD = dict(
    min_value=1,
    max_value=5,
    validators=[validate_half_step],
)


class CafeReviewRawSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeReviewRaw
        fields = ["source", "text", "url", "crawled_at"]


class SpaceReviewSerializer(serializers.ModelSerializer):
    score_plug    = serializers.FloatField(**_SCORE_FIELD)
    score_wifi    = serializers.FloatField(**_SCORE_FIELD)
    score_noise   = serializers.FloatField(**_SCORE_FIELD)
    score_comfort = serializers.FloatField(**_SCORE_FIELD)
    username      = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = SpaceReview
        fields = [
            "id", "workspace", "username",
            "score_plug", "score_wifi", "score_noise", "score_comfort",
            "comment", "created_at",
        ]
        read_only_fields = ["id", "workspace", "username", "created_at"]
