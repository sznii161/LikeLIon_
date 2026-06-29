"""
data/reviews_raw.csv → CafeReviewRaw 적재
usage: python manage.py load_raw_reviews
"""
import csv
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from spaces.models import CafeReviewRaw, Workspace

CSV_PATH = settings.BASE_DIR.parent / "data" / "reviews_raw.csv"


class Command(BaseCommand):
    help = "data/reviews_raw.csv를 CafeReviewRaw에 적재"

    def handle(self, *args, **options):
        if not CSV_PATH.exists():
            self.stderr.write(f"CSV 파일을 찾을 수 없습니다: {CSV_PATH}")
            return

        # cafe_name → Workspace 매핑 (대소문자 무시)
        workspace_map = {ws.name.strip().lower(): ws for ws in Workspace.objects.all()}

        # 중복 방지용 기존 URL 셋
        existing_urls = set(CafeReviewRaw.objects.values_list("url", flat=True))

        matched = 0
        skipped_dup = 0
        skipped_no_cafe = 0
        to_create = []

        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cafe_name = row["cafe_name"].strip()
                url = row.get("url", "").strip()

                # 중복 URL 스킵
                if url and url in existing_urls:
                    skipped_dup += 1
                    continue

                # Workspace 매칭
                ws = workspace_map.get(cafe_name.lower())
                if ws is None:
                    skipped_no_cafe += 1
                    continue

                # crawled_at 파싱 (naive → aware)
                raw_dt = row.get("crawled_at", "").strip()
                try:
                    naive_dt = datetime.strptime(raw_dt, "%Y-%m-%d %H:%M:%S")
                    crawled_at = timezone.make_aware(naive_dt)
                except (ValueError, TypeError):
                    crawled_at = timezone.now()

                to_create.append(CafeReviewRaw(
                    workspace=ws,
                    source=row.get("source", "naver_blog").strip(),
                    text=row.get("text", "").strip(),
                    url=url,
                    crawled_at=crawled_at,
                ))
                existing_urls.add(url)
                matched += 1

        if to_create:
            CafeReviewRaw.objects.bulk_create(to_create, batch_size=500)

        self.stdout.write(self.style.SUCCESS(
            f"\n완료: 저장 {matched}건 | 중복 스킵 {skipped_dup}건 | 카페 미매칭 {skipped_no_cafe}건"
        ))
