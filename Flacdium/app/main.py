from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse
from urllib.request import urlopen
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from starlette.background import BackgroundTask
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from mutagen.flac import FLAC
BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = BASE_DIR / "app"
DATA_DIR = BASE_DIR / "data"
LIBRARY_DIR = BASE_DIR / "library"
OBJECTS_DIR = LIBRARY_DIR / "_objects"
COVERS_DIR = BASE_DIR / "covers"
TMP_DIR = BASE_DIR / "tmp"
REVIEW_DIR = TMP_DIR / "review"
SPECTRUM_DIR = TMP_DIR / "spectrum"
BATCH_DIR = TMP_DIR / "upload_batches"
DB_PATH = DATA_DIR / "flacdium.sqlite3"

for folder in (DATA_DIR, LIBRARY_DIR, OBJECTS_DIR, COVERS_DIR, TMP_DIR, REVIEW_DIR, SPECTRUM_DIR, BATCH_DIR):
    folder.mkdir(parents=True, exist_ok=True)


def load_project_env() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_project_env()


def env_bool(name: str, default: bool = False) -> bool:
    raw_value = (os.getenv(name) or "").strip().lower()
    if not raw_value:
        return default
    return raw_value in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    raw_value = (os.getenv(name) or "").strip()
    if not raw_value:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    raw_value = (os.getenv(name) or "").strip()
    if not raw_value:
        return default
    try:
        return float(raw_value)
    except ValueError:
        return default


SECRET_KEY = (os.getenv("FLACDIUM_SECRET") or "").strip()
OPENCELLID_API_KEY = os.getenv("OPENCELLID_API_KEY", "")
OPENCELLID_API_URL = os.getenv("OPENCELLID_API_URL", "https://opencellid.org/cell/get")
ADMIN_USERNAME = (os.getenv("FLACDIUM_ADMIN_USERNAME") or "").strip()
ADMIN_PASSWORD = os.getenv("FLACDIUM_ADMIN_PASSWORD", "")
TRUST_PROXY = env_bool("FLACDIUM_TRUST_PROXY", False)
MAX_REQUEST_BODY_BYTES = env_int("FLACDIUM_MAX_REQUEST_BODY_BYTES", 1024 * 1024 * 1024)
MAX_UPLOAD_FILES = env_int("FLACDIUM_MAX_UPLOAD_FILES", 64)
MAX_UPLOAD_FILE_BYTES = env_int("FLACDIUM_MAX_UPLOAD_FILE_BYTES", 800 * 1024 * 1024)
MAX_UPLOAD_TOTAL_BYTES = env_int("FLACDIUM_MAX_UPLOAD_TOTAL_BYTES", 4 * 1024 * 1024 * 1024)
MAX_ZIP_FILE_BYTES = env_int("FLACDIUM_MAX_ZIP_FILE_BYTES", 4 * 1024 * 1024 * 1024)
MAX_ZIP_MEMBERS = env_int("FLACDIUM_MAX_ZIP_MEMBERS", 128)
MAX_ZIP_MEMBER_BYTES = env_int("FLACDIUM_MAX_ZIP_MEMBER_BYTES", 800 * 1024 * 1024)
MAX_ZIP_TOTAL_UNPACKED_BYTES = env_int(
    "FLACDIUM_MAX_ZIP_TOTAL_UNPACKED_BYTES",
    6 * 1024 * 1024 * 1024,
)
MIN_SAMPLE_RATE = env_int("FLACDIUM_MIN_SAMPLE_RATE", 44100)
MIN_BIT_DEPTH = env_int("FLACDIUM_MIN_BIT_DEPTH", 16)
MIN_FINGERPRINT_DURATION_SECONDS = env_int("FLACDIUM_MIN_FINGERPRINT_DURATION_SECONDS", 15)
MAX_FINGERPRINT_DURATION_DELTA_SECONDS = env_int("FLACDIUM_MAX_FINGERPRINT_DURATION_DELTA_SECONDS", 2)
MIN_FINGERPRINT_SIMILARITY = env_float("FLACDIUM_MIN_FINGERPRINT_SIMILARITY", 0.96)
MAX_VISIBLE_UPLOADER_CREDITS = env_int("FLACDIUM_MAX_VISIBLE_UPLOADER_CREDITS", 2)
MIN_SPECTRAL_ANALYSIS_DURATION_SECONDS = env_int("FLACDIUM_MIN_SPECTRAL_ANALYSIS_DURATION_SECONDS", 15)
SPECTRAL_LOW_ENERGY_FLOOR = env_float("FLACDIUM_SPECTRAL_LOW_ENERGY_FLOOR", 6.0)
SPECTRAL_MID_ENERGY_FLOOR = env_float("FLACDIUM_SPECTRAL_MID_ENERGY_FLOOR", 5.0)
SPECTRAL_TOP_MID_RATIO_MAX = env_float("FLACDIUM_SPECTRAL_TOP_MID_RATIO_MAX", 0.70)
SPECTRAL_TOP_LOW_RATIO_MAX = env_float("FLACDIUM_SPECTRAL_TOP_LOW_RATIO_MAX", 0.22)
SPECTRAL_ROLLOFF_MAX_HZ = env_int("FLACDIUM_SPECTRAL_ROLLOFF_MAX_HZ", 17500)
LOGIN_RATE_LIMIT = env_int("FLACDIUM_LOGIN_RATE_LIMIT", 12)
LOGIN_RATE_WINDOW_SECONDS = env_int("FLACDIUM_LOGIN_RATE_WINDOW_SECONDS", 900)
SIGNUP_RATE_LIMIT = env_int("FLACDIUM_SIGNUP_RATE_LIMIT", 6)
SIGNUP_RATE_WINDOW_SECONDS = env_int("FLACDIUM_SIGNUP_RATE_WINDOW_SECONDS", 3600)
UPLOAD_RATE_LIMIT = env_int("FLACDIUM_UPLOAD_RATE_LIMIT", 10)
UPLOAD_RATE_WINDOW_SECONDS = env_int("FLACDIUM_UPLOAD_RATE_WINDOW_SECONDS", 3600)
LANGUAGES = ("vi", "en")
REQUIRED_TAGS = ("artist", "album", "title", "tracknumber", "date")
TRACKS_PER_PAGE = 24
SIDEBAR_PAGE_SIZE = 10
QUICK_LINKS_LIMIT = 8
LOGIN_LOGS_PER_PAGE = 40
MAX_BUNDLE_TRACKS = 100
SORTS = {
    "newest": "uploaded_at DESC",
    "oldest": "uploaded_at ASC",
    "artist": "artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, disc_number ASC, track_number ASC",
    "album": "album COLLATE NOCASE ASC, artist COLLATE NOCASE ASC, disc_number ASC, track_number ASC",
    "uploader": "uploader COLLATE NOCASE ASC, uploaded_at DESC",
    "year": "year DESC, artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC",
    "title": "title COLLATE NOCASE ASC, artist COLLATE NOCASE ASC",
}

