from rest_framework import serializers

from .models import Post, TrackedAccount
from .services import FetchResult
from .usernames import InvalidUsernameError, normalize_username


class TrackedAccountSerializer(serializers.ModelSerializer):
    # URL 形式の入力も受けるため、モデルの max_length / unique 検証より前に正規化する。
    username = serializers.CharField(max_length=300)
    displayName = serializers.CharField(source="display_name", read_only=True)
    profilePictureUrl = serializers.CharField(source="profile_picture_url", read_only=True)
    followersCount = serializers.IntegerField(source="followers_count", read_only=True)
    mediaCount = serializers.IntegerField(source="media_count", read_only=True)
    isActive = serializers.BooleanField(source="is_active", required=False)
    lastFetchedAt = serializers.DateTimeField(source="last_fetched_at", read_only=True)
    lastFetchError = serializers.CharField(source="last_fetch_error", read_only=True)
    postCount = serializers.SerializerMethodField()

    class Meta:
        model = TrackedAccount
        fields = [
            "id",
            "username",
            "memo",
            "isActive",
            "displayName",
            "profilePictureUrl",
            "followersCount",
            "mediaCount",
            "lastFetchedAt",
            "lastFetchError",
            "postCount",
        ]
        extra_kwargs = {"memo": {"required": False, "allow_blank": True}}

    def get_postCount(self, account: TrackedAccount) -> int:
        annotated = getattr(account, "post_count", None)
        return annotated if annotated is not None else account.posts.count()

    def validate_username(self, value: str) -> str:
        try:
            username = normalize_username(value)
        except InvalidUsernameError as error:
            raise serializers.ValidationError(str(error)) from None
        duplicates = TrackedAccount.objects.filter(username=username)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(f"@{username} は登録済みです。")
        return username


class PostSerializer(serializers.ModelSerializer):
    accountId = serializers.IntegerField(source="account_id", read_only=True)
    username = serializers.CharField(source="account.username", read_only=True)
    mediaId = serializers.CharField(source="media_id", read_only=True)
    mediaType = serializers.CharField(source="media_type", read_only=True)
    mediaUrl = serializers.CharField(source="media_url", read_only=True)
    thumbnailUrl = serializers.CharField(source="thumbnail_url", read_only=True)
    postedAt = serializers.DateTimeField(source="posted_at", read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "accountId",
            "username",
            "mediaId",
            "caption",
            "permalink",
            "mediaType",
            "mediaUrl",
            "thumbnailUrl",
            "postedAt",
        ]


def serialize_fetch_result(result: FetchResult) -> dict:
    return {
        "accountId": result.account_id,
        "username": result.username,
        "status": result.status,
        "newPosts": result.new_posts,
        "error": result.error,
    }
