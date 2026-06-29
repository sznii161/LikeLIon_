from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone


def validate_half_step(value):
    if (value * 2) % 1 != 0:
        raise ValidationError("별점은 0.5 단위로만 입력할 수 있습니다. (예: 1, 1.5, 2, …, 5)")


class Workspace(models.Model):
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=500)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)

    # 카공족 5대 지표 (prompt_rule.md 기준)
    score_plug = models.FloatField(null=True, blank=True)
    score_wifi = models.FloatField(null=True, blank=True)
    score_noise = models.FloatField(null=True, blank=True)
    score_comfort = models.FloatField(null=True, blank=True)
    score_table = models.FloatField(null=True, blank=True)  # 0.0 or 5.0

    total_review_count = models.PositiveIntegerField(default=0)
    last_scored_at = models.DateTimeField(null=True, blank=True)

    kakao_place_id = models.CharField(max_length=50, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    kakao_url = models.CharField(max_length=500, null=True, blank=True)

    def __str__(self):
        return self.name


class CafeReviewRaw(models.Model):
    SOURCE_CHOICES = [
        ('naver_place', '네이버 플레이스'),
        ('naver_blog', '네이버 블로그'),
    ]
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='raw_reviews')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    text = models.TextField()
    url = models.URLField(max_length=1000, blank=True)
    crawled_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.workspace.name} [{self.source}] {self.crawled_at.date()}"


class SpaceReview(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    score_plug = models.FloatField(validators=[MinValueValidator(1), MaxValueValidator(5), validate_half_step])
    score_wifi = models.FloatField(validators=[MinValueValidator(1), MaxValueValidator(5), validate_half_step])
    score_noise = models.FloatField(validators=[MinValueValidator(1), MaxValueValidator(5), validate_half_step])
    score_comfort = models.FloatField(validators=[MinValueValidator(1), MaxValueValidator(5), validate_half_step])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'user'], name='unique_review_per_user')
        ]

    def __str__(self):
        return f"{self.workspace.name} ({self.created_at.date()})"