TEXT: dict[str, dict[str, str]] = {
    "vi": {
        "html_lang": "vi",
        "site_title": "Flacdium",
        "brand_sub": "kho chia sẻ flac kiểu cũ",
        "nav_browse": "duyệt",
        "nav_latest": "mới nhất",
        "nav_artists": "ca sĩ",
        "nav_albums": "album",
        "nav_uploaders": "người up",
        "nav_quickfind": "tìm nhanh",
        "nav_admin": "quản trị",
        "signal_strip": "giao diện archive cũ | tông sáng dịu | giữ cover art nhúng",
        "tech_strip": "node flacdium-01 | auth sqlite | ingest flac-only | dedupe sha256",
        "stats_tracks": "bài nhạc",
        "stats_artists": "ca sĩ",
        "stats_albums": "album",
        "stats_uploaders": "người up",
        "upload_lane": "khu upload",
        "uploader_label": "người up",
        "uploader_placeholder": "nickname hoặc handle",
        "bulk_flac": "upload nhiều flac",
        "zip_drop": "upload zip",
        "rights_confirmed": "tôi sure là nhạc ngon",
        "upload_note": "chỉ nhận flac | bắt buộc artist, album, title, tracknumber, date, cover art nhúng",
        "upload_cta": "đẩy vào index",
        "upload_progress_title": "tiến trình upload",
        "upload_progress_uploading": "đang tải file lên...",
        "upload_progress_processing": "đã tải xong, đang nhập vào kho...",
        "upload_progress_error": "upload thất bại hoặc bị ngắt",
        "filters": "bộ lọc duyệt",
        "find": "tìm",
        "find_placeholder": "ca sĩ / album / bài / thể loại",
        "exact_uploader": "đúng tên người up",
        "exact_artist": "đúng tên ca sĩ",
        "exact_album": "đúng tên album",
        "sort": "sắp xếp",
        "sort_newest": "mới nhất",
        "sort_oldest": "cũ nhất",
        "sort_artist": "theo ca sĩ",
        "sort_album": "theo album",
        "sort_uploader": "theo người up",
        "sort_year": "theo năm",
        "sort_title": "theo tên bài",
        "scan": "lọc",
        "clear": "xóa lọc",
        "artists": "ca sĩ",
        "albums": "album",
        "uploaders": "người up",
        "cover": "bìa",
        "track": "bài",
        "artist": "ca sĩ",
        "album": "album",
        "uploader": "người up",
        "year": "năm",
        "length": "dài",
        "spec": "thông số",
        "size": "dung lượng",
        "added": "thêm",
        "grab": "tải",
        "spectrum": "phổ",
        "spectrum_title": "phổ tần chi tiết",
        "spectrum_hint": "xem phổ",
        "spectrum_loading": "đang tạo phổ...",
        "spectrum_error": "không tạo được phổ cho bài này",
        "genre_missing": "chưa gắn thể loại",
        "disc": "đĩa",
        "download_label": "flac",
        "download_many_flac": "flac đã chọn",
        "download_zip": "zip đã chọn",
        "select": "chọn",
        "empty_index": "chưa có bài nào",
        "fresh": "vừa lên",
        "login_required_tip": "đăng nhập bắt buộc để tải file",
        "login_tip_body": "duyệt tự do, nhưng bấm tải sẽ yêu cầu đăng nhập.",
        "open_login": "mở đăng nhập",
        "dismiss": "ẩn",
        "login_title": "đăng nhập để tải",
        "login_tab": "đăng nhập",
        "signup_tab": "đăng ký",
        "username": "tên đăng nhập",
        "password": "mật khẩu",
        "password_again": "nhập lại mật khẩu",
        "login_cta": "vào tài khoản",
        "signup_cta": "tạo tài khoản",
        "close": "đóng",
        "guest": "khách",
        "hello": "xin chào",
        "logout": "thoát",
        "lang_vi": "việt",
        "lang_en": "anh",
        "admin_badge": "admin",
        "admin_title": "quản lý tài khoản",
        "admin_users": "tài khoản",
        "admin_logs": "log đăng nhập",
        "admin_status": "trạng thái",
        "admin_active": "đang mở",
        "admin_disabled": "đã khóa",
        "admin_created": "tạo lúc",
        "admin_last_ip": "ip gần nhất",
        "admin_last_login": "lần vào gần nhất",
        "admin_actions": "thao tác",
        "admin_toggle_disable": "khóa",
        "admin_toggle_enable": "mở",
        "admin_log_user": "tài khoản",
        "admin_log_ip": "ip",
        "admin_log_forwarded": "forwarded",
        "admin_log_agent": "user-agent",
        "admin_log_time": "thời gian",
        "admin_log_result": "kết quả",
        "admin_log_cell": "cell lookup",
        "admin_log_success": "ok",
        "admin_log_failed": "fail",
        "admin_log_ip_changed": "đổi ip",
        "admin_log_same_ip": "cùng ip",
        "admin_only": "chỉ admin được vào mục này",
        "user_disabled": "tài khoản đang bị khóa",
        "account_updated": "đã cập nhật tài khoản",
        "cell_lookup_no_data": "không có dữ liệu cell để tra",
        "cell_lookup_no_key": "thiếu opencellid api key",
        "cell_lookup_lookup_failed": "tra cell thất bại",
        "cell_lookup_not_needed": "ip không đổi",
        "cell_lookup_ok": "đã tra được cell",
        "admin_filter_user": "lọc tài khoản",
        "admin_filter_user_placeholder": "tên đăng nhập",
        "admin_filter_from": "từ ngày",
        "admin_filter_to": "đến ngày",
        "admin_filter_sort": "sắp xếp",
        "admin_sort_newest": "ngày mới nhất",
        "admin_sort_oldest": "ngày cũ nhất",
        "admin_sort_user_az": "tài khoản a-z",
        "admin_sort_user_za": "tài khoản z-a",
        "login_needed_notice": "cần đăng nhập để tải file này",
        "invalid_login": "sai tên đăng nhập hoặc mật khẩu",
        "invalid_csrf": "phiên biểu mẫu không hợp lệ, hãy tải lại trang",
        "signup_password_mismatch": "mật khẩu nhập lại chưa khớp",
        "signup_username_exists": "tên đăng nhập đã tồn tại",
        "signup_success": "đăng ký xong, đã vào tài khoản",
        "missing_uploader": "thiếu tên người up",
        "rights_needed": "hãy xác nhận bạn có quyền chia sẻ các file flac này",
        "upload_login_required": "cần đăng nhập để upload",
        "nothing_uploaded": "chưa có file nào được gửi lên",
        "accepted_summary": "nhận {accepted} / loại {rejected}",
        "not_flac": "không phải file flac",
        "not_zip": "không phải file zip",
        "zip_empty": "không tìm thấy file flac trong zip",
        "missing_tags": "thiếu tag",
        "missing_cover": "thiếu cover art nhúng",
        "invalid_track": "tracknumber không hợp lệ",
        "unsupported_cover": "cover art không hỗ trợ",
        "broken_flac": "flac lỗi hoặc không đọc được",
        "low_quality_sample_rate": "sample rate thấp hơn mức cho phép",
        "low_quality_bit_depth": "bit depth thấp hơn mức cho phép",
        "lossy_transcode_suspected": "phổ tần nghi là transcode lossy giả flac",
        "duplicate_hash": "trùng hệt file đã có trong kho",
        "duplicate_slot": "trùng artist/album/track với bài đã có",
        "duplicate_credited": "bài đã có sẵn, đã gộp thêm credit người up",
        "duplicate_replaced": "bài đã có sẵn, đã thay bằng bản upload mới tốt hơn và gộp credit",
        "request_too_large": "request quá lớn",
        "too_many_upload_files": "quá nhiều file trong một lần upload",
        "upload_file_too_large": "file flac vượt giới hạn dung lượng",
        "upload_total_too_large": "tổng dung lượng upload vượt giới hạn",
        "zip_file_too_large": "file zip vượt giới hạn dung lượng",
        "zip_too_many_members": "zip chứa quá nhiều file flac",
        "zip_member_too_large": "một file flac trong zip vượt giới hạn dung lượng",
        "zip_unpacked_too_large": "tổng dung lượng giải nén từ zip vượt giới hạn",
        "rate_limit_login": "thử đăng nhập quá nhiều lần, chờ một lúc rồi thử lại",
        "rate_limit_signup": "tạo tài khoản quá nhanh, chờ một lúc rồi thử lại",
        "rate_limit_upload": "upload quá nhiều lần trong thời gian ngắn, chờ một lúc rồi thử lại",
        "track_not_found": "không thấy bài",
        "file_missing": "file trên ổ đĩa không còn",
        "queued_review": "file đã vào hàng chờ duyệt",
        "queued_duplicate_review": "file trùng đã vào hàng chờ duyệt",
        "queued_quality_review": "file nghi chất lượng thấp đã vào hàng chờ duyệt",
        "admin_reviews": "hàng chờ duyệt",
        "admin_review_file": "file",
        "admin_review_reason": "lý do",
        "admin_review_meta": "meta",
        "admin_review_when": "gửi lúc",
        "admin_review_actions": "duyệt",
        "admin_review_approve": "duyệt nhập",
        "admin_review_reject": "loại",
        "admin_review_empty": "không có file chờ duyệt",
        "possible_duplicate_note": "các case trùng theo metadata đang bị chặn nhẹ để tránh up lặp",
        "storage_note": "dedupe hiện chặn file hash trùng và slot album trùng; tối ưu mạnh hơn nên bàn thêm",
        "system_panel": "hệ thống",
        "system_status": "public index | no js framework | sqlite auth | zip unpack on ingest",
        "file_rules": "quy tắc",
        "file_rules_note": "flac only | metadata đầy đủ | embedded cover | file lỗi và file trùng bị loại",
        "quickfind_title": "tìm nhanh",
        "quickfind_note": "nhảy nhanh theo từ khóa hoặc mở list gọn theo từng nhóm",
        "quickfind_tracks": "tìm bài",
        "quickfind_artists": "tìm ca sĩ",
        "quickfind_albums": "tìm album",
        "quickfind_uploaders": "tìm người up",
        "jump": "mở",
        "page_prev": "trước",
        "page_next": "sau",
        "page_label": "trang",
    },
    "en": {
        "html_lang": "en",
        "site_title": "Flacdium",
        "brand_sub": "old-school flac share index",
        "nav_browse": "browse",
        "nav_latest": "latest",
        "nav_artists": "artists",
        "nav_albums": "albums",
        "nav_uploaders": "uploaders",
        "nav_quickfind": "quick find",
        "nav_admin": "admin",
        "signal_strip": "old archive layout | soft light palette | embedded cover art preserved",
        "tech_strip": "node flacdium-01 | auth sqlite | ingest flac-only | dedupe sha256",
        "stats_tracks": "tracks",
        "stats_artists": "artists",
        "stats_albums": "albums",
        "stats_uploaders": "uploaders",
        "upload_lane": "upload lane",
        "uploader_label": "uploader",
        "uploader_placeholder": "nickname or handle",
        "bulk_flac": "bulk flac",
        "zip_drop": "zip upload",
        "rights_confirmed": "i know what tf i'm doing rn",
        "upload_note": "flac only | requires artist, album, title, tracknumber, date, embedded cover art",
        "upload_cta": "push to index",
        "upload_progress_title": "upload progress",
        "upload_progress_uploading": "uploading files...",
        "upload_progress_processing": "upload finished, ingesting into the library...",
        "upload_progress_error": "upload failed or was interrupted",
        "filters": "browse filters",
        "find": "find",
        "find_placeholder": "artist / album / track / genre",
        "exact_uploader": "exact uploader",
        "exact_artist": "exact artist",
        "exact_album": "exact album",
        "sort": "sort",
        "sort_newest": "newest",
        "sort_oldest": "oldest",
        "sort_artist": "artist",
        "sort_album": "album",
        "sort_uploader": "uploader",
        "sort_year": "year",
        "sort_title": "title",
        "scan": "scan",
        "clear": "clear",
        "artists": "artists",
        "albums": "albums",
        "uploaders": "uploaders",
        "cover": "cover",
        "track": "track",
        "artist": "artist",
        "album": "album",
        "uploader": "uploader",
        "year": "year",
        "length": "len",
        "spec": "spec",
        "size": "size",
        "added": "added",
        "grab": "grab",
        "spectrum": "spectrum",
        "spectrum_title": "detailed spectrum",
        "spectrum_hint": "view spectrum",
        "spectrum_loading": "rendering spectrum...",
        "spectrum_error": "failed to render spectrum for this track",
        "genre_missing": "untagged genre",
        "disc": "disc",
        "download_label": "flac",
        "download_many_flac": "selected flac",
        "download_zip": "selected zip",
        "select": "select",
        "empty_index": "index empty",
        "fresh": "fresh",
        "login_required_tip": "login required for downloads",
        "login_tip_body": "browsing stays open, but download clicks require login.",
        "open_login": "open login",
        "dismiss": "hide",
        "login_title": "login for downloads",
        "login_tab": "login",
        "signup_tab": "sign up",
        "username": "username",
        "password": "password",
        "password_again": "repeat password",
        "login_cta": "enter account",
        "signup_cta": "create account",
        "close": "close",
        "guest": "guest",
        "hello": "hello",
        "logout": "logout",
        "lang_vi": "vietnamese",
        "lang_en": "english",
        "admin_badge": "admin",
        "admin_title": "account admin",
        "admin_users": "accounts",
        "admin_logs": "login logs",
        "admin_status": "status",
        "admin_active": "active",
        "admin_disabled": "disabled",
        "admin_created": "created",
        "admin_last_ip": "last ip",
        "admin_last_login": "last login",
        "admin_actions": "actions",
        "admin_toggle_disable": "disable",
        "admin_toggle_enable": "enable",
        "admin_log_user": "account",
        "admin_log_ip": "ip",
        "admin_log_forwarded": "forwarded",
        "admin_log_agent": "user-agent",
        "admin_log_time": "time",
        "admin_log_result": "result",
        "admin_log_cell": "cell lookup",
        "admin_log_success": "ok",
        "admin_log_failed": "fail",
        "admin_log_ip_changed": "ip changed",
        "admin_log_same_ip": "same ip",
        "admin_only": "admin only",
        "user_disabled": "account is disabled",
        "account_updated": "account updated",
        "cell_lookup_no_data": "no cell data available",
        "cell_lookup_no_key": "missing opencellid api key",
        "cell_lookup_lookup_failed": "cell lookup failed",
        "cell_lookup_not_needed": "ip unchanged",
        "cell_lookup_ok": "cell lookup ok",
        "admin_filter_user": "filter account",
        "admin_filter_user_placeholder": "username",
        "admin_filter_from": "from date",
        "admin_filter_to": "to date",
        "admin_filter_sort": "sort",
        "admin_sort_newest": "newest date",
        "admin_sort_oldest": "oldest date",
        "admin_sort_user_az": "user a-z",
        "admin_sort_user_za": "user z-a",
        "login_needed_notice": "login is required before downloading this file",
        "invalid_login": "invalid username or password",
        "invalid_csrf": "invalid form session, reload the page and try again",
        "signup_password_mismatch": "password confirmation does not match",
        "signup_username_exists": "username already exists",
        "signup_success": "account created and signed in",
        "missing_uploader": "missing uploader name",
        "rights_needed": "confirm that you have rights to share these flac files",
        "upload_login_required": "login is required to upload",
        "nothing_uploaded": "nothing uploaded",
        "accepted_summary": "accepted {accepted} / rejected {rejected}",
        "not_flac": "not a flac file",
        "not_zip": "not a zip archive",
        "zip_empty": "no flac files found inside zip",
        "missing_tags": "missing tags",
        "missing_cover": "missing embedded cover art",
        "invalid_track": "invalid tracknumber",
        "unsupported_cover": "unsupported cover art",
        "broken_flac": "broken or unreadable flac",
        "low_quality_sample_rate": "sample rate is below the allowed floor",
        "low_quality_bit_depth": "bit depth is below the allowed floor",
        "lossy_transcode_suspected": "frequency spectrum looks like a lossy transcode wrapped as flac",
        "duplicate_hash": "exact file already exists in the library",
        "duplicate_slot": "artist/album/track slot already exists",
        "duplicate_credited": "track already exists, uploader credit was merged",
        "duplicate_replaced": "track already exists, the newer better upload replaced the stored file and uploader credit was merged",
        "request_too_large": "request body is too large",
        "too_many_upload_files": "too many files in one upload",
        "upload_file_too_large": "flac file exceeds the size limit",
        "upload_total_too_large": "total upload size exceeds the limit",
        "zip_file_too_large": "zip file exceeds the size limit",
        "zip_too_many_members": "zip contains too many flac files",
        "zip_member_too_large": "a flac file inside the zip exceeds the size limit",
        "zip_unpacked_too_large": "total unpacked zip size exceeds the limit",
        "rate_limit_login": "too many login attempts, wait a bit and try again",
        "rate_limit_signup": "too many signup attempts, wait a bit and try again",
        "rate_limit_upload": "too many uploads in a short time, wait a bit and try again",
        "track_not_found": "track not found",
        "file_missing": "file missing on disk",
        "queued_review": "file queued for review",
        "queued_duplicate_review": "duplicate upload queued for review",
        "queued_quality_review": "suspicious low-quality file queued for review",
        "admin_reviews": "review queue",
        "admin_review_file": "file",
        "admin_review_reason": "reason",
        "admin_review_meta": "metadata",
        "admin_review_when": "submitted",
        "admin_review_actions": "actions",
        "admin_review_approve": "approve import",
        "admin_review_reject": "reject",
        "admin_review_empty": "no files pending review",
        "possible_duplicate_note": "metadata duplicates are blocked softly to avoid repeated uploads",
        "storage_note": "dedupe currently blocks exact hashes and duplicate album slots; heavier optimization needs policy discussion",
        "system_panel": "system",
        "system_status": "public index | no js framework | sqlite auth | zip unpack on ingest",
        "file_rules": "rules",
        "file_rules_note": "flac only | complete metadata | embedded cover | broken and duplicate files are rejected",
        "quickfind_title": "quick find",
        "quickfind_note": "jump by keyword or open short lists by group",
        "quickfind_tracks": "find tracks",
        "quickfind_artists": "find artists",
        "quickfind_albums": "find albums",
        "quickfind_uploaders": "find uploaders",
        "jump": "open",
        "page_prev": "prev",
        "page_next": "next",
        "page_label": "page",
    },
}


class IngestError(ValueError):
    pass


class SecurityConfigError(RuntimeError):
    pass


app = FastAPI(title="Flacdium")
app.mount("/static", StaticFiles(directory=str(APP_DIR / "static")), name="static")
app.mount("/covers", StaticFiles(directory=str(COVERS_DIR)), name="covers")
templates = Jinja2Templates(directory=str(APP_DIR / "templates"))


def init_storage() -> None:
    for folder in (DATA_DIR, LIBRARY_DIR, OBJECTS_DIR, COVERS_DIR, TMP_DIR, REVIEW_DIR, SPECTRUM_DIR, BATCH_DIR):
        folder.mkdir(parents=True, exist_ok=True)


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def ensure_column(connection: sqlite3.Connection, table: str, name: str, ddl: str) -> None:
    columns = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if name not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as raw_connection:
        raw_connection.row_factory = sqlite3.Row
        connection = raw_connection
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uploader TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                cover_path TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT NOT NULL,
                title TEXT NOT NULL,
                album_artist TEXT NOT NULL,
                genre TEXT,
                release_date TEXT NOT NULL,
                year INTEGER NOT NULL,
                track_number INTEGER NOT NULL,
                disc_number INTEGER NOT NULL,
                duration_seconds INTEGER NOT NULL,
                sample_rate INTEGER NOT NULL,
                bit_depth INTEGER NOT NULL,
                channels INTEGER NOT NULL,
                file_size INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        ensure_column(connection, "tracks", "file_hash", "file_hash TEXT")
        ensure_column(connection, "tracks", "cover_hash", "cover_hash TEXT")
        ensure_column(connection, "tracks", "ingest_note", "ingest_note TEXT DEFAULT ''")
        ensure_column(connection, "tracks", "blob_path", "blob_path TEXT DEFAULT ''")
        ensure_column(connection, "tracks", "audio_fingerprint", "audio_fingerprint TEXT DEFAULT ''")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        ensure_column(connection, "users", "is_active", "is_active INTEGER NOT NULL DEFAULT 1")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS login_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                attempted_username TEXT NOT NULL,
                success INTEGER NOT NULL DEFAULT 0,
                ip_address TEXT NOT NULL,
                forwarded_for TEXT NOT NULL DEFAULT '',
                user_agent TEXT NOT NULL DEFAULT '',
                ip_changed INTEGER NOT NULL DEFAULT 0,
                cell_lookup_status TEXT NOT NULL DEFAULT '',
                cell_lookup_address TEXT NOT NULL DEFAULT '',
                cell_lookup_payload TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS request_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                scope_key TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS track_uploaders (
                track_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (track_id, username),
                FOREIGN KEY(track_id) REFERENCES tracks(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS review_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uploader TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                candidate_path TEXT NOT NULL DEFAULT '',
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                suggested_action TEXT NOT NULL DEFAULT '',
                existing_track_id INTEGER,
                artist TEXT NOT NULL DEFAULT '',
                album TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                reviewed_at TEXT NOT NULL DEFAULT '',
                reviewer TEXT NOT NULL DEFAULT '',
                decision_note TEXT NOT NULL DEFAULT ''
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_artist_album ON tracks (artist, album)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_uploader ON tracks (uploader)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_uploaded_at ON tracks (uploaded_at DESC)"
        )
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_file_hash ON tracks (file_hash)"
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_tracks_slot
            ON tracks (artist, album, disc_number, track_number, title)
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_login_logs_user_time ON login_logs (user_id, created_at DESC)"
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_track_uploaders_username_time
            ON track_uploaders (username, added_at DESC)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_review_items_status_time
            ON review_items (status, created_at DESC)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_request_events_action_scope_time
            ON request_events (action, scope_key, created_at DESC)
            """
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO track_uploaders (track_id, username, added_at)
            SELECT id, uploader, uploaded_at FROM tracks
            """
        )


