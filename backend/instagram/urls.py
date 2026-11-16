from django.urls import path

from .views import (
    AccountDetailView,
    AccountFetchView,
    AccountListCreateView,
    FetchAllView,
    PostListView,
    StatusView,
    TabAccountDetailView,
    TabDetailView,
    TabListCreateView,
)

urlpatterns = [
    path("status", StatusView.as_view(), name="instagram-status"),
    path("tabs", TabListCreateView.as_view(), name="tab-list"),
    path("tabs/<int:pk>", TabDetailView.as_view(), name="tab-detail"),
    path(
        "tabs/<int:tab_id>/accounts/<int:account_id>",
        TabAccountDetailView.as_view(),
        name="tab-account-detail",
    ),
    path("accounts", AccountListCreateView.as_view(), name="account-list"),
    path("accounts/<int:pk>", AccountDetailView.as_view(), name="account-detail"),
    path("accounts/<int:pk>/fetch", AccountFetchView.as_view(), name="account-fetch"),
    path("fetch", FetchAllView.as_view(), name="fetch-all"),
    path("posts", PostListView.as_view(), name="post-list"),
]
