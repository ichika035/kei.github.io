"""Google Analytics (GA4) から直近 30 日の国別ページビューを取り、access.json の中身を標準出力に書く。

GitHub Actions (.github/workflows/build-cv.yml) から毎日呼ばれる。
  GA_PROPERTY_ID                 GA4 のプロパティ ID (数字)
  GOOGLE_APPLICATION_CREDENTIALS サービスアカウントの鍵 (JSON) のパス
"""
import datetime
import json
import os

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest

DAYS = 30

client = BetaAnalyticsDataClient()
report = client.run_report(RunReportRequest(
    property=f"properties/{os.environ['GA_PROPERTY_ID']}",
    dimensions=[Dimension(name="date"), Dimension(name="countryId")],
    metrics=[Metric(name="screenPageViews")],
    date_ranges=[DateRange(start_date=f"{DAYS - 1}daysAgo", end_date="today")],
    limit=100000,
))

# アクセスの無い日も 0 件の日として並べる
today = datetime.date.today()
days = {(today - datetime.timedelta(days=i)).isoformat(): {} for i in range(DAYS)}
for row in report.rows:
    date, country = (v.value for v in row.dimension_values)
    date = f"{date[:4]}-{date[4:6]}-{date[6:]}"
    if len(country) != 2 or date not in days:  # "(not set)" などは除く
        continue
    views = int(row.metric_values[0].value)
    days[date][country] = days[date].get(country, 0) + views

print(json.dumps({
    "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "days": [{"date": d, "countries": days[d]} for d in sorted(days)],
}, ensure_ascii=False, separators=(",", ":")))