def validate_security_config() -> None:
    if not SECRET_KEY:
        raise SecurityConfigError("FLACDIUM_SECRET must be set before startup")
    if SECRET_KEY == "flacdium-dev-secret":
        raise SecurityConfigError("FLACDIUM_SECRET must not use the old default secret")


def seed_admin_user() -> None:
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        return
    with get_db() as connection:
        existing = connection.execute(
            "SELECT * FROM users WHERE username = ?",
            (ADMIN_USERNAME,),
        ).fetchone()
        if existing is None:
            connection.execute(
                """
                INSERT INTO users (username, password, is_admin, created_at)
                VALUES (?, ?, 1, ?)
                """,
                (ADMIN_USERNAME, hash_password(ADMIN_PASSWORD), datetime.now(timezone.utc).isoformat()),
            )
        elif not verify_password(existing["password"], ADMIN_PASSWORD):
            connection.execute(
                "UPDATE users SET password = ?, is_admin = 1 WHERE id = ?",
                (hash_password(ADMIN_PASSWORD), existing["id"]),
            )
        elif not existing["password"].startswith("pbkdf2_sha256$"):
            connection.execute(
                "UPDATE users SET password = ?, is_admin = 1 WHERE id = ?",
                (hash_password(ADMIN_PASSWORD), existing["id"]),
            )


@app.on_event("startup")
def startup() -> None:
    validate_security_config()
    init_storage()
    init_db()
    seed_admin_user()


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def first_tag(audio: FLAC, key: str) -> str:
    values = audio.get(key)
    if not values:
        return ""
    return values[0].strip()


def parse_number(raw: str, default: int = 0) -> int:
    match = re.search(r"\d+", raw or "")
    return int(match.group(0)) if match else default


def parse_year(raw: str) -> int:
    match = re.search(r"\d{4}", raw or "")
    if not match:
        raise IngestError("missing_tags:date")
    return int(match.group(0))


def safe_segment(value: str) -> str:
    compact = re.sub(r"\s+", " ", value or "").strip()
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", compact)
    cleaned = cleaned.strip(" .")
    return cleaned or "unknown"


def normalize_slot_value(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def hash_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def compute_audio_fingerprint(source_path: Path, duration_seconds: int) -> str:
    if duration_seconds < MIN_FINGERPRINT_DURATION_SECONDS:
        return ""
    try:
        result = subprocess.run(
            ["fpcalc", "-json", str(source_path)],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        payload = json.loads(result.stdout.strip() or "{}")
    except Exception:  # noqa: BLE001
        return ""
    fingerprint = str(payload.get("fingerprint") or "").strip()
    return fingerprint


def analyze_spectral_profile(source_path: Path, sample_rate: int, duration_seconds: int) -> dict[str, float]:
    if duration_seconds < MIN_SPECTRAL_ANALYSIS_DURATION_SECONDS or sample_rate < MIN_SAMPLE_RATE:
        return {}
    try:
        raw = subprocess.check_output(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source_path),
                "-lavfi",
                "aformat=channel_layouts=mono,showspectrumpic=s=256x128:legend=disabled:color=intensity:scale=lin:fscale=lin:gain=2,format=gray",
                "-frames:v",
                "1",
                "-f",
                "rawvideo",
                "-",
            ],
            timeout=45,
        )
    except Exception:  # noqa: BLE001
        return {}

    width = 256
    height = 128
    expected = width * height
    if len(raw) < expected:
        return {}
    rows = [sum(raw[y * width : (y + 1) * width]) / width for y in range(height)]
    top10 = sum(rows[:13]) / 13
    top20 = sum(rows[:26]) / 26
    mid20 = sum(rows[40:66]) / 26
    low20 = sum(rows[102:128]) / 26
    rolloff_values: list[float] = []
    try:
        rolloff_output = subprocess.check_output(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "info",
                "-i",
                str(source_path),
                "-af",
                "aspectralstats=measure=rolloff:win_size=4096:overlap=0.75,ametadata=print:file=-",
                "-f",
                "null",
                "-",
            ],
            stderr=subprocess.STDOUT,
            text=True,
            timeout=45,
        )
        for line in rolloff_output.splitlines():
            if "lavfi.aspectralstats.1.rolloff=" in line:
                try:
                    rolloff_values.append(float(line.rsplit("=", 1)[-1].strip()))
                except ValueError:
                    continue
    except Exception:  # noqa: BLE001
        rolloff_values = []

    return {
        "top10": top10,
        "top20": top20,
        "mid20": mid20,
        "low20": low20,
        "rolloff_avg_hz": (sum(rolloff_values) / len(rolloff_values)) if rolloff_values else 0.0,
        "top_mid_ratio": top20 / max(mid20, 1.0),
        "top_low_ratio": top10 / max(low20, 1.0),
    }


def spectral_profile_suspicious(profile: dict[str, float], sample_rate: int) -> bool:
    if not profile:
        return False
    if profile["low20"] < SPECTRAL_LOW_ENERGY_FLOOR or profile["mid20"] < SPECTRAL_MID_ENERGY_FLOOR:
        return False
    return (
        profile["top_mid_ratio"] <= SPECTRAL_TOP_MID_RATIO_MAX
        and profile["top_low_ratio"] <= SPECTRAL_TOP_LOW_RATIO_MAX
        and profile["rolloff_avg_hz"] > 0
        and profile["rolloff_avg_hz"] <= min((sample_rate / 2.0) - 800.0, float(SPECTRAL_ROLLOFF_MAX_HZ))
    )


def fingerprint_similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    return SequenceMatcher(None, left, right).ratio()


def quality_tuple(
    *,
    sample_rate: int,
    bit_depth: int,
    channels: int,
    duration_seconds: int,
    file_size: int,
) -> tuple[int, int, int, int, int]:
    avg_kbps = int((file_size * 8) / max(duration_seconds, 1) / 1000)
    return (sample_rate, bit_depth, channels, avg_kbps, file_size)


def track_quality_tuple(row: sqlite3.Row | dict[str, Any]) -> tuple[int, int, int, int, int]:
    return quality_tuple(
        sample_rate=int(row["sample_rate"]),
        bit_depth=int(row["bit_depth"]),
        channels=int(row["channels"]),
        duration_seconds=int(row["duration_seconds"]),
        file_size=int(row["file_size"]),
    )


def meta_quality_tuple(meta: dict[str, Any], file_size: int) -> tuple[int, int, int, int, int]:
    return quality_tuple(
        sample_rate=meta["sample_rate"],
        bit_depth=meta["bit_depth"],
        channels=meta["channels"],
        duration_seconds=meta["duration_seconds"],
        file_size=file_size,
    )


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    counter = 2
    while True:
        candidate = path.with_name(f"{stem} ({counter}){suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def cover_extension(mime: str) -> str:
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    return mapping.get(mime.lower(), ".bin")


def review_candidate_filename(original_filename: str) -> str:
    suffix = Path(original_filename or "upload.flac").suffix or ".flac"
    return f"{now_utc().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(6)}{suffix}"


def text_for(lang: str) -> dict[str, str]:
    return TEXT[lang if lang in LANGUAGES else "vi"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_lang(request: Request) -> str:
    query_lang = request.query_params.get("lang")
    if query_lang in LANGUAGES:
        return query_lang
    cookie_lang = request.cookies.get("flacdium_lang")
    if cookie_lang in LANGUAGES:
        return cookie_lang
    return "vi"


def sign_value(value: str, purpose: str) -> str:
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        f"{purpose}:{value}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{value}.{signature}"


def unsign_value(raw_value: str | None, purpose: str) -> str | None:
    if not raw_value or "." not in raw_value:
        return None
    value, signature = raw_value.rsplit(".", 1)
    expected = hmac.new(
        SECRET_KEY.encode("utf-8"),
        f"{purpose}:{value}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if hmac.compare_digest(signature, expected):
        return value
    return None


def sign_username(username: str) -> str:
    return sign_value(username, "session")


def unsign_username(raw_value: str | None) -> str | None:
    return unsign_value(raw_value, "session")


def request_is_secure(request: Request) -> bool:
    if TRUST_PROXY:
        forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
        if forwarded_proto in {"http", "https"}:
            return forwarded_proto == "https"
    return request.url.scheme == "https"


def set_session_cookie(request: Request, response: RedirectResponse, username: str) -> None:
    response.set_cookie(
        "flacdium_session",
        sign_username(username),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        secure=request_is_secure(request),
    )


def clear_session_cookie(response: RedirectResponse) -> None:
    response.delete_cookie("flacdium_session")


def get_or_create_csrf_token(request: Request) -> str:
    existing = unsign_value(request.cookies.get("flacdium_csrf"), "csrf")
    if existing:
        return existing
    return secrets.token_urlsafe(32)


def set_csrf_cookie(request: Request, response: HTMLResponse | RedirectResponse, token: str) -> None:
    response.set_cookie(
        "flacdium_csrf",
        sign_value(token, "csrf"),
        httponly=True,
        samesite="strict",
        max_age=60 * 60 * 24 * 30,
        secure=request_is_secure(request),
    )


def set_lang_cookie(request: Request, response: HTMLResponse | RedirectResponse, lang: str) -> None:
    response.set_cookie(
        "flacdium_lang",
        lang,
        max_age=60 * 60 * 24 * 365,
        secure=request_is_secure(request),
        samesite="lax",
    )


def verify_csrf(request: Request, submitted_token: str) -> None:
    cookie_token = unsign_value(request.cookies.get("flacdium_csrf"), "csrf")
    if not cookie_token or not submitted_token or not hmac.compare_digest(cookie_token, submitted_token):
        raise HTTPException(status_code=403, detail=text_for(get_lang(request))["invalid_csrf"])


def hash_password(password: str, salt: str | None = None) -> str:
    salt_value = salt or os.urandom(16).hex()
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_value.encode("utf-8"),
        200000,
    ).hex()
    return f"pbkdf2_sha256${salt_value}${derived}"


def verify_password(stored_password: str, password: str) -> bool:
    if stored_password.startswith("pbkdf2_sha256$"):
        _, salt, expected = stored_password.split("$", 2)
        candidate = hash_password(password, salt)
        return hmac.compare_digest(candidate, stored_password)
    return hmac.compare_digest(stored_password, password)


def url_with_lang(request: Request, **updates: str | None) -> str:
    parsed = urlparse(str(request.url))
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    params.update({key: value for key, value in updates.items() if value is not None})
    params["lang"] = updates.get("lang") or params.get("lang") or get_lang(request)
    filtered = {key: value for key, value in params.items() if value != ""}
    query = urlencode(filtered)
    path = parsed.path or "/"
    return f"{path}?{query}" if query else path


def current_user(request: Request) -> sqlite3.Row | None:
    username = unsign_username(request.cookies.get("flacdium_session"))
    if not username:
        return None
    with get_db() as connection:
        return connection.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,),
        ).fetchone()


def require_admin(request: Request) -> sqlite3.Row:
    user = current_user(request)
    if user is None or not user["is_admin"] or not user["is_active"]:
        raise HTTPException(status_code=403, detail=text_for(get_lang(request))["admin_only"])
    return user


def get_client_ip(request: Request) -> tuple[str, str]:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip() if TRUST_PROXY else ""
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
        return ip_address, forwarded_for
    client_host = request.client.host if request.client else ""
    return client_host or "unknown", ""


def enforce_body_size_limit(request: Request, limit_bytes: int) -> None:
    raw_length = (request.headers.get("content-length") or "").strip()
    if raw_length.isdigit() and int(raw_length) > limit_bytes:
        raise HTTPException(status_code=413, detail=text_for(get_lang(request))["request_too_large"])


def check_rate_limit(request: Request, action: str, scope_key: str, limit: int, window_seconds: int) -> None:
    if limit <= 0 or window_seconds <= 0:
        return
    now = now_utc()
    cutoff = (now - timedelta(seconds=window_seconds)).isoformat()
    cleanup_cutoff = (now - timedelta(days=2)).isoformat()
    with get_db() as connection:
        connection.execute("DELETE FROM request_events WHERE created_at < ?", (cleanup_cutoff,))
        total = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM request_events
            WHERE action = ? AND scope_key = ? AND created_at >= ?
            """,
            (action, scope_key, cutoff),
        ).fetchone()["total"]
        if total >= limit:
            raise HTTPException(status_code=429, detail=text_for(get_lang(request))[f"rate_limit_{action}"])
        connection.execute(
            "INSERT INTO request_events (action, scope_key, created_at) VALUES (?, ?, ?)",
            (action, scope_key, now.isoformat()),
        )


def has_recent_request_event(action: str, scope_key: str, window_seconds: int) -> bool:
    if window_seconds <= 0:
        return False
    cutoff = (now_utc() - timedelta(seconds=window_seconds)).isoformat()
    with get_db() as connection:
        row = connection.execute(
            """
            SELECT 1
            FROM request_events
            WHERE action = ? AND scope_key = ? AND created_at >= ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (action, scope_key, cutoff),
        ).fetchone()
    return row is not None


