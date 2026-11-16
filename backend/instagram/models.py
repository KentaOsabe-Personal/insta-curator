from django.db import models


class Tab(models.Model):
    """投稿を見るジャンルのタブ（ご飯・ファッションなど）。アカウントは複数のタブに所属できる。"""

    name = models.CharField(max_length=30, unique=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.name


class TrackedAccount(models.Model):
    """情報を取得する対象の Instagram アカウント（ビジネス／クリエイターアカウント）。"""

    username = models.CharField(max_length=30, unique=True)
    memo = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    tabs = models.ManyToManyField(Tab, related_name="accounts", blank=True)

    # 取得時に Instagram から反映するプロフィール情報
    display_name = models.CharField(max_length=200, blank=True)
    profile_picture_url = models.TextField(blank=True)
    followers_count = models.PositiveIntegerField(null=True, blank=True)
    media_count = models.PositiveIntegerField(null=True, blank=True)

    last_fetched_at = models.DateTimeField(null=True, blank=True)
    last_fetch_error = models.CharField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["username"]

    def __str__(self) -> str:
        return f"@{self.username}"


class Post(models.Model):
    """取得済みの投稿。media_id で重複を防ぐ。"""

    account = models.ForeignKey(TrackedAccount, on_delete=models.CASCADE, related_name="posts")
    media_id = models.CharField(max_length=64, unique=True)
    caption = models.TextField(blank=True)
    permalink = models.TextField(blank=True)
    media_type = models.CharField(max_length=32, blank=True)
    media_url = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    posted_at = models.DateTimeField()
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-posted_at"]
        indexes = [models.Index(fields=["account", "-posted_at"])]

    def __str__(self) -> str:
        return f"{self.account.username}:{self.media_id}"