def record_request_event(action: str, scope_key: str) -> None:
    with get_db() as connection:
        connection.execute(
            "INSERT INTO request_events (action, scope_key, created_at) VALUES (?, ?, ?)",
            (action, scope_key, now_utc().isoformat()),
        )


def enforce_login_rate_limit(request: Request, username_value: str) -> None:
    ip_address, _ = get_client_ip(request)
    check_rate_limit(request, "login", f"ip:{ip_address}", LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_SECONDS)
    if username_value:
        check_rate_limit(
            request,
            "login",
            f"user:{username_value.lower()}",
            LOGIN_RATE_LIMIT,
            LOGIN_RATE_WINDOW_SECONDS,
        )


def enforce_signup_rate_limit(request: Request, username_value: str) -> None:
    ip_address, _ = get_client_ip(request)
    check_rate_limit(request, "signup", f"ip:{ip_address}", SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_SECONDS)
    if username_value:
        check_rate_limit(
            request,
            "signup",
            f"user:{username_value.lower()}",
            SIGNUP_RATE_LIMIT,
            SIGNUP_RATE_WINDOW_SECONDS,
        )


def enforce_upload_rate_limit(request: Request, username_value: str, batch_id: str = "") -> None:
    ip_address, _ = get_client_ip(request)
    if batch_id:
        batch_scope = f"user:{username_value.lower()}:batch:{batch_id}"
        if has_recent_request_event("upload_batch", batch_scope, UPLOAD_RATE_WINDOW_SECONDS):
            return
    check_rate_limit(request, "upload", f"ip:{ip_address}", UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_SECONDS)
    check_rate_limit(
        request,
        "upload",
        f"user:{username_value.lower()}",
        UPLOAD_RATE_LIMIT,
        UPLOAD_RATE_WINDOW_SECONDS,
    )
    if batch_id:
        record_request_event("upload_batch", batch_scope)


def lookup_cell_location(cell_data: dict[str, str], ip_changed: bool) -> tuple[str, str, str]:
    if not ip_changed:
        return "not_needed", "", ""
    required = ("mcc", "mnc", "lac", "cellid")
    if any(not cell_data.get(key) for key in required):
        return "no_data", "", ""
    if not OPENCELLID_API_KEY:
        return "no_key", "", ""

    params = {
        "key": OPENCELLID_API_KEY,
        "mcc": cell_data["mcc"],
        "mnc": cell_data["mnc"],
        "lac": cell_data["lac"],
        "cellid": cell_data["cellid"],
        "format": "json",
    }
    if cell_data.get("radio"):
        params["radio"] = cell_data["radio"]
    url = f"{OPENCELLID_API_URL}?{urlencode(params)}"
    try:
        with urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        return "lookup_failed", "", str(exc)

    address_parts = [
        str(payload.get("address") or "").strip(),
        str(payload.get("lat") or "").strip(),
        str(payload.get("lon") or "").strip(),
    ]
    address = " | ".join(part for part in address_parts if part)
    return "ok", address, json.dumps(payload, ensure_ascii=False)


def record_login_log(
    *,
    request: Request,
    attempted_username: str,
    user: sqlite3.Row | None,
    success: bool,
    ip_changed: bool,
    cell_lookup_status: str,
    cell_lookup_address: str,
    cell_lookup_payload: str,
) -> None:
    ip_address, forwarded_for = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    with get_db() as connection:
        connection.execute(
            """
            INSERT INTO login_logs (
                user_id, attempted_username, success, ip_address, forwarded_for, user_agent,
                ip_changed, cell_lookup_status, cell_lookup_address, cell_lookup_payload, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"] if user is not None else None,
                attempted_username,
                1 if success else 0,
                ip_address,
                forwarded_for,
                user_agent,
                1 if ip_changed else 0,
                cell_lookup_status,
                cell_lookup_address,
                cell_lookup_payload,
                now_utc().isoformat(),
            ),
        )


def copy_stream_limited(source: Any, target: Any, max_bytes: int, error_code: str) -> int:
    total_bytes = 0
    while True:
        chunk = source.read(1024 * 1024)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_bytes:
            raise IngestError(error_code)
        target.write(chunk)
    return total_bytes


def extract_relaxed_candidate_info(source_path: Path) -> dict[str, Any]:
    try:
        audio = FLAC(str(source_path))
    except Exception:  # noqa: BLE001
        return {
            "artist": "",
            "album": "",
            "title": "",
            "file_size": source_path.stat().st_size if source_path.exists() else 0,
        }
    return {
        "artist": first_tag(audio, "artist"),
        "album": first_tag(audio, "album"),
        "title": first_tag(audio, "title"),
        "file_size": source_path.stat().st_size if source_path.exists() else 0,
    }


def queue_review_item(
    *,
    source_path: Path,
    original_filename: str,
    uploader: str,
    reason: str,
    suggested_action: str,
    existing_track_id: int | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    review_name = review_candidate_filename(original_filename)
    stored_candidate = REVIEW_DIR / review_name
    shutil.copy2(source_path, stored_candidate)
    info = meta or extract_relaxed_candidate_info(source_path)
    with get_db() as connection:
        connection.execute(
            """
            INSERT INTO review_items (
                uploader, original_filename, candidate_path, reason, status, suggested_action,
                existing_track_id, artist, album, title, file_size, created_at
            ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uploader,
                original_filename,
                review_name,
                reason,
                suggested_action,
                existing_track_id,
                str(info.get("artist") or ""),
                str(info.get("album") or ""),
                str(info.get("title") or ""),
                int(info.get("file_size") or 0),
                now_utc().isoformat(),
            ),
        )


def ensure_track_uploader_credit(
    connection: sqlite3.Connection,
    track_id: int,
    username: str,
    added_at: str,
) -> None:
    connection.execute(
        """
        INSERT OR IGNORE INTO track_uploaders (track_id, username, added_at)
        VALUES (?, ?, ?)
        """,
        (track_id, username, added_at),
    )


def cleanup_track_file_refs(old_blob_path: str, old_stored_path: str, old_cover_path: str) -> None:
    with get_db() as connection:
        if old_stored_path:
            still_uses_alias = connection.execute(
                "SELECT COUNT(*) AS total FROM tracks WHERE stored_path = ?",
                (old_stored_path,),
            ).fetchone()["total"]
            if still_uses_alias == 0:
                (LIBRARY_DIR / old_stored_path).unlink(missing_ok=True)
        if old_blob_path:
            still_uses_blob = connection.execute(
                "SELECT COUNT(*) AS total FROM tracks WHERE blob_path = ?",
                (old_blob_path,),
            ).fetchone()["total"]
            if still_uses_blob == 0:
                (LIBRARY_DIR / old_blob_path).unlink(missing_ok=True)
        if old_cover_path:
            still_uses_cover = connection.execute(
                "SELECT COUNT(*) AS total FROM tracks WHERE cover_path = ?",
                (old_cover_path,),
            ).fetchone()["total"]
            if still_uses_cover == 0:
                (COVERS_DIR / old_cover_path).unlink(missing_ok=True)


def spectrum_cache_path(track_id: int, file_hash: str) -> Path:
    return SPECTRUM_DIR / f"{track_id}-{file_hash[:16]}.png"


def ensure_spectrum_image(track_row: sqlite3.Row) -> Path:
    blob_relative = track_row["blob_path"] or track_row["stored_path"]
    source_path = LIBRARY_DIR / blob_relative
    if not source_path.exists():
        raise HTTPException(status_code=404, detail=text_for("vi")["file_missing"])
    file_hash = str(track_row["file_hash"] or "")
    if not file_hash:
        file_hash = hash_file(source_path)
        with get_db() as connection:
            connection.execute(
                "UPDATE tracks SET file_hash = ? WHERE id = ? AND (file_hash IS NULL OR file_hash = '')",
                (file_hash, int(track_row["id"])),
            )
    target_path = spectrum_cache_path(int(track_row["id"]), file_hash)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.exists():
        return target_path
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source_path),
            "-lavfi",
            "showspectrumpic=s=1600x900:legend=enabled:color=intensity:scale=log:fscale=lin:gain=2:drange=135",
            "-frames:v",
            "1",
            str(target_path),
            "-y",
        ],
        check=True,
        timeout=90,
    )
    return target_path


def download_filename_for_track(track_row: sqlite3.Row) -> str:
    title = safe_segment(str(track_row["title"] or "track"))
    artist = safe_segment(str(track_row["artist"] or "unknown"))
    return f"{title} ({artist}).flac"


def bundle_filename() -> str:
    return f"flacdium-bundle-{now_utc().strftime('%Y%m%d%H%M%S')}.zip"


def unique_bundle_member_name(name: str, used_names: set[str]) -> str:
    candidate = name
    stem = Path(name).stem
    suffix = Path(name).suffix or ".flac"
    counter = 2
    while candidate in used_names:
        candidate = f"{stem} [{counter}]{suffix}"
        counter += 1
    used_names.add(candidate)
    return candidate


def build_uploader_map(connection: sqlite3.Connection, track_ids: list[int]) -> dict[int, list[str]]:
    if not track_ids:
        return {}
    if not table_exists(connection, "track_uploaders"):
        rows = connection.execute(
            f"""
            SELECT id AS track_id, uploader AS username
            FROM tracks
            WHERE id IN ({",".join("?" for _ in track_ids)})
            """,
            track_ids,
        ).fetchall()
        return {
            int(row["track_id"]): [str(row["username"])]
            for row in rows
        }
    placeholders = ",".join("?" for _ in track_ids)
    rows = connection.execute(
        f"""
        SELECT track_id, username
        FROM track_uploaders
        WHERE track_id IN ({placeholders})
        ORDER BY added_at DESC, username COLLATE NOCASE ASC
        """,
        track_ids,
    ).fetchall()
    mapping: dict[int, list[str]] = {track_id: [] for track_id in track_ids}
    for row in rows:
        mapping.setdefault(int(row["track_id"]), []).append(str(row["username"]))
    return mapping


def format_uploader_display(usernames: list[str]) -> tuple[str, str]:
    if not usernames:
        return "-", "-"
    if len(usernames) <= MAX_VISIBLE_UPLOADER_CREDITS:
        full = ", ".join(usernames)
        return full, full
    visible = ", ".join(usernames[:MAX_VISIBLE_UPLOADER_CREDITS])
    return f"{visible}, ...", ", ".join(usernames)


def extract_flac_payload(source_path: Path, allow_quality_override: bool = False) -> dict[str, Any]:
    try:
        audio = FLAC(str(source_path))
    except Exception as exc:  # noqa: BLE001
        raise IngestError("broken_flac") from exc

    missing = [tag for tag in REQUIRED_TAGS if not first_tag(audio, tag)]
    if missing:
        raise IngestError("missing_tags:" + ",".join(missing))
    if not audio.pictures:
        raise IngestError("missing_cover")

    artist = first_tag(audio, "artist")
    album = first_tag(audio, "album")
    title = first_tag(audio, "title")
    date = first_tag(audio, "date")
    track_number = parse_number(first_tag(audio, "tracknumber"))
    disc_number = parse_number(first_tag(audio, "discnumber"), default=1)
    year = parse_year(date)
    picture = audio.pictures[0]

    if track_number <= 0:
        raise IngestError("invalid_track")
    if int(round(audio.info.length)) <= 0:
        raise IngestError("broken_flac")
    if not picture.mime.startswith("image/"):
        raise IngestError("unsupported_cover")
    if not allow_quality_override and int(audio.info.sample_rate) < MIN_SAMPLE_RATE:
        raise IngestError("low_quality_sample_rate")
    bit_depth = int(getattr(audio.info, "bits_per_sample", 0) or 0)
    if not allow_quality_override and bit_depth and bit_depth < MIN_BIT_DEPTH:
        raise IngestError("low_quality_bit_depth")

    duration_seconds = int(round(audio.info.length))
    spectral_profile = analyze_spectral_profile(
        source_path,
        int(audio.info.sample_rate),
        duration_seconds,
    )
    if (
        not allow_quality_override
        and spectral_profile_suspicious(spectral_profile, int(audio.info.sample_rate))
    ):
        raise IngestError("lossy_transcode_suspected")

    cover_hash = hash_bytes(picture.data)
    audio_fingerprint = compute_audio_fingerprint(source_path, duration_seconds)
    return {
        "artist": artist,
        "album": album,
        "title": title,
        "album_artist": first_tag(audio, "albumartist") or artist,
        "genre": first_tag(audio, "genre"),
        "release_date": date,
        "year": year,
        "track_number": track_number,
        "disc_number": disc_number or 1,
        "duration_seconds": duration_seconds,
        "sample_rate": int(audio.info.sample_rate),
        "bit_depth": bit_depth,
        "channels": int(audio.info.channels),
        "cover_bytes": picture.data,
        "cover_ext": cover_extension(picture.mime),
        "cover_hash": cover_hash,
        "audio_fingerprint": audio_fingerprint,
        "spectral_profile": spectral_profile,
        "slot_key": {
            "artist": normalize_slot_value(artist),
            "album": normalize_slot_value(album),
            "title": normalize_slot_value(title),
            "disc_number": disc_number or 1,
            "track_number": track_number,
        },
    }


def find_duplicate(
    connection: sqlite3.Connection,
    meta: dict[str, Any],
    file_hash: str,
) -> dict[str, Any] | None:
    exact = connection.execute(
        "SELECT * FROM tracks WHERE file_hash = ?",
        (file_hash,),
    ).fetchone()
    if exact is not None:
        return {"action": "merge_credit", "track": exact, "reason": "duplicate_hash"}

    slot = meta["slot_key"]
    candidates = connection.execute(
        """
        SELECT *
        FROM tracks
        WHERE lower(trim(artist)) = ?
          AND lower(trim(album)) = ?
          AND lower(trim(title)) = ?
          AND disc_number = ?
          AND track_number = ?
        ORDER BY uploaded_at DESC
        """,
        (
            slot["artist"],
            slot["album"],
            slot["title"],
            slot["disc_number"],
            slot["track_number"],
        ),
    ).fetchall()
    if not candidates:
        return None

    for candidate in candidates:
        duration_delta = abs(int(candidate["duration_seconds"]) - int(meta["duration_seconds"]))
        similarity = fingerprint_similarity(
            meta["audio_fingerprint"],
            str(candidate["audio_fingerprint"] or ""),
        )
        if (
            duration_delta <= MAX_FINGERPRINT_DURATION_DELTA_SECONDS
            and similarity >= MIN_FINGERPRINT_SIMILARITY
        ):
            return {"action": "merge_credit", "track": candidate, "reason": "duplicate_hash"}
    return {"action": "reject", "track": candidates[0], "reason": "duplicate_slot"}


def save_cover(meta: dict[str, Any]) -> str:
    cover_folder = COVERS_DIR / safe_segment(meta["artist"]) / safe_segment(meta["album"])
    cover_folder.mkdir(parents=True, exist_ok=True)
    cover_path = cover_folder / f"cover-{meta['cover_hash'][:12]}{meta['cover_ext']}"
    if not cover_path.exists():
        cover_path.write_bytes(meta["cover_bytes"])
    return cover_path.relative_to(COVERS_DIR).as_posix()


def ensure_blob(source_path: Path, file_hash: str) -> str:
    blob_folder = OBJECTS_DIR / file_hash[:2] / file_hash[2:4]
    blob_folder.mkdir(parents=True, exist_ok=True)
    blob_path = blob_folder / f"{file_hash}.flac"
    if not blob_path.exists():
        shutil.copy2(source_path, blob_path)
    return blob_path.relative_to(LIBRARY_DIR).as_posix()


def store_track_alias(
    blob_relative_path: str,
    meta: dict[str, Any],
    replace_existing_relative_path: str | None = None,
) -> str:
    album_folder = LIBRARY_DIR / safe_segment(meta["artist"]) / safe_segment(meta["album"])
    album_folder.mkdir(parents=True, exist_ok=True)
    prefix = f"{meta['disc_number']:02d}-{meta['track_number']:02d}"
    desired_path = album_folder / f"{prefix} {safe_segment(meta['title'])}.flac"
    alias_path = desired_path
    if replace_existing_relative_path:
        previous_path = LIBRARY_DIR / replace_existing_relative_path
        if previous_path.exists() and previous_path != desired_path:
            previous_path.unlink(missing_ok=True)
        if desired_path.exists() and desired_path != previous_path:
            alias_path = unique_path(desired_path)
    else:
        alias_path = unique_path(desired_path)
    blob_path = LIBRARY_DIR / blob_relative_path
    if alias_path.exists():
        alias_path.unlink(missing_ok=True)
    os.link(blob_path, alias_path)
    return alias_path.relative_to(LIBRARY_DIR).as_posix()


def save_track_record(
    uploader: str,
    original_filename: str,
    stored_path: str,
    blob_path: str,
    cover_path: str,
    meta: dict[str, Any],
    file_size: int,
    file_hash: str,
    ingest_note: str = "",
) -> int:
    uploaded_at = now_utc().isoformat()
    with get_db() as connection:
        cursor = connection.execute(
            """
            INSERT INTO tracks (
                uploader, original_filename, stored_path, cover_path, artist, album, title,
                album_artist, genre, release_date, year, track_number, disc_number,
                duration_seconds, sample_rate, bit_depth, channels, file_size, uploaded_at,
                file_hash, cover_hash, ingest_note, blob_path, audio_fingerprint
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uploader,
                original_filename,
                stored_path,
                cover_path,
                meta["artist"],
                meta["album"],
                meta["title"],
                meta["album_artist"],
                meta["genre"],
                meta["release_date"],
                meta["year"],
                meta["track_number"],
                meta["disc_number"],
                meta["duration_seconds"],
                meta["sample_rate"],
                meta["bit_depth"],
                meta["channels"],
                file_size,
                uploaded_at,
                file_hash,
                meta["cover_hash"],
                ingest_note,
                blob_path,
                meta["audio_fingerprint"],
            ),
        )
        track_id = int(cursor.lastrowid)
        ensure_track_uploader_credit(connection, track_id, uploader, uploaded_at)
    return track_id


def store_new_track_from_meta(
    source_path: Path,
    original_filename: str,
    uploader: str,
    meta: dict[str, Any],
    *,
    ingest_note: str = "",
) -> dict[str, str]:
    file_hash = hash_file(source_path)
    cover_path = save_cover(meta)
    blob_path = ensure_blob(source_path, file_hash)
    stored_path = store_track_alias(blob_path, meta)
    save_track_record(
        uploader=uploader,
        original_filename=original_filename,
        stored_path=stored_path,
        blob_path=blob_path,
        cover_path=cover_path,
        meta=meta,
        file_size=source_path.stat().st_size,
        file_hash=file_hash,
        ingest_note=ingest_note,
    )
    return {
        "artist": meta["artist"],
        "album": meta["album"],
        "title": meta["title"],
        "status": "stored",
        "file_hash": file_hash,
    }


def merge_existing_track(
    existing_track: sqlite3.Row,
    uploader: str,
    original_filename: str,
    source_path: Path,
    meta: dict[str, Any],
    file_hash: str,
    duplicate_reason: str,
) -> str:
    uploaded_at = now_utc().isoformat()
    old_blob_path = str(existing_track["blob_path"] or existing_track["stored_path"] or "")
    old_stored_path = str(existing_track["stored_path"] or "")
    old_cover_path = str(existing_track["cover_path"] or "")
    should_replace = (
        file_hash != str(existing_track["file_hash"] or "")
        and meta_quality_tuple(meta, source_path.stat().st_size) >= track_quality_tuple(existing_track)
    )
    if should_replace:
        cover_path = save_cover(meta)
        blob_path = ensure_blob(source_path, file_hash)
        stored_path = store_track_alias(
            blob_path,
            meta,
            replace_existing_relative_path=old_stored_path or None,
        )
        with get_db() as connection:
            connection.execute(
                """
                UPDATE tracks
                SET uploader = ?, original_filename = ?, stored_path = ?, blob_path = ?, cover_path = ?,
                    artist = ?, album = ?, title = ?, album_artist = ?, genre = ?, release_date = ?,
                    year = ?, track_number = ?, disc_number = ?, duration_seconds = ?, sample_rate = ?,
                    bit_depth = ?, channels = ?, file_size = ?, uploaded_at = ?, file_hash = ?,
                    cover_hash = ?, ingest_note = ?, audio_fingerprint = ?
                WHERE id = ?
                """,
                (
                    uploader,
                    original_filename,
                    stored_path,
                    blob_path,
                    cover_path,
                    meta["artist"],
                    meta["album"],
                    meta["title"],
                    meta["album_artist"],
                    meta["genre"],
                    meta["release_date"],
                    meta["year"],
                    meta["track_number"],
                    meta["disc_number"],
                    meta["duration_seconds"],
                    meta["sample_rate"],
                    meta["bit_depth"],
                    meta["channels"],
                    source_path.stat().st_size,
                    uploaded_at,
                    file_hash,
                    meta["cover_hash"],
                    "replaced_by_newer_upload",
                    meta["audio_fingerprint"],
                    existing_track["id"],
                ),
            )
            ensure_track_uploader_credit(connection, int(existing_track["id"]), uploader, uploaded_at)
        cleanup_track_file_refs(old_blob_path, old_stored_path, old_cover_path)
        return "duplicate_replaced"

    with get_db() as connection:
        connection.execute(
            """
            UPDATE tracks
            SET uploader = ?, original_filename = ?, uploaded_at = ?, ingest_note = ?
            WHERE id = ?
            """,
            (
                uploader,
                original_filename,
                uploaded_at,
                duplicate_reason,
                existing_track["id"],
            ),
        )
        ensure_track_uploader_credit(connection, int(existing_track["id"]), uploader, uploaded_at)
    return "duplicate_credited"


def ingest_flac(source_path: Path, original_filename: str, uploader: str) -> dict[str, str]:
    meta = extract_flac_payload(source_path)
    file_hash = hash_file(source_path)
    with get_db() as connection:
        duplicate_match = find_duplicate(connection, meta, file_hash)
    if duplicate_match:
        queue_review_item(
            source_path=source_path,
            original_filename=original_filename,
            uploader=uploader,
            reason=str(duplicate_match["reason"]),
            suggested_action="merge_existing" if duplicate_match["action"] == "merge_credit" else "import_anyway",
            existing_track_id=int(duplicate_match["track"]["id"]) if duplicate_match.get("track") else None,
            meta=meta,
        )
        return {
            "artist": meta["artist"],
            "album": meta["album"],
            "title": meta["title"],
            "status": "queued_duplicate_review",
        }
    return store_new_track_from_meta(source_path, original_filename, uploader, meta)


async def save_upload_to_tmp(upload: UploadFile, suffix: str, max_bytes: int, error_code: str) -> tuple[Path, int]:
    handle = tempfile.NamedTemporaryFile(delete=False, dir=TMP_DIR, suffix=suffix)
    total_bytes = 0
    try:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                raise IngestError(error_code)
            handle.write(chunk)
        return Path(handle.name), total_bytes
    finally:
        handle.close()
        await upload.close()


def normalize_batch_id(raw_value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "", raw_value or "")[:64]


def batch_work_dir(batch_id: str) -> Path:
    safe_batch_id = normalize_batch_id(batch_id)
    if not safe_batch_id:
        raise IngestError("nothing_uploaded")
    return BATCH_DIR / safe_batch_id


def batch_meta_path(batch_id: str, upload_token: str) -> Path:
    return batch_work_dir(batch_id) / f"{upload_token}.json"


def batch_part_path(batch_id: str, upload_token: str) -> Path:
    return batch_work_dir(batch_id) / f"{upload_token}.part"


def cleanup_batch_dir(batch_id: str) -> None:
    shutil.rmtree(batch_work_dir(batch_id), ignore_errors=True)


def describe_error(code: str, lang: str) -> str:
    t = text_for(lang)
    if ":" not in code:
        return t.get(code, code.replace("_", " "))
    prefix, suffix = code.split(":", 1)
    if prefix == "missing_tags":
        return f"{t['missing_tags']}: {suffix}"
    return f"{t.get(prefix, prefix)}: {suffix}"


def should_queue_review_for_error(code: str) -> bool:
    return code in {
        "lossy_transcode_suspected",
        "low_quality_sample_rate",
        "low_quality_bit_depth",
    }


def ingest_staged_flac(
    staged_path: Path,
    original_filename: str,
    uploader: str,
    accepted: list[str],
    rejected: list[str],
    lang: str,
) -> None:
    try:
        meta = ingest_flac(staged_path, original_filename, uploader)
        accepted.append(acceptance_label(meta, lang))
    except IngestError as exc:
        if should_queue_review_for_error(str(exc)):
            queue_review_item(
                source_path=staged_path,
                original_filename=original_filename,
                uploader=uploader,
                reason=str(exc),
                suggested_action="import_anyway",
            )
            accepted.append(
                acceptance_label(
                    {
                        **extract_relaxed_candidate_info(staged_path),
                        "status": "queued_quality_review",
                    },
                    lang,
                )
            )
        else:
            rejected.append(f"{original_filename}: {describe_error(str(exc), lang)}")


def process_zip_path(
    zip_path: Path,
    zip_name: str,
    uploader: str,
    accepted: list[str],
    rejected: list[str],
    lang: str,
) -> None:
    try:
        with ZipFile(zip_path) as archive:
            members = [member for member in archive.infolist() if not member.is_dir()]
            flac_members = [member for member in members if member.filename.lower().endswith(".flac")]
            if not flac_members:
                rejected.append(f"{zip_name}: {text_for(lang)['zip_empty']}")
            if len(flac_members) > MAX_ZIP_MEMBERS:
                rejected.append(f"{zip_name}: {text_for(lang)['zip_too_many_members']}")
                return
            total_unpacked_bytes = 0
            for member in flac_members:
                if member.file_size > MAX_ZIP_MEMBER_BYTES:
                    rejected.append(f"{member.filename}: {text_for(lang)['zip_member_too_large']}")
                    continue
                if total_unpacked_bytes + member.file_size > MAX_ZIP_TOTAL_UNPACKED_BYTES:
                    rejected.append(f"{zip_name}: {text_for(lang)['zip_unpacked_too_large']}")
                    break
                tmp_flac = Path(
                    tempfile.NamedTemporaryFile(delete=False, dir=TMP_DIR, suffix=".flac").name
                )
                try:
                    with archive.open(member) as source, tmp_flac.open("wb") as target:
                        written_bytes = copy_stream_limited(
                            source,
                            target,
                            MAX_ZIP_MEMBER_BYTES,
                            "zip_member_too_large",
                        )
                    total_unpacked_bytes += written_bytes
                    ingest_staged_flac(
                        tmp_flac,
                        Path(member.filename).name,
                        uploader,
                        accepted,
                        rejected,
                        lang,
                    )
                finally:
                    tmp_flac.unlink(missing_ok=True)
    except IngestError as exc:
        rejected.append(f"{zip_name}: {describe_error(str(exc), lang)}")
    except Exception as exc:  # noqa: BLE001
        rejected.append(f"{zip_name}: {exc}")


async def process_direct_uploads(
    files: list[UploadFile],
    uploader: str,
    accepted: list[str],
    rejected: list[str],
    lang: str,
) -> None:
    named_uploads = [upload for upload in files if upload.filename]
    if len(named_uploads) > MAX_UPLOAD_FILES:
        rejected.append(text_for(lang)["too_many_upload_files"])
        for upload in named_uploads:
            await upload.close()
        return

    staged_uploads: list[tuple[str, Path]] = []
    total_bytes = 0
    for upload in files:
        if not upload.filename:
            continue
        if not upload.filename.lower().endswith(".flac"):
            rejected.append(f"{upload.filename}: {text_for(lang)['not_flac']}")
            await upload.close()
            continue

        tmp_path: Path | None = None
        try:
            tmp_path, file_size = await save_upload_to_tmp(
                upload,
                ".flac",
                MAX_UPLOAD_FILE_BYTES,
                "upload_file_too_large",
            )
            total_bytes += file_size
            if total_bytes > MAX_UPLOAD_TOTAL_BYTES:
                tmp_path.unlink(missing_ok=True)
                tmp_path = None
                rejected.append(text_for(lang)["upload_total_too_large"])
                for staged_name, staged_path in staged_uploads:
                    staged_path.unlink(missing_ok=True)
                staged_uploads.clear()
                break
            staged_uploads.append((upload.filename, tmp_path))
            tmp_path = None
        except IngestError as exc:
            rejected.append(f"{upload.filename}: {describe_error(str(exc), lang)}")
        finally:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)

    for original_filename, tmp_path in staged_uploads:
        try:
            ingest_staged_flac(tmp_path, original_filename, uploader, accepted, rejected, lang)
        finally:
            tmp_path.unlink(missing_ok=True)


async def process_zip_upload(
    zip_upload: UploadFile | None,
    uploader: str,
    accepted: list[str],
    rejected: list[str],
    lang: str,
) -> None:
    if zip_upload is None or not zip_upload.filename:
        return
    if not zip_upload.filename.lower().endswith(".zip"):
        rejected.append(f"{zip_upload.filename}: {text_for(lang)['not_zip']}")
        await zip_upload.close()
        return

    zip_path: Path | None = None
    try:
        zip_path, _ = await save_upload_to_tmp(
            zip_upload,
            ".zip",
            MAX_ZIP_FILE_BYTES,
            "zip_file_too_large",
        )
        process_zip_path(zip_path, zip_upload.filename, uploader, accepted, rejected, lang)
    except IngestError as exc:
        rejected.append(f"{zip_upload.filename}: {describe_error(str(exc), lang)}")
    except Exception as exc:  # noqa: BLE001
        rejected.append(f"{zip_upload.filename}: {exc}")
    finally:
        if zip_path is not None:
            zip_path.unlink(missing_ok=True)


async def append_chunk_to_batch(
    chunk: UploadFile,
    *,
    batch_id: str,
    upload_token: str,
    upload_name: str,
    upload_kind: str,
    chunk_offset: int,
    upload_size: int,
) -> dict[str, Any]:
    work_dir = batch_work_dir(batch_id)
    work_dir.mkdir(parents=True, exist_ok=True)
    token = re.sub(r"[^a-zA-Z0-9_-]", "", upload_token or "")[:64]
    if not token:
        raise IngestError("nothing_uploaded")
    if upload_kind not in {"file", "zip"}:
        raise IngestError("nothing_uploaded")
    max_size = MAX_ZIP_FILE_BYTES if upload_kind == "zip" else MAX_UPLOAD_FILE_BYTES
    error_code = "zip_file_too_large" if upload_kind == "zip" else "upload_file_too_large"
    if upload_size <= 0 or upload_size > max_size:
        raise IngestError(error_code)
    if chunk_offset < 0 or chunk_offset > upload_size:
        raise IngestError(error_code)

    part_path = batch_part_path(batch_id, token)
    meta_path = batch_meta_path(batch_id, token)
    meta = {
        "token": token,
        "name": upload_name,
        "kind": upload_kind,
        "size": upload_size,
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    total_written = 0
    try:
        with part_path.open("r+b") if part_path.exists() else part_path.open("w+b") as handle:
            handle.seek(chunk_offset)
            while True:
                raw = await chunk.read(1024 * 1024)
                if not raw:
                    break
                total_written += len(raw)
                if chunk_offset + total_written > upload_size:
                    raise IngestError(error_code)
                handle.write(raw)
        if part_path.stat().st_size > upload_size:
            raise IngestError(error_code)
        return meta
    finally:
        await chunk.close()


def process_completed_batch(
    batch_id: str,
    uploader: str,
    accepted: list[str],
    rejected: list[str],
    lang: str,
) -> None:
    work_dir = batch_work_dir(batch_id)
    if not work_dir.exists():
        raise IngestError("nothing_uploaded")
    meta_files = sorted(work_dir.glob("*.json"))
    if not meta_files:
        raise IngestError("nothing_uploaded")
    if len(meta_files) > MAX_UPLOAD_FILES:
        raise IngestError("too_many_upload_files")

    total_bytes = 0
    for meta_path in meta_files:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        part_path = batch_part_path(batch_id, str(meta["token"]))
        expected_size = int(meta["size"])
        if not part_path.exists() or part_path.stat().st_size != expected_size:
            rejected.append(f"{meta['name']}: {text_for(lang)['upload_progress_error']}")
            continue
        total_bytes += expected_size
        if total_bytes > MAX_UPLOAD_TOTAL_BYTES:
            raise IngestError("upload_total_too_large")
        if meta["kind"] == "zip":
            process_zip_path(part_path, str(meta["name"]), uploader, accepted, rejected, lang)
        else:
            ingest_staged_flac(part_path, str(meta["name"]), uploader, accepted, rejected, lang)


def human_duration(seconds: int) -> str:
    minutes, seconds = divmod(seconds, 60)
    return f"{minutes}:{seconds:02d}"


def human_specs(row: sqlite3.Row) -> str:
    depth = f"{row['bit_depth']}bit" if row["bit_depth"] else "lossless"
    rate = f"{row['sample_rate'] / 1000:.1f}k".replace(".0k", "k")
    return f"{depth} / {rate} / {row['channels']}ch"


def human_size(num_bytes: int) -> str:
    units = ("B", "KB", "MB", "GB", "TB")
    value = float(num_bytes)
    unit = units[0]
    for unit in units:
        if value < 1024 or unit == units[-1]:
            break
        value /= 1024
    if unit == "B":
        return f"{int(value)} {unit}"
    return f"{value:.1f} {unit}"


def acceptance_label(meta: dict[str, str], lang: str) -> str:
    suffix_key = {
        "stored": "",
        "duplicate_credited": f" [{text_for(lang)['duplicate_credited']}]",
        "duplicate_replaced": f" [{text_for(lang)['duplicate_replaced']}]",
        "queued_duplicate_review": f" [{text_for(lang)['queued_duplicate_review']}]",
        "queued_quality_review": f" [{text_for(lang)['queued_quality_review']}]",
    }.get(meta.get("status", "stored"), "")
    return f"{meta['artist']} / {meta['album']} / {meta['title']}{suffix_key}"


def parse_page(raw_value: str | None) -> int:
    try:
        page = int(raw_value or "1")
    except ValueError:
        return 1
    return max(page, 1)


def relative_uploaded(iso_value: str, lang: str) -> str:
    uploaded_at = datetime.fromisoformat(iso_value)
    delta = datetime.now(timezone.utc) - uploaded_at
    total_hours = int(delta.total_seconds() // 3600)
    t = text_for(lang)
    if total_hours < 1:
        return t["fresh"]
    if total_hours < 24:
        return f"{total_hours}h ago"
    return f"{total_hours // 24}d ago"


def human_datetime(iso_value: str) -> str:
    if not iso_value:
        return "-"
    try:
        dt = datetime.fromisoformat(iso_value)
    except ValueError:
        return iso_value
    return dt.astimezone().strftime("%Y-%m-%d %H:%M")


def build_pagination(
    request: Request,
    page_param: str,
    page: int,
    total_items: int,
    per_page: int,
) -> dict[str, Any]:
    total_pages = max((total_items + per_page - 1) // per_page, 1)
    current_page = min(page, total_pages)
    prev_url = ""
    next_url = ""
    if current_page > 1:
        prev_url = url_with_lang(request, **{page_param: str(current_page - 1)})
    if current_page < total_pages:
        next_url = url_with_lang(request, **{page_param: str(current_page + 1)})
    return {
        "page": current_page,
        "total_pages": total_pages,
        "prev_url": prev_url,
        "next_url": next_url,
        "total_items": total_items,
    }


def fetch_sidebar_lists(connection: sqlite3.Connection, request: Request) -> dict[str, dict[str, Any]]:
    artists_page = parse_page(request.query_params.get("artists_page"))
    albums_page = parse_page(request.query_params.get("albums_page"))
    uploaders_page = parse_page(request.query_params.get("uploaders_page"))

    artists_total = connection.execute(
        "SELECT COUNT(*) AS total FROM (SELECT artist FROM tracks GROUP BY artist)"
    ).fetchone()["total"]
    albums_total = connection.execute(
        "SELECT COUNT(*) AS total FROM (SELECT artist, album FROM tracks GROUP BY artist, album)"
    ).fetchone()["total"]
    if table_exists(connection, "track_uploaders"):
        uploaders_total = connection.execute(
            "SELECT COUNT(*) AS total FROM (SELECT username FROM track_uploaders GROUP BY username)"
        ).fetchone()["total"]
    else:
        uploaders_total = connection.execute(
            "SELECT COUNT(*) AS total FROM (SELECT uploader FROM tracks GROUP BY uploader)"
        ).fetchone()["total"]

    artists_page = min(artists_page, max((artists_total + SIDEBAR_PAGE_SIZE - 1) // SIDEBAR_PAGE_SIZE, 1))
    albums_page = min(albums_page, max((albums_total + SIDEBAR_PAGE_SIZE - 1) // SIDEBAR_PAGE_SIZE, 1))
    uploaders_page = min(uploaders_page, max((uploaders_total + SIDEBAR_PAGE_SIZE - 1) // SIDEBAR_PAGE_SIZE, 1))

    artists = connection.execute(
        """
        SELECT artist, COUNT(*) AS tracks
        FROM tracks
        GROUP BY artist
        ORDER BY tracks DESC, artist COLLATE NOCASE ASC
        LIMIT ? OFFSET ?
        """,
        (SIDEBAR_PAGE_SIZE, (artists_page - 1) * SIDEBAR_PAGE_SIZE),
    ).fetchall()
    albums = connection.execute(
        """
        SELECT artist, album, cover_path, COUNT(*) AS tracks
        FROM tracks
        GROUP BY artist, album
        ORDER BY MAX(uploaded_at) DESC
        LIMIT ? OFFSET ?
        """,
        (SIDEBAR_PAGE_SIZE, (albums_page - 1) * SIDEBAR_PAGE_SIZE),
    ).fetchall()
    if table_exists(connection, "track_uploaders"):
        uploaders = connection.execute(
            """
            SELECT username AS uploader, COUNT(DISTINCT track_id) AS tracks
            FROM track_uploaders
            GROUP BY username
            ORDER BY tracks DESC, username COLLATE NOCASE ASC
            LIMIT ? OFFSET ?
            """,
            (SIDEBAR_PAGE_SIZE, (uploaders_page - 1) * SIDEBAR_PAGE_SIZE),
        ).fetchall()
    else:
        uploaders = connection.execute(
            """
            SELECT uploader, COUNT(*) AS tracks
            FROM tracks
            GROUP BY uploader
            ORDER BY tracks DESC, uploader COLLATE NOCASE ASC
            LIMIT ? OFFSET ?
            """,
            (SIDEBAR_PAGE_SIZE, (uploaders_page - 1) * SIDEBAR_PAGE_SIZE),
        ).fetchall()

    return {
        "artists": {
            "items": artists,
            "pagination": build_pagination(
                request, "artists_page", artists_page, artists_total, SIDEBAR_PAGE_SIZE
            ),
        },
        "albums": {
            "items": albums,
            "pagination": build_pagination(
                request, "albums_page", albums_page, albums_total, SIDEBAR_PAGE_SIZE
            ),
        },
        "uploaders": {
            "items": uploaders,
            "pagination": build_pagination(
                request, "uploaders_page", uploaders_page, uploaders_total, SIDEBAR_PAGE_SIZE
            ),
        },
    }


def fetch_summary(connection: sqlite3.Connection) -> sqlite3.Row:
    if table_exists(connection, "track_uploaders"):
        return connection.execute(
            """
            SELECT
                COUNT(*) AS tracks,
                COUNT(DISTINCT artist) AS artists,
                COUNT(DISTINCT artist || '::' || album) AS albums,
                (SELECT COUNT(DISTINCT username) FROM track_uploaders) AS uploaders
            FROM tracks
            """
        ).fetchone()
    return connection.execute(
        """
        SELECT
            COUNT(*) AS tracks,
            COUNT(DISTINCT artist) AS artists,
            COUNT(DISTINCT artist || '::' || album) AS albums,
            COUNT(DISTINCT uploader) AS uploaders
        FROM tracks
        """
    ).fetchone()


def fetch_tracks(
    connection: sqlite3.Connection,
    request: Request,
    lang: str,
) -> tuple[list[dict[str, Any]], dict[str, str], dict[str, Any]]:
    q = (request.query_params.get("q") or "").strip()
    uploader = (request.query_params.get("uploader") or "").strip()
    artist = (request.query_params.get("artist") or "").strip()
    album = (request.query_params.get("album") or "").strip()
    sort = request.query_params.get("sort") or "newest"
    track_page = parse_page(request.query_params.get("track_page"))
    order_by = SORTS.get(sort, SORTS["newest"])

    sql = "FROM tracks WHERE 1=1"
    params: list[Any] = []

    if q:
        sql += " AND (title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?)"
        token = f"%{q}%"
        params.extend([token, token, token, token])
    if uploader:
        if table_exists(connection, "track_uploaders"):
            sql += " AND EXISTS (SELECT 1 FROM track_uploaders tu WHERE tu.track_id = tracks.id AND tu.username = ?)"
        else:
            sql += " AND uploader = ?"
        params.append(uploader)
    if artist:
        sql += " AND artist = ?"
        params.append(artist)
    if album:
        sql += " AND album = ?"
        params.append(album)

    total_items = connection.execute(f"SELECT COUNT(*) AS total {sql}", params).fetchone()["total"]
    pagination = build_pagination(request, "track_page", track_page, total_items, TRACKS_PER_PAGE)
    rows = connection.execute(
        f"SELECT * {sql} ORDER BY {order_by} LIMIT ? OFFSET ?",
        (*params, TRACKS_PER_PAGE, (pagination["page"] - 1) * TRACKS_PER_PAGE),
    ).fetchall()
    filters = {
        "q": q,
        "uploader": uploader,
        "artist": artist,
        "album": album,
        "sort": sort,
    }
    tracks: list[dict[str, Any]] = []
    uploader_map = build_uploader_map(connection, [int(row["id"]) for row in rows])
    for row in rows:
        track = dict(row)
        track["duration_label"] = human_duration(row["duration_seconds"])
        track["specs_label"] = human_specs(row)
        track["size_label"] = human_size(row["file_size"])
        track["uploaded_label"] = relative_uploaded(row["uploaded_at"], lang)
        track["cover_url"] = f"/covers/{row['cover_path']}"
        track["uploader_names"] = uploader_map.get(int(row["id"]), [str(row["uploader"])])
        track["uploader_display"], track["uploader_full"] = format_uploader_display(track["uploader_names"])
        tracks.append(track)
    return tracks, filters, pagination


def fetch_quick_links(connection: sqlite3.Connection) -> dict[str, list[sqlite3.Row]]:
    if table_exists(connection, "track_uploaders"):
        uploaders = connection.execute(
            """
            SELECT username AS uploader, COUNT(DISTINCT track_id) AS tracks
            FROM track_uploaders
            GROUP BY username
            ORDER BY tracks DESC, username COLLATE NOCASE ASC
            LIMIT ?
            """,
            (QUICK_LINKS_LIMIT,),
        ).fetchall()
    else:
        uploaders = connection.execute(
            """
            SELECT uploader, COUNT(*) AS tracks
            FROM tracks
            GROUP BY uploader
            ORDER BY tracks DESC, uploader COLLATE NOCASE ASC
            LIMIT ?
            """,
            (QUICK_LINKS_LIMIT,),
        ).fetchall()
    return {
        "artists": connection.execute(
            """
            SELECT artist, COUNT(*) AS tracks
            FROM tracks
            GROUP BY artist
            ORDER BY tracks DESC, artist COLLATE NOCASE ASC
            LIMIT ?
            """,
            (QUICK_LINKS_LIMIT,),
        ).fetchall(),
        "albums": connection.execute(
            """
            SELECT artist, album, COUNT(*) AS tracks
            FROM tracks
            GROUP BY artist, album
            ORDER BY MAX(uploaded_at) DESC
            LIMIT ?
            """,
            (QUICK_LINKS_LIMIT,),
        ).fetchall(),
        "uploaders": uploaders,
    }


def fetch_admin_users(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            users.*,
            (
                SELECT ip_address FROM login_logs
                WHERE login_logs.user_id = users.id AND login_logs.success = 1
                ORDER BY login_logs.created_at DESC
                LIMIT 1
            ) AS last_ip,
            (
                SELECT created_at FROM login_logs
                WHERE login_logs.user_id = users.id AND login_logs.success = 1
                ORDER BY login_logs.created_at DESC
                LIMIT 1
            ) AS last_login_at,
            (
                SELECT COUNT(*) FROM login_logs
                WHERE login_logs.user_id = users.id
            ) AS login_count
        FROM users
        ORDER BY users.is_admin DESC, users.created_at ASC
        """
    ).fetchall()
    users: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["created_label"] = human_datetime(row["created_at"])
        item["last_login_label"] = human_datetime(row["last_login_at"])
        users.append(item)
    return users


def fetch_admin_logs(connection: sqlite3.Connection, request: Request) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    logs_page = parse_page(request.query_params.get("logs_page"))
    user_filter = (request.query_params.get("log_user") or "").strip()
    date_from = (request.query_params.get("date_from") or "").strip()
    date_to = (request.query_params.get("date_to") or "").strip()
    sort = request.query_params.get("log_sort") or "newest"
    order_by = {
        "newest": "login_logs.created_at DESC",
        "oldest": "login_logs.created_at ASC",
        "user_az": "login_logs.attempted_username COLLATE NOCASE ASC, login_logs.created_at DESC",
        "user_za": "login_logs.attempted_username COLLATE NOCASE DESC, login_logs.created_at DESC",
    }.get(sort, "login_logs.created_at DESC")

    sql = "FROM login_logs LEFT JOIN users ON users.id = login_logs.user_id WHERE 1=1"
    params: list[Any] = []

    if user_filter:
        sql += " AND login_logs.attempted_username LIKE ?"
        params.append(f"%{user_filter}%")
    if date_from:
        sql += " AND login_logs.created_at >= ?"
        params.append(f"{date_from}T00:00:00")
    if date_to:
        sql += " AND login_logs.created_at <= ?"
        params.append(f"{date_to}T23:59:59.999999")

    total_logs = connection.execute(f"SELECT COUNT(*) AS total {sql}", params).fetchone()["total"]
    pagination = build_pagination(request, "logs_page", logs_page, total_logs, LOGIN_LOGS_PER_PAGE)
    rows = connection.execute(
        f"""
        SELECT login_logs.*, users.username AS current_username
        {sql}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
        """,
        (*params, LOGIN_LOGS_PER_PAGE, (pagination["page"] - 1) * LOGIN_LOGS_PER_PAGE),
    ).fetchall()
    logs: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["created_label"] = human_datetime(row["created_at"])
        logs.append(item)
    filters = {
        "log_user": user_filter,
        "date_from": date_from,
        "date_to": date_to,
        "log_sort": sort,
    }
    pagination["filters"] = filters
    return logs, pagination


def fetch_admin_reviews(connection: sqlite3.Connection, lang: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT *
        FROM review_items
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 100
        """
    ).fetchall()
    items: list[dict[str, Any]] = []
    t = text_for(lang)
    for row in rows:
        item = dict(row)
        item["created_label"] = human_datetime(row["created_at"])
        item["candidate_exists"] = bool(row["candidate_path"]) and (REVIEW_DIR / row["candidate_path"]).exists()
        item["reason_label"] = t.get(str(row["reason"]), str(row["reason"]))
        items.append(item)
    return items


def render_admin(request: Request, notice: str = "", status_code: int = 200) -> HTMLResponse:
    admin_user = require_admin(request)
    lang = get_lang(request)
    t = text_for(lang)
    csrf_token = get_or_create_csrf_token(request)
    with get_db() as connection:
        users = fetch_admin_users(connection)
        logs, logs_pagination = fetch_admin_logs(connection, request)
        reviews = fetch_admin_reviews(connection, lang)
    context = {
        "request": request,
        "lang": lang,
        "t": t,
        "current_user": admin_user,
        "notice": notice,
        "users": users,
        "logs": logs,
        "logs_pagination": logs_pagination,
        "log_filters": logs_pagination["filters"],
        "reviews": reviews,
        "auth_open": False,
        "auth_mode": "login",
        "show_guest_notice": False,
        "lang_url_vi": url_with_lang(request, lang="vi"),
        "lang_url_en": url_with_lang(request, lang="en"),
        "csrf_token": csrf_token,
    }
    response = templates.TemplateResponse(request, "admin.html", context, status_code=status_code)
    set_lang_cookie(request, response, lang)
    set_csrf_cookie(request, response, csrf_token)
    return response


def render_home(
    request: Request,
    notice: str = "",
    rejected: list[str] | None = None,
    accepted: list[str] | None = None,
    status_code: int = 200,
    auth_open: bool = False,
    auth_mode: str = "login",
) -> HTMLResponse:
    lang = get_lang(request)
    t = text_for(lang)
    user = current_user(request)
    csrf_token = get_or_create_csrf_token(request)
    with get_db() as connection:
        tracks, filters, track_pagination = fetch_tracks(connection, request, lang)
        context = {
            "request": request,
            "lang": lang,
            "t": t,
            "notice": notice,
            "rejected": rejected or [],
            "accepted": accepted or [],
            "tracks": tracks,
            "track_pagination": track_pagination,
            "filters": filters,
            "summary": fetch_summary(connection),
            "sidebar": fetch_sidebar_lists(connection, request),
            "quick_links": fetch_quick_links(connection),
            "sort_keys": list(SORTS.keys()),
            "sort_labels": {key: t[f"sort_{key}"] for key in SORTS},
            "current_user": user,
            "auth_open": auth_open,
            "auth_mode": auth_mode,
            "show_guest_notice": user is None,
            "lang_url_vi": url_with_lang(request, lang="vi"),
            "lang_url_en": url_with_lang(request, lang="en"),
            "download_hint": t["login_required_tip"],
            "storage_note": t["storage_note"],
            "csrf_token": csrf_token,
        }
        response = templates.TemplateResponse(
            request,
            "index.html",
            context,
            status_code=status_code,
        )
        set_lang_cookie(request, response, lang)
        set_csrf_cookie(request, response, csrf_token)
        return response


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    auth_mode = "signup" if request.query_params.get("mode") == "signup" else "login"
    return render_home(
        request,
        auth_open=request.query_params.get("auth") == "1",
        auth_mode=auth_mode,
    )


@app.get("/login")
async def login_page(request: Request) -> RedirectResponse:
    lang = get_lang(request)
    return RedirectResponse(f"/?auth=1&lang={lang}", status_code=303)


@app.get("/signup")
async def signup_page(request: Request) -> RedirectResponse:
    lang = get_lang(request)
    return RedirectResponse(f"/?auth=1&mode=signup&lang={lang}", status_code=303)


@app.post("/login")
async def login(
    request: Request,
    csrf_token: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    next_url: str = Form("/", alias="next"),
    cell_mcc: str = Form("", alias="cell_mcc"),
    cell_mnc: str = Form("", alias="cell_mnc"),
    cell_lac: str = Form("", alias="cell_lac"),
    cell_id: str = Form("", alias="cell_id"),
    cell_radio: str = Form("", alias="cell_radio"),
) -> Any:
    lang = get_lang(request)
    t = text_for(lang)
    username_value = username.strip()[:64]
    try:
        verify_csrf(request, csrf_token)
        enforce_login_rate_limit(request, username_value)
    except HTTPException as exc:
        return render_home(
            request,
            notice=str(exc.detail),
            status_code=exc.status_code,
            auth_open=True,
            auth_mode="login",
        )
    ip_address, _ = get_client_ip(request)
    with get_db() as connection:
        user = connection.execute(
            "SELECT * FROM users WHERE username = ?",
            (username_value,),
        ).fetchone()
    if user is None or not verify_password(user["password"], password):
        record_login_log(
            request=request,
            attempted_username=username_value,
            user=None,
            success=False,
            ip_changed=False,
            cell_lookup_status="login_failed",
            cell_lookup_address="",
            cell_lookup_payload="",
        )
        return render_home(
            request,
            notice=t["invalid_login"],
            status_code=400,
            auth_open=True,
            auth_mode="login",
        )
    if not user["is_active"]:
        record_login_log(
            request=request,
            attempted_username=username_value,
            user=user,
            success=False,
            ip_changed=False,
            cell_lookup_status="user_disabled",
            cell_lookup_address="",
            cell_lookup_payload="",
        )
        return render_home(
            request,
            notice=t["user_disabled"],
            status_code=403,
            auth_open=True,
            auth_mode="login",
        )

    if not user["password"].startswith("pbkdf2_sha256$"):
        with get_db() as connection:
            connection.execute(
                "UPDATE users SET password = ? WHERE id = ?",
                (hash_password(password), user["id"]),
            )

    with get_db() as connection:
        last_success = connection.execute(
            """
            SELECT ip_address
            FROM login_logs
            WHERE user_id = ? AND success = 1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user["id"],),
        ).fetchone()
    ip_changed = last_success is not None and last_success["ip_address"] != ip_address
    cell_status, cell_address, cell_payload = lookup_cell_location(
        {
            "mcc": cell_mcc.strip(),
            "mnc": cell_mnc.strip(),
            "lac": cell_lac.strip(),
            "cellid": cell_id.strip(),
            "radio": cell_radio.strip(),
        },
        ip_changed,
    )
    record_login_log(
        request=request,
        attempted_username=username_value,
        user=user,
        success=True,
        ip_changed=ip_changed,
        cell_lookup_status=cell_status,
        cell_lookup_address=cell_address,
        cell_lookup_payload=cell_payload,
    )
    target = next_url if next_url.startswith("/") else "/"
    response = RedirectResponse(target, status_code=303)
    set_session_cookie(request, response, user["username"])
    set_lang_cookie(request, response, lang)
    return response


@app.post("/signup")
async def signup(
    request: Request,
    csrf_token: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    next_url: str = Form("/", alias="next"),
) -> Any:
    lang = get_lang(request)
    t = text_for(lang)
    username_value = username.strip()[:64]
    try:
        verify_csrf(request, csrf_token)
        enforce_signup_rate_limit(request, username_value)
    except HTTPException as exc:
        return render_home(
            request,
            notice=str(exc.detail),
            status_code=exc.status_code,
            auth_open=True,
            auth_mode="signup",
        )
    if password != password_confirm:
        return render_home(
            request,
            notice=t["signup_password_mismatch"],
            status_code=400,
            auth_open=True,
            auth_mode="signup",
        )
    if not username_value or not password:
        return render_home(
            request,
            notice=t["invalid_login"],
            status_code=400,
            auth_open=True,
            auth_mode="signup",
        )
    with get_db() as connection:
        exists = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (username_value,),
        ).fetchone()
        if exists is not None:
            return render_home(
                request,
                notice=t["signup_username_exists"],
                status_code=400,
                auth_open=True,
                auth_mode="signup",
            )
        connection.execute(
            """
            INSERT INTO users (username, password, is_admin, is_active, created_at)
            VALUES (?, ?, 0, 1, ?)
            """,
            (username_value, hash_password(password), now_utc().isoformat()),
        )
    target = next_url if next_url.startswith("/") else "/"
    response = RedirectResponse(target, status_code=303)
    set_session_cookie(request, response, username_value)
    set_lang_cookie(request, response, lang)
    return response


@app.post("/logout")
async def logout(request: Request, csrf_token: str = Form(...)) -> RedirectResponse:
    verify_csrf(request, csrf_token)
    response = RedirectResponse(f"/?lang={get_lang(request)}", status_code=303)
    clear_session_cookie(response)
    set_lang_cookie(request, response, get_lang(request))
    return response


@app.post("/upload", response_class=HTMLResponse)
async def upload(
    request: Request,
    csrf_token: str = Form(...),
    rights_confirmed: bool = Form(False),
    upload_batch_id: str = Form(""),
    files: list[UploadFile] = File(default_factory=list),
    zip_file: UploadFile | None = File(None),
) -> HTMLResponse:
    lang = get_lang(request)
    t = text_for(lang)
    user = current_user(request)
    try:
        verify_csrf(request, csrf_token)
        enforce_body_size_limit(request, MAX_REQUEST_BODY_BYTES)
    except HTTPException as exc:
        return render_home(request, notice=str(exc.detail), status_code=exc.status_code)
    if user is None:
        return render_home(
            request,
            notice=t["upload_login_required"],
            status_code=403,
            auth_open=True,
            auth_mode="login",
        )
    if not user["is_active"]:
        return render_home(request, notice=t["user_disabled"], status_code=403)
    uploader_name = user["username"]
    batch_id = re.sub(r"[^a-zA-Z0-9_-]", "", upload_batch_id or "")[:64]
    try:
        enforce_upload_rate_limit(request, uploader_name, batch_id=batch_id)
    except HTTPException as exc:
        return render_home(request, notice=str(exc.detail), status_code=exc.status_code)
    if not rights_confirmed:
        return render_home(request, notice=t["rights_needed"], status_code=400)

    accepted: list[str] = []
    rejected: list[str] = []
    await process_direct_uploads(files, uploader_name, accepted, rejected, lang)
    await process_zip_upload(zip_file, uploader_name, accepted, rejected, lang)

    if not accepted and not rejected:
        return render_home(request, notice=t["nothing_uploaded"], status_code=400)

    notice = t["accepted_summary"].format(accepted=len(accepted), rejected=len(rejected))
    return render_home(request, notice=notice, accepted=accepted, rejected=rejected)


@app.post("/upload/chunk")
async def upload_chunk(
    request: Request,
    csrf_token: str = Form(...),
    upload_batch_id: str = Form(...),
    upload_token: str = Form(...),
    upload_name: str = Form(...),
    upload_kind: str = Form(...),
    chunk_offset: int = Form(...),
    upload_size: int = Form(...),
    chunk: UploadFile = File(...),
) -> JSONResponse:
    lang = get_lang(request)
    t = text_for(lang)
    user = current_user(request)
    try:
        verify_csrf(request, csrf_token)
        enforce_body_size_limit(request, MAX_REQUEST_BODY_BYTES)
    except HTTPException as exc:
        return JSONResponse({"ok": False, "detail": str(exc.detail)}, status_code=exc.status_code)
    if user is None:
        return JSONResponse({"ok": False, "detail": t["upload_login_required"]}, status_code=403)
    if not user["is_active"]:
        return JSONResponse({"ok": False, "detail": t["user_disabled"]}, status_code=403)
    batch_id = normalize_batch_id(upload_batch_id)
    try:
        enforce_upload_rate_limit(request, user["username"], batch_id=batch_id)
        meta = await append_chunk_to_batch(
            chunk,
            batch_id=batch_id,
            upload_token=upload_token,
            upload_name=upload_name,
            upload_kind=upload_kind,
            chunk_offset=chunk_offset,
            upload_size=upload_size,
        )
    except HTTPException as exc:
        return JSONResponse({"ok": False, "detail": str(exc.detail)}, status_code=exc.status_code)
    except IngestError as exc:
        return JSONResponse({"ok": False, "detail": describe_error(str(exc), lang)}, status_code=400)
    return JSONResponse({"ok": True, "token": meta["token"]})


@app.post("/upload/complete", response_class=HTMLResponse)
async def upload_complete(
    request: Request,
    csrf_token: str = Form(...),
    rights_confirmed: bool = Form(False),
    upload_batch_id: str = Form(...),
) -> HTMLResponse:
    lang = get_lang(request)
    t = text_for(lang)
    user = current_user(request)
    try:
        verify_csrf(request, csrf_token)
    except HTTPException as exc:
        return render_home(request, notice=str(exc.detail), status_code=exc.status_code)
    if user is None:
        return render_home(
            request,
            notice=t["upload_login_required"],
            status_code=403,
            auth_open=True,
            auth_mode="login",
        )
    if not user["is_active"]:
        return render_home(request, notice=t["user_disabled"], status_code=403)
    if not rights_confirmed:
        return render_home(request, notice=t["rights_needed"], status_code=400)

    accepted: list[str] = []
    rejected: list[str] = []
    batch_id = normalize_batch_id(upload_batch_id)
    try:
        process_completed_batch(batch_id, user["username"], accepted, rejected, lang)
    except IngestError as exc:
        cleanup_batch_dir(batch_id)
        return render_home(request, notice=describe_error(str(exc), lang), status_code=400)
    finally:
        cleanup_batch_dir(batch_id)

    if not accepted and not rejected:
        return render_home(request, notice=t["nothing_uploaded"], status_code=400)

    notice = t["accepted_summary"].format(accepted=len(accepted), rejected=len(rejected))
    return render_home(request, notice=notice, accepted=accepted, rejected=rejected)


@app.get("/download/{track_id}")
async def download(request: Request, track_id: int) -> FileResponse:
    lang = get_lang(request)
    user = current_user(request)
    if user is None:
        raise HTTPException(status_code=403, detail=text_for(lang)["login_needed_notice"])
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail=text_for(lang)["user_disabled"])

    with get_db() as connection:
        row = connection.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=text_for(lang)["track_not_found"])
    blob_relative = row["blob_path"] or row["stored_path"]
    file_path = LIBRARY_DIR / blob_relative
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=text_for(lang)["file_missing"])
    return FileResponse(
        file_path,
        media_type="audio/flac",
        filename=download_filename_for_track(row),
    )


@app.get("/download-bundle")
async def download_bundle(request: Request, ids: str = "") -> FileResponse:
    lang = get_lang(request)
    user = current_user(request)
    if user is None:
        raise HTTPException(status_code=403, detail=text_for(lang)["login_needed_notice"])
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail=text_for(lang)["user_disabled"])

    raw_ids = [part.strip() for part in ids.split(",") if part.strip()]
    track_ids: list[int] = []
    for raw_id in raw_ids:
        if raw_id.isdigit():
            track_ids.append(int(raw_id))
    track_ids = list(dict.fromkeys(track_ids))
    if not track_ids:
        raise HTTPException(status_code=400, detail=text_for(lang)["track_not_found"])
    if len(track_ids) > MAX_BUNDLE_TRACKS:
        raise HTTPException(status_code=400, detail=f"too many tracks, max {MAX_BUNDLE_TRACKS}")

    placeholders = ",".join("?" for _ in track_ids)
    with get_db() as connection:
        rows = connection.execute(
            f"SELECT * FROM tracks WHERE id IN ({placeholders})",
            track_ids,
        ).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail=text_for(lang)["track_not_found"])

    row_by_id = {int(row["id"]): row for row in rows}
    ordered_rows = [row_by_id[track_id] for track_id in track_ids if track_id in row_by_id]
    if not ordered_rows:
        raise HTTPException(status_code=404, detail=text_for(lang)["track_not_found"])

    bundle_path = Path(tempfile.NamedTemporaryFile(delete=False, dir=TMP_DIR, suffix=".zip").name)
    used_names: set[str] = set()
    try:
        with ZipFile(bundle_path, "w", compression=ZIP_DEFLATED) as archive:
            for row in ordered_rows:
                blob_relative = row["blob_path"] or row["stored_path"]
                file_path = LIBRARY_DIR / blob_relative
                if not file_path.exists():
                    continue
                archive.write(
                    file_path,
                    arcname=unique_bundle_member_name(download_filename_for_track(row), used_names),
                )
    except Exception:
        bundle_path.unlink(missing_ok=True)
        raise

    return FileResponse(
        bundle_path,
        media_type="application/zip",
        filename=bundle_filename(),
        background=BackgroundTask(lambda: bundle_path.unlink(missing_ok=True)),
    )


@app.get("/spectrum/{track_id}.png")
async def spectrum_image(request: Request, track_id: int) -> FileResponse:
    lang = get_lang(request)
    with get_db() as connection:
        row = connection.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=text_for(lang)["track_not_found"])
    try:
        image_path = ensure_spectrum_image(row)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=text_for(lang)["file_missing"]) from None
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=500, detail=f"spectrum render failed: {exc}") from exc
    return FileResponse(
        image_path,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request) -> HTMLResponse:
    return render_admin(request)


def approve_review_item(review_item: sqlite3.Row, reviewer: str) -> str:
    candidate_path = REVIEW_DIR / str(review_item["candidate_path"] or "")
    if not candidate_path.exists():
        raise HTTPException(status_code=404, detail="review candidate missing")

    meta = extract_flac_payload(candidate_path, allow_quality_override=True)
    file_hash = hash_file(candidate_path)
    uploader = str(review_item["uploader"])
    original_filename = str(review_item["original_filename"])
    decision_note = "approved_import"

    if str(review_item["suggested_action"]) == "merge_existing" and review_item["existing_track_id"]:
        with get_db() as connection:
            existing_track = connection.execute(
                "SELECT * FROM tracks WHERE id = ?",
                (int(review_item["existing_track_id"]),),
            ).fetchone()
        if existing_track is not None:
            decision_note = merge_existing_track(
                existing_track,
                uploader,
                original_filename,
                candidate_path,
                meta,
                file_hash,
                str(review_item["reason"]),
            )
        else:
            decision_note = store_new_track_from_meta(
                candidate_path,
                original_filename,
                uploader,
                meta,
                ingest_note="approved_from_review_missing_target",
            )["status"]
    else:
        decision_note = store_new_track_from_meta(
            candidate_path,
            original_filename,
            uploader,
            meta,
            ingest_note=f"approved_from_review:{review_item['reason']}",
        )["status"]

    with get_db() as connection:
        connection.execute(
            """
            UPDATE review_items
            SET status = 'approved', reviewed_at = ?, reviewer = ?, decision_note = ?
            WHERE id = ?
            """,
            (now_utc().isoformat(), reviewer, decision_note, review_item["id"]),
        )
    candidate_path.unlink(missing_ok=True)
    return decision_note


@app.post("/admin/users/{user_id}/toggle")
async def admin_toggle_user(request: Request, user_id: int) -> RedirectResponse:
    form = await request.form()
    verify_csrf(request, str(form.get("csrf_token", "")))
    admin_user = require_admin(request)
    lang = get_lang(request)
    with get_db() as connection:
        target_user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if target_user is None:
            raise HTTPException(status_code=404, detail="user not found")
        if target_user["username"] == admin_user["username"]:
            raise HTTPException(status_code=400, detail="cannot disable current admin")
        connection.execute(
            "UPDATE users SET is_active = ? WHERE id = ?",
            (0 if target_user["is_active"] else 1, user_id),
        )
    response = RedirectResponse(f"/admin?lang={lang}", status_code=303)
    set_lang_cookie(request, response, lang)
    return response


@app.post("/admin/reviews/{review_id}/approve")
async def admin_approve_review(request: Request, review_id: int) -> RedirectResponse:
    form = await request.form()
    verify_csrf(request, str(form.get("csrf_token", "")))
    admin_user = require_admin(request)
    lang = get_lang(request)
    with get_db() as connection:
        review_item = connection.execute(
            "SELECT * FROM review_items WHERE id = ?",
            (review_id,),
        ).fetchone()
    if review_item is None:
        raise HTTPException(status_code=404, detail="review item not found")
    if review_item["status"] != "pending":
        raise HTTPException(status_code=400, detail="review item already handled")
    approve_review_item(review_item, admin_user["username"])
    response = RedirectResponse(f"/admin?lang={lang}", status_code=303)
    set_lang_cookie(request, response, lang)
    return response


@app.post("/admin/reviews/{review_id}/reject")
async def admin_reject_review(request: Request, review_id: int) -> RedirectResponse:
    form = await request.form()
    verify_csrf(request, str(form.get("csrf_token", "")))
    admin_user = require_admin(request)
    lang = get_lang(request)
    with get_db() as connection:
        review_item = connection.execute(
            "SELECT * FROM review_items WHERE id = ?",
            (review_id,),
        ).fetchone()
        if review_item is None:
            raise HTTPException(status_code=404, detail="review item not found")
        if review_item["status"] != "pending":
            raise HTTPException(status_code=400, detail="review item already handled")
        connection.execute(
            """
            UPDATE review_items
            SET status = 'rejected', reviewed_at = ?, reviewer = ?, decision_note = 'rejected'
            WHERE id = ?
            """,
            (now_utc().isoformat(), admin_user["username"], review_id),
        )
    candidate_path = REVIEW_DIR / str(review_item["candidate_path"] or "")
    candidate_path.unlink(missing_ok=True)
    response = RedirectResponse(f"/admin?lang={lang}", status_code=303)
    set_lang_cookie(request, response, lang)
    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
